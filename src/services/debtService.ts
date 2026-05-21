import { supabase } from '../lib/supabaseClient';
import { PersonalZettl, Currency } from '../types';

export const debtService = {
  /**
   * Request money from a friend
   * creditorId is the person who gets paid (to_user_id)
   * debtorId is the person who owes (from_user_id)
   */
  async requestMoney(
    creditorId: string,
    debtorId: string,
    amount: number,
    note: string,
    dueDate?: string
  ): Promise<PersonalZettl> {
    const { data: requestData, error } = await supabase
      .from('personal_zettls')
      .insert({
        from_user_id: debtorId,
        to_user_id: creditorId,
        amount: Math.round(amount),
        currency: 'INR',
        note,
        due_date: dueDate || null,
        is_settled: false,
        message: `/request ${amount} for ${note}`
      })
      .select('*')
      .single();

    if (error) {
      console.error('[DEBT-SERVICE] Request money failed:', error);
      throw error;
    }

    // Log in activities table
    try {
      await supabase.from('activities').insert([
        {
          user_id: creditorId,
          debt_id: requestData.id,
          action: 'requested',
          amount,
          message: `You requested ₹${amount} from friend for: ${note}`
        },
        {
          user_id: debtorId,
          debt_id: requestData.id,
          action: 'requested',
          amount,
          message: `Requested ₹${amount} from you for: ${note}`
        }
      ]);

      // Create notification for debtor
      await supabase.from('notifications').insert({
        user_id: debtorId,
        type: 'request',
        title: '💸 Money Requested',
        body: `Requested ₹${amount} for "${note}". Click to pay.`,
        data: JSON.stringify({ debtId: requestData.id, amount, note }),
        read: false
      });
    } catch (aErr) {
      console.warn('[DEBT-SERVICE] Failed to log request activities/notifications:', aErr);
    }

    return {
      id: requestData.id,
      fromUserId: requestData.from_user_id,
      toUserId: requestData.to_user_id,
      fromUsername: '',
      toUsername: '',
      amount: requestData.amount,
      currency: requestData.currency as Currency,
      note: requestData.note,
      createdAt: requestData.created_at,
      dueDate: requestData.due_date,
      isSettled: requestData.is_settled,
      settledAt: requestData.settled_at,
      reminderLastSentAt: requestData.reminder_last_sent_at,
      reminderCount: requestData.reminder_count || 0
    };
  },

  /**
   * Pay/Settle a debt
   */
  async payDebt(debtId: string, currentUserId: string): Promise<void> {
    const { data: debt, error: getErr } = await supabase
      .from('personal_zettls')
      .select('*')
      .eq('id', debtId)
      .maybeSingle();

    if (getErr || !debt) {
      throw new Error(getErr?.message || 'Debt record not found');
    }

    const { error: updateErr } = await supabase
      .from('personal_zettls')
      .update({
        is_settled: true,
        settled_at: new Date().toISOString()
      })
      .eq('id', debtId);

    if (updateErr) {
      console.error('[DEBT-SERVICE] Settle debt failed:', updateErr);
      throw updateErr;
    }

    const payerId = debt.from_user_id;
    const payeeId = debt.to_user_id;
    const amount = debt.amount;
    const note = debt.note || 'Settle debt';

    // Log in activities & notifications
    try {
      await supabase.from('activities').insert([
        {
          user_id: payerId,
          debt_id: debtId,
          action: 'paid',
          amount,
          message: `Settle: You paid ₹${amount} for "${note}"`
        },
        {
          user_id: payeeId,
          debt_id: debtId,
          action: 'settled',
          amount,
          message: `Received ₹${amount} from friend for "${note}"`
        }
      ]);

      await supabase.from('notifications').insert({
        user_id: payeeId,
        type: 'payment',
        title: '✅ Payment Received',
        body: `Transferred ₹${amount} for "${note}".`,
        data: JSON.stringify({ debtId, amount, note }),
        read: false
      });
    } catch (aErr) {
      console.warn('[DEBT-SERVICE] Failed to log payment activities/notifications:', aErr);
    }
  },

  /**
   * Raise reminder/nudge for debt
   */
  async sendReminder(debtId: string, senderUserId: string): Promise<void> {
    const { data: debt } = await supabase
      .from('personal_zettls')
      .select('*')
      .eq('id', debtId)
      .maybeSingle();

    if (!debt) throw new Error('Debt not found');

    const receiverId = debt.from_user_id;
    const count = (debt.reminder_count || 0) + 1;

    const { error: updateErr } = await supabase
      .from('personal_zettls')
      .update({
        reminder_last_sent_at: new Date().toISOString(),
        reminder_count: count,
        reminded_at: new Date().toISOString()
      })
      .eq('id', debtId);

    if (updateErr) throw updateErr;

    // Log activity & notification
    try {
      await supabase.from('activities').insert({
        user_id: receiverId,
        debt_id: debtId,
        action: 'reminded',
        amount: debt.amount,
        message: `Reminder nudge for ₹${debt.amount} for "${debt.note || 'debt'}"`
      });

      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'reminder',
        title: '⏰ Payment Nudge',
        body: `Please settle ₹${debt.amount} for "${debt.note || 'debt'}"!`,
        data: JSON.stringify({ debtId, amount: debt.amount }),
        read: false
      });
    } catch (err) {
      console.warn('[DEBT-SERVICE] Error sending notification nudge:', err);
    }
  },

  /**
   * Grab summary counts for current logged in user
   */
  async getBalances(userId: string) {
    const { data: lentData, error: lErr } = await supabase
      .from('personal_zettls')
      .select('amount')
      .eq('to_user_id', userId)
      .eq('is_settled', false);

    const { data: borrowedData, error: bErr } = await supabase
      .from('personal_zettls')
      .select('amount')
      .eq('from_user_id', userId)
      .eq('is_settled', false);

    if (lErr || bErr) {
      console.error('[DEBT-SERVICE] Load balances failed');
    }

    const totalOwedToMe = (lentData || []).reduce((sum, item) => sum + Number(item.amount), 0);
    const totalIOwe = (borrowedData || []).reduce((sum, item) => sum + Number(item.amount), 0);
    const netBalance = totalOwedToMe - totalIOwe;

    return {
      totalOwedToMe,
      totalIOwe,
      netBalance
    };
  },

  /**
   * Grab list of active transactions involving user which are unpaid
   */
  async getPendingRequests(userId: string) {
    const { data, error } = await supabase
      .from('personal_zettls')
      .select('*')
      .eq('from_user_id', userId)
      .eq('is_settled', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get active debts requested BY me (waiting for others to pay)
   */
  async getActiveDebtsRequestedByMe(userId: string) {
    const { data, error } = await supabase
      .from('personal_zettls')
      .select('*')
      .eq('to_user_id', userId)
      .eq('is_settled', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Group balances by individual friends (Top 5)
   */
  async getFriendBalances(userId: string) {
    const { data, error } = await supabase
      .from('personal_zettls')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('is_settled', false);

    if (error) throw error;

    const balancesMap = new Map<string, { owesMe: number; iOweThem: number }>();

    (data || []).forEach((z: any) => {
      const owesMe = z.to_user_id === userId;
      const friendId = owesMe ? z.from_user_id : z.to_user_id;
      const amt = Number(z.amount);

      const base = balancesMap.get(friendId) || { owesMe: 0, iOweThem: 0 };
      if (owesMe) {
        base.owesMe += amt;
      } else {
        base.iOweThem += amt;
      }
      balancesMap.set(friendId, base);
    });

    const list: { friendId: string; netAmount: number; description: string }[] = [];
    balancesMap.forEach((val, friendId) => {
      const net = val.owesMe - val.iOweThem;
      if (net > 0) {
        list.push({
          friendId,
          netAmount: net,
          description: `owes you ₹${net}`
        });
      } else if (net < 0) {
        list.push({
          friendId,
          netAmount: net,
          description: `You owe ₹${Math.abs(net)}`
        });
      }
    });

    // Load usernames for these top friends
    const friendIds = list.map(item => item.friendId);
    if (friendIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', friendIds);

    const profMap = new Map<string, any>();
    (profiles || []).forEach(p => profMap.set(p.id, p));

    return list.map(item => {
      const p = profMap.get(item.friendId);
      return {
        friendId: item.friendId,
        username: p?.username || 'user',
        fullName: p?.full_name || p?.username || 'Zettl Friend',
        avatar: p?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p?.username || item.friendId}`,
        netAmount: item.netAmount,
        description: item.description
      };
    }).slice(0, 5);
  },

  /**
   * Helper to fetch group chat details from existing group_goals
   */
  async fetchExistingGroupGoals() {
    const { data, error } = await supabase
      .from('group_goals')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  /**
   * Get comments or chat messages for specific personal debt item
   */
  async getDebtMessages(debtId: string) {
    const { data, error } = await supabase
      .from('personal_zettls')
      .select('*')
      .eq('id', debtId)
      .maybeSingle();

    if (error) throw error;
    return data ? [data] : [];
  }
};

import { supabase } from '../lib/supabaseClient';
import { getAvatarUrl } from '../constants/avatars';
import { supabaseRealtimeService } from './supabaseRealtime';
import { friendService } from './friendService';
import { ChatListItem, ChatMessage, CreateRequestData, CreatePaymentData } from '../types/zettl.types';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';

// Keep track of read messages locally or in sessionStorage
const getSessionReadStatus = (): Record<string, boolean> => {
  try {
    const data = sessionStorage.getItem('zettl_read_messages');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

const saveSessionReadStatus = (status: Record<string, boolean>) => {
  try {
    sessionStorage.setItem('zettl_read_messages', JSON.stringify(status));
  } catch (e) {
    // Ignore
  }
};

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const zettlService = {
  /**
   * getChatList(userId) - returns ChatListItem[]
   */
  async getChatList(userId: string): Promise<ChatListItem[]> {
    if (!userId) return [];

    try {
      // 1. Fetch established friends directly from friends table ONLY
      let friendList: any[] = [];
      try {
        friendList = await friendService.getFriendList(userId);
      } catch (fErr) {
        console.warn('[ZETTL-SERVICE] friendService.getFriendList notice:', fErr);
      }

      let friendIds: string[] = [];
      const profileMap = new Map<string, any>();

      if (friendList && friendList.length > 0) {
        friendList.forEach((f: any) => {
          if (f.status === 'accepted' || !f.status) {
            const fid = f.friendId || f.friend_id || f.id;
            if (fid && fid !== userId) {
              friendIds.push(fid);
              profileMap.set(fid, {
                id: fid,
                username: f.friendUsername || f.username,
                full_name: f.friendFullName || f.full_name || f.fullName,
                avatar_url: f.friendAvatar || f.avatar_url
              });
            }
          }
        });
      }

      // Direct fallback query on 'friends' table if friendList is empty
      if (friendIds.length === 0) {
        const { data: rawFriends } = await supabase
          .from('friends')
          .select('id, user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        const combinedIds = new Set<string>();
        (rawFriends || []).forEach((f: any) => {
          const fid = f.user_id === userId ? f.friend_id : f.user_id;
          if (fid && fid !== userId) combinedIds.add(fid);
        });

        friendIds = Array.from(combinedIds);

        if (friendIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', friendIds);

          (profiles || []).forEach(p => profileMap.set(p.id, p));
        }
      }

      if (friendIds.length === 0) return [];

      // 3. Fetch debts from existing 'debts' table
      let debts: any[] = [];
      try {
        const { data: dData, error: dErr } = await supabase
          .from('debts')
          .select('*')
          .or(`creditor_id.eq.${userId},user_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (dErr) {
          console.warn('[ZETTL-SERVICE] debts query notice, trying server API fallback:', dErr.message);
          try {
            const apiRes = await fetch('/api/zettl/personal/list');
            if (apiRes.ok) {
              debts = await apiRes.json();
            }
          } catch (apiErr) {
            console.warn('[ZETTL-SERVICE] Server API fallback notice:', apiErr);
          }
        } else if (dData) {
          debts = dData;
        }
      } catch (dEx) {
        console.warn('[ZETTL-SERVICE] Debts fetch notice:', dEx);
      }

      const readMessages = getSessionReadStatus();

      // Aggregate list
      return friendIds.map((fId: string) => {
        const p = profileMap.get(fId);
        const name = p?.full_name || p?.username || 'Zettl Link';
        const avatar = getAvatarUrl(p?.avatar_url, p?.username || fId);

        // Get debts with this friend
        const friendDebts = (debts || []).filter((t: any) => 
          (t.user_id === userId && t.creditor_id === fId) ||
          (t.user_id === fId && t.creditor_id === userId) ||
          (t.from_user_id === userId && t.to_user_id === fId) ||
          (t.from_user_id === fId && t.to_user_id === userId)
        );

        // Sort by created_at descending
        const sortedDebts = [...friendDebts].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        let net_balance = 0;
        sortedDebts.forEach((t: any) => {
          if (!t.settled && !t.is_settled && t.amount > 0) {
            const debtorId = t.user_id || t.from_user_id;
            const creditorId = t.creditor_id || t.to_user_id;
            const amt = Number(t.amount || 0);

            if (creditorId === userId) {
              net_balance += amt;
            } else if (debtorId === userId) {
              net_balance -= amt;
            }
          }
        });

        // Determine last message snippet
        let last_message = 'Connected on Zettl! Tap to start chatting.';
        let last_message_time = new Date().toISOString();
        let unread_count = 0;

        if (sortedDebts.length > 0) {
          const newest = sortedDebts[0];
          last_message_time = newest.created_at || last_message_time;

          const newestDebtorId = newest.user_id || newest.from_user_id;
          const newestCreditorId = newest.creditor_id || newest.to_user_id;

          if (newest.amount > 0) {
            const isRequest = !newest.settled && !newest.is_settled;
            if (isRequest) {
              last_message = newestCreditorId === userId 
                ? `Requested ₹${newest.amount}: ${newest.purpose || newest.note || 'Debt'}`
                : `Asked for ₹${newest.amount}: ${newest.purpose || newest.note || 'Debt'}`;
            } else {
              last_message = newestDebtorId === userId
                ? `Paid ₹${newest.amount} for ${newest.purpose || newest.note || 'Debt'}`
                : `Received ₹${newest.amount}`;
            }
          } else {
            last_message = newest.purpose || newest.note || 'Connected on Zettl! Tap to start chatting.';
          }

          sortedDebts.forEach((t: any) => {
            const sender = t.creditor_id || t.user_id || t.from_user_id;
            const isIncoming = sender !== userId;
            if (isIncoming && !readMessages[t.id]) {
              unread_count++;
            }
          });
        }

        return {
          friend_id: fId,
          friend_name: name,
          friend_avatar: avatar,
          last_message,
          last_message_time,
          unread_count,
          net_balance
        };
      });
    } catch (e) {
      console.error('[ZETTL-SERVICE] Error listing chat items:', e);
      return [];
    }
  },

  /**
   * getChatMessages(userId, friendId) - returns ChatMessage[]
   */
  async getChatMessages(userId: string, friendId: string): Promise<ChatMessage[]> {
    if (!userId || !friendId) return [];

    try {
      // Fetch debts involving these two users from existing 'debts' table
      const { data: rows, error } = await supabase
        .from('debts')
        .select('*')
        .or(`and(user_id.eq.${userId},creditor_id.eq.${friendId}),and(user_id.eq.${friendId},creditor_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles to map labels nicely
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', [userId, friendId]);

      const profileNameMap = new Map<string, string>();
      (profiles || []).forEach(p => profileNameMap.set(p.id, p.full_name || p.username));

      const readMap = getSessionReadStatus();

      // Map rows to ChatMessage objects
      const messages: ChatMessage[] = [];

      (rows || []).forEach((row: any) => {
        let msgType: 'request' | 'payment' | 'text' | 'system' = 'text';
        let direct: 'incoming' | 'outgoing' | 'system' = 'outgoing';

        const isSettled = row.settled || row.is_settled;
        const rawPurpose = row.purpose || row.description || '';

        if (rawPurpose.startsWith('SYSTEM:') || rawPurpose.startsWith('SYSTEM_SETTLED:') || rawPurpose.startsWith('SYSTEM_CONNECTED:')) {
          msgType = 'system';
          direct = 'system';
        } else if (row.amount > 0) {
          const debtorId = row.user_id;
          const creditorId = row.creditor_id;

          if (!isSettled) {
            msgType = 'request';
            direct = debtorId === userId ? 'incoming' : 'outgoing';
          } else {
            msgType = 'payment';
            direct = debtorId === userId ? 'outgoing' : 'incoming';
          }
        } else {
          msgType = 'text';
          direct = row.creditor_id === userId ? 'outgoing' : 'incoming';
        }

        const isRead = !!readMap[row.id] || direct === 'outgoing' || direct === 'system';

        const cleanedMessage = rawPurpose.replace(/^SYSTEM(_SETTLED|_CONNECTED)?:?\s*/, '');

        messages.push({
          id: row.id,
          type: msgType,
          direction: direct,
          amount: row.amount,
          purpose: cleanedMessage,
          due_date: row.due_date || undefined,
          status: isSettled ? 'paid' : 'pending',
          message: cleanedMessage,
          created_at: row.created_at,
          read: isRead,
          friend_id: friendId,
          friend_name: profileNameMap.get(friendId) || 'Zettl Friend',
          debt_id: row.id
        });
      });

      if (messages.length === 0) {
        messages.push({
          id: `welcome-${userId}-${friendId}`,
          type: 'system',
          direction: 'system',
          amount: 0,
          purpose: 'Connected on ZETTL! Instant chat & expense ledger active.',
          status: 'paid',
          message: 'Connected on ZETTL! Instant chat & expense ledger active.',
          created_at: new Date().toISOString(),
          read: true,
          friend_id: friendId,
          friend_name: profileNameMap.get(friendId) || 'Zettl Friend',
          debt_id: `welcome-${userId}-${friendId}`
        });
      }

      return messages;
    } catch (e) {
      console.warn('[ZETTL-SERVICE] Error fetching chat messages, attempting API fallback:', e);
      try {
        const res = await fetch('/api/zettl/personal/list');
        if (res.ok) {
          const personalTx = await res.json();
          const friendTx = (personalTx || []).filter((t: any) => 
            (t.from_user_id === userId && t.to_user_id === friendId) ||
            (t.from_user_id === friendId && t.to_user_id === userId)
          );

          if (friendTx.length > 0) {
            return friendTx.map((t: any) => ({
              id: t.id,
              type: t.amount > 0 ? (t.is_settled ? 'payment' : 'request') : 'text',
              direction: t.from_user_id === userId ? 'outgoing' : 'incoming',
              amount: t.amount,
              purpose: t.note || 'General splitting',
              due_date: t.due_date || undefined,
              status: t.is_settled ? 'paid' : 'pending',
              message: t.note,
              created_at: t.created_at,
              read: true,
              friend_id: friendId,
              friend_name: t.from_user_id === userId ? (t.to_profile?.full_name || 'Zettl Friend') : (t.from_profile?.full_name || 'Zettl Friend'),
              debt_id: t.id
            }));
          }
        }
      } catch (apiErr) {
        console.warn('[ZETTL-SERVICE] Personal list fallback notice:', apiErr);
      }

      return [{
        id: `welcome-${userId}-${friendId}`,
        type: 'text',
        direction: 'incoming',
        amount: 0,
        purpose: 'Welcome',
        status: 'paid',
        message: 'Connected on Zettl! Tap to start chatting.',
        created_at: new Date().toISOString(),
        read: true,
        friend_id: friendId,
        friend_name: 'Zettl Friend',
        debt_id: `welcome-${userId}-${friendId}`
      }];
    }
  },

  /**
   * sendRequest(data) - creates debt record in existing 'debts' table
   */
  async sendRequest(data: CreateRequestData, userId: string): Promise<ChatMessage> {
    const friendId = data.friend_id;
    const amount = Math.round(data.amount);
    const purpose = data.purpose;
    const due = data.due_date;

    const payload = {
      user_id: friendId,
      creditor_id: userId,
      amount,
      purpose,
      due_date: due || null,
      settled: false,
      status: 'active'
    };

    const { data: record, error } = await supabase
      .from('debts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ZETTL-SERVICE] Failed inserting debt request:', error);
      throw new Error(error.message || 'Failed inserting debt request');
    }

    // Insert transaction activity
    try {
      await supabase.from('activities').insert([
        {
          user_id: userId,
          debt_id: record.id,
          action: 'requested',
          amount,
          message: `You requested ₹${amount} from friend for: ${purpose}`
        }
      ]);

      const notifData = { debtId: record.id, amount, note: purpose };
      await supabase.from('notifications').insert({
        id: generateUUID(),
        user_id: friendId,
        type: 'request',
        title: '💸 Zettl Money Request',
        message: `Requested ₹${amount} for "${purpose}". Tap to chat/pay. |||DATA:${JSON.stringify(notifData)}`,
        read: false
      });
    } catch (actE) {
      console.warn('[ZETTL-SERVICE] Non-blocking warning creating notification:', actE);
    }

    return {
      id: record.id,
      type: 'request',
      direction: 'outgoing',
      amount,
      purpose,
      due_date: due || undefined,
      status: 'pending',
      message: purpose,
      created_at: record.created_at || new Date().toISOString(),
      read: true,
      friend_id: friendId,
      friend_name: 'Zettl Friend',
      debt_id: record.id
    };
  },

  /**
   * sendPayment(data) - marks debt as paid or logs a new payment in 'debts'
   */
  async sendPayment(data: CreatePaymentData, userId: string): Promise<ChatMessage> {
    const friendId = data.friend_id;
    const amount = Math.round(data.amount);
    const purpose = data.purpose;
    const debtId = data.debt_id;

    if (debtId) {
      // 1. Settle an existing pending debt record
      const { error: updError } = await supabase
        .from('debts')
        .update({
          settled: true,
          settled_at: new Date().toISOString(),
          status: 'settled'
        })
        .eq('id', debtId);

      if (updError) throw updError;

      // Log notification
      try {
        await supabase.from('activities').insert([
          {
            user_id: userId,
            debt_id: debtId,
            action: 'paid',
            amount,
            message: `Paid ₹${amount} for "${purpose}"`
          }
        ]);

        const notifData = { debtId, amount, note: purpose };
        await supabase.from('notifications').insert({
          id: generateUUID(),
          user_id: friendId,
          type: 'payment',
          title: '✅ Payment Received',
          message: `Received ₹${amount} for "${purpose}". |||DATA:${JSON.stringify(notifData)}`,
          read: false
        });
      } catch (e) {
        console.warn(e);
      }

      return {
        id: debtId,
        type: 'payment',
        direction: 'outgoing',
        amount,
        purpose,
        status: 'paid',
        message: purpose,
        created_at: new Date().toISOString(),
        read: true,
        friend_id: friendId,
        friend_name: 'Friend',
        debt_id: debtId
      };
    } else {
      // 2. Log a spontaneous new payment
      const payload = {
        user_id: userId,
        creditor_id: friendId,
        amount,
        purpose,
        settled: true,
        settled_at: new Date().toISOString(),
        status: 'settled'
      };

      const { data: record, error } = await supabase
        .from('debts')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[ZETTL-SERVICE] Failed recording payment:', error);
        throw new Error(error.message || 'Failed recording payment in debts');
      }

      try {
        await supabase.from('activities').insert([
          {
            user_id: userId,
            debt_id: record.id,
            action: 'paid',
            amount,
            message: `Paid spontaneous ₹${amount} to friend for: ${purpose}`
          }
        ]);

        const notifData = { debtId: record.id, amount, note: purpose };
        await supabase.from('notifications').insert({
          id: generateUUID(),
          user_id: friendId,
          type: 'payment',
          title: '✅ Direct Payment Received',
          message: `Sent you ₹${amount} for "${purpose}". |||DATA:${JSON.stringify(notifData)}`,
          read: false
        });
      } catch (e) {
        console.warn(e);
      }

      return {
        id: record.id,
        type: 'payment',
        direction: 'outgoing',
        amount,
        purpose,
        status: 'paid',
        message: purpose,
        created_at: record.created_at || new Date().toISOString(),
        read: true,
        friend_id: friendId,
        friend_name: 'Friend',
        debt_id: record.id
      };
    }
  },

  /**
   * sendTextMessage(friendId, message) - stores text message in 'debts' with amount 0 and in 'debt_messages'
   */
  async sendTextMessage(friendId: string, messageText: string, userId: string): Promise<ChatMessage> {
    if (!userId || !friendId || !messageText?.trim()) {
      throw new Error('Invalid send request: missing authenticated user, friend ID, or message body');
    }

    const trimmedMsg = messageText.trim();

    const payload = {
      user_id: friendId,
      creditor_id: userId,
      amount: 0,
      purpose: trimmedMsg,
      settled: true,
      status: 'active'
    };

    const { data: record, error } = await supabase
      .from('debts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ZETTL-SERVICE] sendTextMessage insert error:', error);
      throw new Error(error.message || 'Failed inserting text message into debts table');
    }

    // Also store in debt_messages for message history tracking if table exists
    try {
      await supabase.from('debt_messages').insert({
        debt_id: record.id,
        user_id: userId,
        message: trimmedMsg
      });
    } catch (msgErr) {
      console.warn('[ZETTL-SERVICE] debt_messages insert warning:', msgErr);
    }

    return {
      id: record.id,
      type: 'text',
      direction: 'outgoing',
      amount: 0,
      status: 'paid',
      message: trimmedMsg,
      created_at: record.created_at || new Date().toISOString(),
      read: true,
      friend_id: friendId,
      friend_name: 'Friend',
      debt_id: record.id
    };
  },

  /**
   * createAmountEntry(data, userId) - records expense split and system message
   */
  async createAmountEntry(data: import('../types/zettl.types').CreateAmountData, userId: string): Promise<ChatMessage> {
    const friendId = data.friend_id;
    const totalAmount = Math.round(data.amount);
    
    // Calculate owe amount based on split type
    let oweAmount = totalAmount;
    if (data.split_type === 'Half') {
      oweAmount = Math.round(totalAmount / 2);
    } else if (data.split_type === 'Custom' && data.custom_amount) {
      oweAmount = Math.round(data.custom_amount);
    }

    // Determine debtor and creditor
    const debtorId = data.who_paid === 'me' ? friendId : userId;
    const creditorId = data.who_paid === 'me' ? userId : friendId;

    const formattedNote = `[${data.category || 'Expense'}] ${data.description} (${data.split_type} Split)`;

    // Insert debt entry
    const { data: record, error } = await supabase
      .from('debts')
      .insert({
        user_id: debtorId,
        creditor_id: creditorId,
        amount: oweAmount,
        purpose: formattedNote,
        settled: false,
        status: 'active'
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ZETTL-SERVICE] createAmountEntry error:', error);
      throw error;
    }

    // Insert system chat message entry
    const sysText = data.who_paid === 'me' 
      ? `SYSTEM: You added ₹${totalAmount} for ${data.category} (${data.description}). Friend owes you ₹${oweAmount}`
      : `SYSTEM: Friend added ₹${totalAmount} for ${data.category} (${data.description}). You owe ₹${oweAmount}`;

    try {
      await supabase.from('debts').insert({
        user_id: friendId,
        creditor_id: userId,
        amount: 0,
        purpose: sysText,
        settled: true,
        status: 'active'
      });

      await supabase.from('activities').insert({
        user_id: userId,
        debt_id: record.id,
        action: 'created_debt',
        amount: oweAmount,
        message: `Expense added: ${formattedNote} (₹${oweAmount})`
      });

      await supabase.from('notifications').insert({
        id: generateUUID(),
        user_id: friendId,
        type: 'request',
        title: '💸 Zettl Expense Added',
        message: sysText.replace('SYSTEM: ', ''),
        read: false
      });
    } catch (actErr) {
      console.warn('[ZETTL-SERVICE] Non-blocking notice inserting system message:', actErr);
    }

    return {
      id: record.id,
      type: 'request',
      direction: data.who_paid === 'me' ? 'outgoing' : 'incoming',
      amount: oweAmount,
      purpose: formattedNote,
      category: data.category,
      split_type: data.split_type,
      status: 'pending',
      message: formattedNote,
      created_at: record.created_at,
      read: true,
      friend_id: friendId,
      friend_name: 'Friend',
      debt_id: record.id
    };
  },

  /**
   * settleBalances(friendId, paymentMethod, amount, memo, userId)
   */
  async settleBalances(friendId: string, paymentMethod: import('../types/zettl.types').PaymentMethod, amount: number, memo: string, userId: string): Promise<void> {
    if (!friendId || !userId) return;

    // 1. Fetch pending debts between these two users
    const { data: pendingDebts, error: fetchErr } = await supabase
      .from('debts')
      .select('id')
      .or(`and(user_id.eq.${userId},creditor_id.eq.${friendId}),and(user_id.eq.${friendId},creditor_id.eq.${userId})`)
      .eq('settled', false);

    if (fetchErr) {
      console.warn('[ZETTL-SERVICE] fetch pending debts notice:', fetchErr);
    }

    const pendingIds = (pendingDebts || []).map(d => d.id);

    if (pendingIds.length > 0) {
      // Mark all pending active debts as settled
      await supabase
        .from('debts')
        .update({
          settled: true,
          settled_at: new Date().toISOString(),
          status: 'settled'
        })
        .in('id', pendingIds);
    }

    // 2. Create system message record for settlement
    const sysMsgText = `SYSTEM_SETTLED: Settled ₹${amount} via ${paymentMethod}${memo ? ` ("${memo}")` : ''} 🎉`;

    await supabase.from('debts').insert({
      user_id: friendId,
      creditor_id: userId,
      amount: 0,
      purpose: sysMsgText,
      settled: true,
      status: 'settled'
    });

    try {
      await supabase.from('activities').insert({
        user_id: userId,
        action: 'settled',
        amount,
        message: `Settled ₹${amount} with friend via ${paymentMethod}`
      });

      await supabase.from('notifications').insert({
        id: generateUUID(),
        user_id: friendId,
        type: 'payment',
        title: '🎉 Debt Settled Up',
        message: `Settled ₹${amount} via ${paymentMethod}`,
        read: false
      });
    } catch (nErr) {
      console.warn('[ZETTL-SERVICE] Notice logging settlement activity:', nErr);
    }
  },

  /**
   * deleteMessage(messageId, userId)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!messageId) return;
    try {
      await supabase.from('debts').delete().eq('id', messageId);
      await supabase.from('debt_messages').delete().eq('debt_id', messageId);
    } catch (e) {
      console.warn('[ZETTL-SERVICE] Delete message notice:', e);
    }
  },

  /**
   * markMessagesAsRead(messageIds)
   */
  async markMessagesAsRead(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    const readMap = getSessionReadStatus();
    messageIds.forEach(id => {
      readMap[id] = true;
    });
    saveSessionReadStatus(readMap);
  },

  /**
   * getUnreadCount(userId)
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const list = await this.getChatList(userId);
      return list.reduce((sum, item) => sum + item.unread_count, 0);
    } catch (e) {
      return 0;
    }
  },

  /**
   * getNetBalanceWithFriend(userId, friendId)
   */
  async getNetBalanceWithFriend(userId: string, friendId: string): Promise<number> {
    try {
      const list = await this.getChatList(userId);
      const target = list.find(item => item.friend_id === friendId);
      return target ? target.net_balance : 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * getFriendsForDropdown(userId) - returns formatted list of friends for dropdown menus
   */
  async getFriendsForDropdown(userId: string): Promise<Array<{ id: string; friend_id: string; friendId: string; username: string; full_name: string; avatar_url?: string }>> {
    if (!userId) return [];
    try {
      // 1. Fetch connected friends from public.friends table
      let { data: rawFriends, error: fErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (fErr) {
        console.warn('[ZETTL-SERVICE] Error fetching friends for dropdown:', fErr);
        return [];
      }

      if (!rawFriends || rawFriends.length === 0) return [];

      // Filter to accepted connections if status exists
      const acceptedFriends = rawFriends.filter((f: any) => !f.status || f.status === 'accepted');
      if (acceptedFriends.length === 0) return [];

      // Extract unique friend profile IDs
      const friendIds = Array.from(new Set(
        acceptedFriends.map((f: any) => (f.user_id === userId ? f.friend_id : f.user_id)).filter(Boolean)
      ));

      if (friendIds.length === 0) return [];

      // 2. Fetch profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);

      if (pErr) {
        console.warn('[ZETTL-SERVICE] Warning fetching profiles for dropdown:', pErr);
      }

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

      return friendIds.map((fId: string) => {
        const p = profileMap.get(fId);
        const username = p?.username || `user_${fId.slice(0, 6)}`;
        const full_name = p?.full_name || p?.username || 'Zettl Friend';
        const avatar_url = getAvatarUrl(p?.avatar_url, username || fId);

        return {
          id: fId,
          friend_id: fId,
          friendId: fId,
          username,
          full_name,
          avatar_url
        };
      });
    } catch (err) {
      console.error('[ZETTL-SERVICE] Error in getFriendsForDropdown:', err);
      return [];
    }
  },

  /**
   * subscribeToChat(userId, friendId, callback) - handles real-time updates with auto-reconnect
   */
  subscribeToChat(userId: string, friendId: string, callback: () => void) {
    if (shouldDisableHeavyFeatures()) {
      return () => {};
    }

    const channelName = `zettl-chat-room-${friendId}`;

    const unsubscribe = supabaseRealtimeService.subscribe({
      channelName,
      table: 'debts',
      event: '*',
      callback: () => {
        console.log(`💬 Realtime chat message received for channel ${channelName}`);
        callback();
      }
    });

    return () => {
      unsubscribe();
    };
  }
};

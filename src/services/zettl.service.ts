import { supabase } from '../lib/supabaseClient';
import { getAvatarUrl } from '../constants/avatars';
import { supabaseRealtimeService } from './supabaseRealtime';
import { friendService } from './friendService';
import { useStore } from '../store/useStore';
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

      // Direct fallback query on 'friends' and 'friend_requests' tables if friendList is empty
      if (friendIds.length === 0) {
        const { data: rawFriends } = await supabase
          .from('friends')
          .select('id, user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        const { data: acceptedReqs } = await supabase
          .from('friend_requests')
          .select('id, sender_id, receiver_id')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .eq('status', 'accepted');

        const combinedIds = new Set<string>();
        (rawFriends || []).forEach((f: any) => {
          const fid = f.user_id === userId ? f.friend_id : f.user_id;
          if (fid && fid !== userId) combinedIds.add(fid);
        });

        (acceptedReqs || []).forEach((r: any) => {
          const fid = r.sender_id === userId ? r.receiver_id : r.sender_id;
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
      }).sort(
        (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );
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
      let allRows: any[] = [];
      let profileNameMap = new Map<string, string>();

      // 1. Fetch debts involving userId or friendId from Supabase using clean filter
      try {
        const [debtsRes, profilesRes] = await Promise.all([
          supabase
            .from('debts')
            .select('*')
            .or(`creditor_id.eq.${userId},user_id.eq.${userId},creditor_id.eq.${friendId},user_id.eq.${friendId}`)
            .order('created_at', { ascending: true }),
          supabase
            .from('profiles')
            .select('id, username, full_name')
            .in('id', [userId, friendId])
        ]);

        if (debtsRes.data && debtsRes.data.length > 0) {
          allRows = debtsRes.data;
        }
        if (profilesRes.data) {
          profilesRes.data.forEach(p => profileNameMap.set(p.id, p.full_name || p.username));
        }
      } catch (dbErr) {
        console.warn('[ZETTL-SERVICE] Supabase debts select notice:', dbErr);
      }

      // 2. Fallback to Zustand personalZettls if database returned 0 rows
      if (allRows.length === 0) {
        try {
          const storeZettls = useStore.getState().personalZettls || [];
          if (storeZettls.length > 0) {
            allRows = storeZettls.map((z: any) => ({
              id: z.id,
              user_id: z.fromUserId || z.from_user_id,
              creditor_id: z.toUserId || z.to_user_id,
              amount: z.amount,
              purpose: z.note || z.purpose,
              settled: z.isSettled || z.is_settled,
              created_at: z.createdAt || z.created_at,
              due_date: z.dueDate || z.due_date
            }));
          }
        } catch (e) {}
      }

      // 3. Fallback to /api/zettl/personal/list endpoint if still empty
      if (allRows.length === 0) {
        try {
          const res = await fetch('/api/zettl/personal/list', { credentials: 'include' });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              allRows = list.map((z: any) => ({
                id: z.id,
                user_id: z.from_user_id || z.user_id,
                creditor_id: z.to_user_id || z.creditor_id,
                amount: z.amount,
                purpose: z.note || z.purpose,
                settled: z.is_settled || z.settled,
                created_at: z.created_at,
                due_date: z.due_date
              }));
            }
          }
        } catch (e) {}
      }

      // Filter rows specifically for this pair (userId <-> friendId)
      const rows = allRows.filter((r: any) => {
        const uId = r.user_id || r.from_user_id;
        const cId = r.creditor_id || r.to_user_id;
        return (
          (uId === userId && cId === friendId) ||
          (uId === friendId && cId === userId)
        );
      });

      const readMap = getSessionReadStatus();
      const messages: ChatMessage[] = [];

      (rows || []).forEach((row: any) => {
        let msgType: 'request' | 'payment' | 'text' | 'system' = 'text';
        let direct: 'incoming' | 'outgoing' | 'system' = 'outgoing';

        const isSettled = row.settled || row.is_settled;
        const rawPurpose = row.purpose || row.description || row.note || '';

        if (rawPurpose.startsWith('SYSTEM:') || rawPurpose.startsWith('SYSTEM_SETTLED:') || rawPurpose.startsWith('SYSTEM_CONNECTED:')) {
          msgType = 'system';
          direct = 'system';
        } else if (row.amount > 0) {
          const debtorId = row.user_id || row.from_user_id;

          if (!isSettled) {
            msgType = 'request';
            direct = debtorId === userId ? 'incoming' : 'outgoing';
          } else {
            msgType = 'payment';
            direct = debtorId === userId ? 'outgoing' : 'incoming';
          }
        } else {
          msgType = 'text';
          const senderId = row.user_id || row.from_user_id;
          direct = senderId === userId ? 'outgoing' : 'incoming';
        }

        let isRead = false;
        let deliveryStatus: 'sending' | 'sent' | 'delivered' | 'read' = 'sent';

        if (direct === 'system') {
          isRead = true;
          deliveryStatus = 'read';
        } else if (direct === 'outgoing') {
          isRead = !!row.read || !!row.is_read || !!readMap[row.id] || !!readMap[`read_${row.id}`];
          deliveryStatus = isRead ? 'read' : (row.delivered || row.is_delivered ? 'delivered' : 'sent');
        } else {
          isRead = !!readMap[row.id] || !!row.read || !!row.is_read;
          deliveryStatus = isRead ? 'read' : 'delivered';
        }

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
          created_at: row.created_at || new Date().toISOString(),
          read: isRead,
          delivery_status: deliveryStatus,
          friend_id: friendId,
          friend_name: profileNameMap.get(friendId) || 'Zettl Friend',
          debt_id: row.id
        });
      });

      // Sort chronologically ascending
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
      console.warn('[ZETTL-SERVICE] Notice fetching chat messages:', e);
      return [{
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
      status: 'pending'
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
      status: 'pending'
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

    // Store in debt_messages asynchronously without delaying response
    (async () => {
      try {
        await supabase.from('debt_messages').insert({
          debt_id: record.id,
          user_id: userId,
          message: trimmedMsg
        });
      } catch (msgErr) {
        console.warn('[ZETTL-SERVICE] debt_messages insert warning:', msgErr);
      }
    })();

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
        status: 'pending'
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
        status: 'settled'
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
   * markMessagesAsRead(messageIds, userId, friendId)
   */
  async markMessagesAsRead(messageIds: string[], userId?: string, friendId?: string): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    const readMap = getSessionReadStatus();
    messageIds.forEach(id => {
      readMap[id] = true;
      readMap[`read_${id}`] = true;
    });
    saveSessionReadStatus(readMap);

    try {
      await supabase
        .from('debts')
        .update({ read: true, is_read: true, status: 'read', updated_at: new Date().toISOString() })
        .in('id', messageIds);
    } catch (e) {
      console.warn('[ZETTL-SERVICE] Notice updating debts read status:', e);
    }

    if (userId && friendId) {
      try {
        const pairKey = [userId, friendId].sort().join('-');
        const channel = supabase.channel(`zettl-chat-room-${pairKey}`);
        await channel.send({
          type: 'broadcast',
          event: 'messages_read',
          payload: { readerId: userId, friendId, messageIds }
        });
      } catch (bErr) {
        console.warn('[ZETTL-SERVICE] Broadcast read receipt notice:', bErr);
      }
    }
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
      const friendIdsSet = new Set<string>();
      const profileMap = new Map<string, any>();

      // 1. Try friendService.getFriendList first
      try {
        const flist = await friendService.getFriendList(userId);
        (flist || []).forEach((f: any) => {
          if (f.status === 'accepted' || !f.status) {
            const fid = f.friendId || f.friend_id || f.id;
            if (fid && fid !== userId) {
              friendIdsSet.add(fid);
              if (f.friendUsername || f.username) {
                profileMap.set(fid, {
                  id: fid,
                  username: f.friendUsername || f.username,
                  full_name: f.friendFullName || f.full_name || f.fullName,
                  avatar_url: f.friendAvatar || f.avatar_url
                });
              }
            }
          }
        });
      } catch (fServiceErr) {
        console.warn('[ZETTL-SERVICE] friendService.getFriendList in dropdown notice:', fServiceErr);
      }

      // 2. Fetch connected friends from public.friends table
      const { data: rawFriends } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      (rawFriends || []).forEach((f: any) => {
        const fid = f.user_id === userId ? f.friend_id : f.user_id;
        if (fid && fid !== userId) friendIdsSet.add(fid);
      });

      // 3. Fetch accepted friend_requests from friend_requests table
      const { data: acceptedReqs } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('status', 'accepted');

      (acceptedReqs || []).forEach((r: any) => {
        const fid = r.sender_id === userId ? r.receiver_id : r.sender_id;
        if (fid && fid !== userId) friendIdsSet.add(fid);
      });

      const friendIds = Array.from(friendIdsSet);
      if (friendIds.length === 0) return [];

      // 4. Fetch missing profiles
      const missingProfileIds = friendIds.filter(id => !profileMap.has(id));
      if (missingProfileIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', missingProfileIds);

        if (pErr) {
          console.warn('[ZETTL-SERVICE] Warning fetching profiles for dropdown:', pErr);
        }

        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
      }

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
  subscribeToChat(userId: string, friendId: string, callback: (payload?: any) => void) {
    if (shouldDisableHeavyFeatures()) {
      return () => {};
    }

    const pairKey = friendId === 'all-chats' ? 'all-chats' : [userId, friendId].sort().join('-');
    const channelName = `zettl-chat-room-${pairKey}`;

    const filter = friendId === 'all-chats'
      ? undefined
      : `or(user_id.eq.${userId},creditor_id.eq.${userId},debitor_id.eq.${userId})`;

    const unsubscribe = supabaseRealtimeService.subscribe({
      channelName,
      table: 'debts',
      event: '*',
      filter,
      callback: (payload) => {
        console.log(`💬 Realtime chat message received for channel ${channelName}`, payload);
        callback(payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }
};

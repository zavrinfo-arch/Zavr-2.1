import { supabase } from '../lib/supabaseClient';
import { ChatListItem, ChatMessage, CreateRequestData, CreatePaymentData } from '../types/zettl.types';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';

// Keep track of read messages locally or in sessionStorage as a crash-proof fallback
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

export const zettlService = {
  /**
   * getChatList(userId) - returns ChatListItem[]
   */
  async getChatList(userId: string): Promise<ChatListItem[]> {
    if (!userId) return [];

    try {
      // 1. Fetch accepted connections
      const { data: rawFriends, error: fErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (fErr) throw fErr;
      if (!rawFriends || rawFriends.length === 0) return [];

      // Extract unique friend profile IDs
      const friendIds = rawFriends.map((f: any) => 
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // 2. Fetch profiles of these friends
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);

      if (pErr) throw pErr;
      const profileMap = new Map<string, any>();
      (profiles || []).forEach(p => profileMap.set(p.id, p));

      // 3. Fetch all zettl_transactions for these chats
      const { data: transactions, error: tErr } = await supabase
        .from('zettl_transactions')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;

      const readMessages = getSessionReadStatus();

      // Aggregate list
      return friendIds.map((fId: string) => {
        const p = profileMap.get(fId);
        const name = p?.full_name || p?.username || 'Zettl Link';
        const avatar = p?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p?.username || fId}`;

        // Get transactions with this friend
        const friendTxTimes = (transactions || []).filter((t: any) => 
          (t.sender_id === userId && t.receiver_id === fId) ||
          (t.sender_id === fId && t.receiver_id === userId)
        );

        // Sort by created_at descending just in case
        const sortedTx = [...friendTxTimes].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Compute net outstanding balance
        // friend owes me (+) if I am creditor and not settled
        // I owe friend (-) if I am debtor and not settled
        let net_balance = 0;
        sortedTx.forEach((t: any) => {
          if (!t.is_settled && t.amount > 0) {
            const debtorId = t.type === 'owe_you' ? t.sender_id : t.receiver_id;
            const creditorId = t.type === 'owe_you' ? t.receiver_id : t.sender_id;
            const amt = Number(t.amount || 0);

            if (creditorId === userId) {
              net_balance += amt;
            } else if (debtorId === userId) {
              net_balance -= amt;
            }
          }
        });

        // Determine last message snippet
        let last_message = 'Tap to start writing';
        let last_message_time = new Date().toISOString();
        let unread_count = 0;

        if (sortedTx.length > 0) {
          const newest = sortedTx[0];
          last_message_time = newest.created_at;

          const newestDebtorId = newest.type === 'owe_you' ? newest.sender_id : newest.receiver_id;
          const newestCreditorId = newest.type === 'owe_you' ? newest.receiver_id : newest.sender_id;

          if (newest.amount > 0) {
            const isRequest = !newest.is_settled;
            if (isRequest) {
              last_message = newestCreditorId === userId 
                ? `Requested ₹${newest.amount}: ${newest.message_text || 'Debt'}`
                : `Asked for ₹${newest.amount}: ${newest.message_text || 'Debt'}`;
            } else {
              last_message = newestDebtorId === userId
                ? `Paid ₹${newest.amount} for ${newest.message_text || 'Debt'}`
                : `Received ₹${newest.amount}`;
            }
          } else {
            last_message = newest.message_text || 'New message';
          }

          // Compute unread count for incoming messages that we haven't read
          sortedTx.forEach((t: any) => {
            const isIncoming = t.sender_id !== userId;
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
      // Fetch zettl transactions involving these two users
      const { data: rows, error } = await supabase
        .from('zettl_transactions')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!rows) return [];

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

      rows.forEach((row: any) => {
        // Double check this is actually between the two target people
        const involvesBoth = 
          (row.sender_id === userId && row.receiver_id === friendId) ||
          (row.sender_id === friendId && row.receiver_id === userId);

        if (!involvesBoth) return;

        let msgType: 'request' | 'payment' | 'text' = 'text';
        let direct: 'incoming' | 'outgoing' = 'outgoing';

        if (row.amount > 0) {
          const debtorId = row.type === 'owe_you' ? row.sender_id : row.receiver_id;
          const creditorId = row.type === 'owe_you' ? row.receiver_id : row.sender_id;

          if (!row.is_settled) {
            msgType = 'request';
            // If I owe, it means friend requested it or I recorded that I owe. That is incoming request
            direct = debtorId === userId ? 'incoming' : 'outgoing';
          } else {
            msgType = 'payment';
            // If I paid, it is outgoing payment
            direct = debtorId === userId ? 'outgoing' : 'incoming';
          }
        } else {
          msgType = 'text';
          direct = row.sender_id === userId ? 'outgoing' : 'incoming';
        }

        const isRead = !!readMap[row.id] || direct === 'outgoing';

        messages.push({
          id: row.id,
          type: msgType,
          direction: direct,
          amount: row.amount,
          purpose: row.message_text || 'General splitting',
          due_date: row.deadline || undefined,
          status: row.is_settled ? 'paid' : 'pending',
          message: row.message_text,
          created_at: row.created_at,
          read: isRead,
          friend_id: friendId,
          friend_name: profileNameMap.get(friendId) || 'Zettl Friend',
          debt_id: row.id
        });
      });

      return messages;
    } catch (e) {
      console.error('[ZETTL-SERVICE] Error obtaining messages:', e);
      return [];
    }
  },

  /**
   * sendRequest(data) - creates debt record in zettl_transactions
   */
  async sendRequest(data: CreateRequestData, userId: string): Promise<ChatMessage> {
    const friendId = data.friend_id;
    const amount = Math.round(data.amount);
    const purpose = data.purpose;
    const due = data.due_date; // This is the deadline date string or null

    // A request from ME means I am the creditor (they owe me), so type is 'you_owe_me'
    const { data: record, error } = await supabase
      .from('zettl_transactions')
      .insert({
        sender_id: userId,
        receiver_id: friendId,
        amount,
        type: 'you_owe_me',
        message_text: purpose,
        deadline: due || null,
        is_settled: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ZETTL-SERVICE] Failed inserting transaction request:', error);
      throw error;
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

      await supabase.from('notifications').insert({
        user_id: friendId,
        type: 'request',
        title: '💸 Zettl Money Request',
        body: `Requested ₹${amount} for "${purpose}". Tap to chat/pay.`,
        data: JSON.stringify({ debtId: record.id, amount, note: purpose }),
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
      created_at: record.created_at,
      read: true,
      friend_id: friendId,
      friend_name: 'Zettl Friend',
      debt_id: record.id
    };
  },

  /**
   * sendPayment(data) - marks debt as paid or logs a new payment
   */
  async sendPayment(data: CreatePaymentData, userId: string): Promise<ChatMessage> {
    const friendId = data.friend_id;
    const amount = Math.round(data.amount);
    const purpose = data.purpose;
    const debtId = data.debt_id;

    if (debtId) {
      // 1. Settle an existing pending debt record
      const { error: updError } = await supabase
        .from('zettl_transactions')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString()
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

        await supabase.from('notifications').insert({
          user_id: friendId,
          type: 'payment',
          title: '✅ Payment Received',
          body: `Received ₹${amount} for "${purpose}".`,
          data: JSON.stringify({ debtId, amount, note: purpose }),
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
      // 2. Log a spontaneous new payment (I paid friend: sender_id = user, receiver_id = friend, type = 'owe_you' (I owe you and I paid), is_settled = true)
      const { data: record, error } = await supabase
        .from('zettl_transactions')
        .insert({
          sender_id: userId,
          receiver_id: friendId,
          amount,
          type: 'owe_you',
          message_text: purpose,
          is_settled: true,
          settled_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) throw error;

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

        await supabase.from('notifications').insert({
          user_id: friendId,
          type: 'payment',
          title: '✅ Direct Payment Received',
          body: `Sent you ₹${amount} for "${purpose}".`,
          data: JSON.stringify({ debtId: record.id, amount, note: purpose }),
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
        created_at: record.created_at,
        read: true,
        friend_id: friendId,
        friend_name: 'Friend',
        debt_id: record.id
      };
    }
  },

  /**
   * sendTextMessage(friendId, message) - stores text message as zero amount transaction
   */
  async sendTextMessage(friendId: string, messageText: string, userId: string): Promise<ChatMessage> {
    const { data: record, error } = await supabase
      .from('zettl_transactions')
      .insert({
        sender_id: userId,
        receiver_id: friendId,
        amount: 0,
        type: 'text_only',
        message_text: messageText,
        is_settled: true
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ZETTL-SERVICE] text message save error:', error);
      throw error;
    }

    return {
      id: record.id,
      type: 'text',
      direction: 'outgoing',
      amount: 0,
      status: 'paid',
      message: messageText,
      created_at: record.created_at,
      read: true,
      friend_id: friendId,
      friend_name: 'Friend',
      debt_id: record.id
    };
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
   * subscribeToChat(userId, friendId, callback) - handles real-time updates safely
   */
  subscribeToChat(userId: string, friendId: string, callback: () => void) {
    if (shouldDisableHeavyFeatures()) {
      return () => {
        // Safe mock unsubscribe channel for stable frame operations
      };
    }

    // Subscribe to Postgres changes on 'zettl_transactions' table
    const channel = supabase
      .channel(`zettl-chat-room-${friendId}`)
      .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'zettl_transactions'
         },
         () => {
           callback();
         }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

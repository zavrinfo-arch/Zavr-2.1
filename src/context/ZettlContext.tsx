import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { friendService, clearFriendsCache } from '../services/friendService';
import { debtService } from '../services/debtService';
import { notificationService } from '../services/notificationService';
import { useStore } from '../store/useStore';
import { Friend, PersonalZettl, Notification } from '../types';
import toast from 'react-hot-toast';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';

interface ZettlContextType {
  friends: Friend[];
  zettls: PersonalZettl[];
  pendingRequests: any[]; // money I owe
  activeDebts: any[]; // money owed to me
  friendBalances: any[];
  notifications: Notification[];
  activities: any[];
  loading: boolean;
  netBalance: number;
  totalOwedToMe: number;
  totalIOwe: number;
  fetchData: () => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriend: (requestId: string) => Promise<void>;
  rejectFriend: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  requestMoney: (friendId: string, amount: number, note: string, dueDate?: string) => Promise<void>;
  payDebt: (debtId: string) => Promise<void>;
  sendReminder: (debtId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  
  // WhatsApp Zettl Chat Additions
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshChatList: () => Promise<void>;
  currentChatFriendId: string | null;
  setCurrentChatFriendId: (friendId: string | null) => void;
  playSound: (type: 'send' | 'receive' | 'whoosh' | 'kaching') => void;
  hapticFeedback: () => void;
}

const ZettlContext = createContext<ZettlContextType | undefined>(undefined);

export const ZettlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [zettls, setZettls] = useState<PersonalZettl[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeDebts, setActiveDebts] = useState<any[]>([]);
  const [friendBalances, setFriendBalances] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Totals
  const [netBalance, setNetBalance] = useState(0);
  const [totalOwedToMe, setTotalOwedToMe] = useState(0);
  const [totalIOwe, setTotalIOwe] = useState(0);

  // WhatsApp Zettl State
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentChatFriendId, setCurrentChatFriendId] = useState<string | null>(null);

  const playSound = (type: 'send' | 'receive' | 'whoosh' | 'kaching') => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'send' || type === 'whoosh') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Coin drops
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.setValueAtTime(1500, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {
      // Ignored if sound initialization is blocked
    }
  };

  const hapticFeedback = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(15);
      }
    } catch (e) {
      // Silently swallow
    }
  };


  const fetchData = useCallback(async () => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }

    if (!activeUserId) {
      console.log('[ZETTL-CONTEXT] No authenticated user detected yet.');
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch friend list
      const loadedFriends = await friendService.getFriendList(activeUserId);
      setFriends(loadedFriends);

      // 2. Fetch standard balances
      const balances = await debtService.getBalances(activeUserId);
      setNetBalance(balances.netBalance);
      setTotalOwedToMe(balances.totalOwedToMe);
      setTotalIOwe(balances.totalIOwe);

      // 3. Pending payments current user owes to others
      const pendingReqs = await debtService.getPendingRequests(activeUserId);
      setPendingRequests(pendingReqs);

      // 4. Payments others owe to current user
      const actDebts = await debtService.getActiveDebtsRequestedByMe(activeUserId);
      setActiveDebts(actDebts);

      // 5. Friend balances breakdowns
      const frBalances = await debtService.getFriendBalances(activeUserId);
      setFriendBalances(frBalances);

      // 6. Notifications
      const countNotifications = await notificationService.getNotifications(activeUserId);
      setNotifications(countNotifications);

      // 7. Activities
      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });
      
      setActivities(acts || []);

      // 8. Raw Debts / Personal Zettls for direct matching inside chats
      const { data: allZettls } = await supabase
        .from('personal_zettls')
        .select('*')
        .or(`from_user_id.eq.${activeUserId},to_user_id.eq.${activeUserId}`)
        .order('created_at', { ascending: true });

      setZettls((allZettls || []).map((z: any) => ({
        id: z.id,
        fromUserId: z.from_user_id,
        toUserId: z.to_user_id,
        fromUsername: z.from_user_id === activeUserId ? (currentUser?.username || 'You') : 'friend',
        toUsername: z.to_user_id === activeUserId ? (currentUser?.username || 'You') : 'friend',
        amount: z.amount,
        currency: z.currency,
        note: z.note,
        createdAt: z.created_at,
        dueDate: z.due_date,
        isSettled: z.is_settled,
        settledAt: z.settled_at,
        reminderLastSentAt: z.reminder_last_sent_at,
        reminderCount: z.reminder_count || 0
      })));
    } catch (err: any) {
      console.error('[ZETTL-CONTEXT] Fetch zettl context variables failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const fetchDataRef = React.useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Real-time listener for subbed tables
  useEffect(() => {
    fetchDataRef.current();

    if (shouldDisableHeavyFeatures()) {
      console.info('[PREVIEW] Suppressing standard real-time listeners inside AI Studio preview frame.');
      return;
    }

    const friendsSubscription = supabase
      .channel('zettl-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        fetchDataRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        fetchDataRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_zettls' }, () => {
        fetchDataRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchDataRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
        fetchDataRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendsSubscription);
    };
  }, []);

  const handleSendFriendRequest = async (friendId: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }
    if (!activeUserId) throw new Error('Not authenticated');

    try {
      await friendService.sendFriendRequest(friendId, activeUserId);
      toast.success('Connection request dispatched!');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      fetchData();
    } catch (err: any) {
      console.error('[ZETTL-CONTEXT] sendFriendRequest error:', err);
      toast.error(err.message || 'Failed to dispatch connection request');
      throw err;
    }
  };

  const handleAcceptFriend = async (requestId: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }

    try {
      await friendService.acceptFriendRequest(requestId, activeUserId);
      toast.success('Connection request accepted!');
      clearFriendsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('friend-request-accepted', { detail: { requestId, activeUserId } }));
        window.dispatchEvent(new CustomEvent('refresh-chat-list'));
      }
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      fetchData();
    } catch (err: any) {
      console.error('[ZETTL-CONTEXT] acceptFriend error:', err);
      toast.error(err.message || 'Failed to accept connection request');
      throw err;
    }
  };

  const handleRejectFriend = async (requestId: string) => {
    try {
      await friendService.rejectFriendRequest(requestId);
      toast.success('Connection declined');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      fetchData();
    } catch (err: any) {
      console.error('[ZETTL-CONTEXT] rejectFriend error:', err);
      toast.error(err.message || 'Failed to decline connection request');
      throw err;
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    try {
      await friendService.removeFriend(friendId, activeUserId);
      toast.success('Connection removed successfully');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      fetchData();
    } catch (err: any) {
      console.error('[ZETTL-CONTEXT] removeFriend error:', err);
      toast.error(err.message || 'Failed to remove connection');
      throw err;
    }
  };

  const handleRequestMoney = async (friendId: string, amount: number, note: string, dueDate?: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }
    if (!activeUserId) throw new Error('Not authenticated');

    await debtService.requestMoney(activeUserId, friendId, amount, note, dueDate);
    toast.success(`Request for ₹${amount} sent to friend`);
    fetchData();
  };

  const handlePayDebt = async (debtId: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }
    if (!activeUserId) throw new Error('Not authenticated');

    await debtService.payDebt(debtId, activeUserId);
    toast.success('Payment successfully completed!');
    fetchData();
  };

  const handleSendReminder = async (debtId: string) => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }
    if (!activeUserId) throw new Error('Not authenticated');

    await debtService.sendReminder(debtId, activeUserId);
    toast.success('Payment nudge sent!');
    fetchData();
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    fetchData();
  };

  const handleMarkAllNotificationsRead = async () => {
    let activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }
    if (!activeUserId) return;

    await notificationService.markAllAsRead(activeUserId);
    toast.success('All marked as read');
    fetchData();
  };

  return (
    <ZettlContext.Provider
      value={{
        friends,
        zettls,
        pendingRequests,
        activeDebts,
        friendBalances,
        notifications,
        activities,
        loading,
        netBalance,
        totalOwedToMe,
        totalIOwe,
        fetchData,
        sendFriendRequest: handleSendFriendRequest,
        acceptFriend: handleAcceptFriend,
        rejectFriend: handleRejectFriend,
        removeFriend: handleRemoveFriend,
        requestMoney: handleRequestMoney,
        payDebt: handlePayDebt,
        sendReminder: handleSendReminder,
        markNotificationRead: handleMarkNotificationRead,
        markAllNotificationsRead: handleMarkAllNotificationsRead,
        
        // WhatsApp Additions
        unreadCount,
        setUnreadCount,
        refreshChatList: fetchData,
        currentChatFriendId,
        setCurrentChatFriendId,
        playSound,
        hapticFeedback
      }}
    >
      {children}
    </ZettlContext.Provider>
  );
};

export const useZettlContext = () => {
  const context = useContext(ZettlContext);
  if (!context) {
    throw new Error('useZettlContext must be used within a ZettlProvider');
  }
  return context;
};

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useZettlContext } from '../context/ZettlContext';
import { zettlService } from '../services/zettl.service';
import { ChatListItem, ChatMessage, CreateRequestData, CreatePaymentData } from '../types/zettl.types';
import toast from 'react-hot-toast';

export function useChatList() {
  const { currentUser } = useStore();
  const { refreshChatList, setUnreadCount } = useZettlContext();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const data = await zettlService.getChatList(currentUser.id);
      setChats(data);
      
      const totalUnreads = data.reduce((sum, item) => sum + item.unread_count, 0);
      setUnreadCount(totalUnreads);
    } catch (e) {
      console.error('[USE-CHAT-LIST] Error pulling chat list:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, setUnreadCount]);

  useEffect(() => {
    fetchChats();

    // Subscribe to updates
    if (!currentUser?.id) return;
    const unsub = zettlService.subscribeToChat(currentUser.id, 'all-chats', () => {
      fetchChats();
      refreshChatList();
    });

    return () => {
      unsub();
    };
  }, [currentUser?.id, fetchChats, refreshChatList]);

  return { chats, loading, refetch: fetchChats };
}

export function useChatMessages(friendId: string | undefined) {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback } = useZettlContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!currentUser?.id || !friendId) return;
    try {
      const data = await zettlService.getChatMessages(currentUser.id, friendId);
      
      // Determine if a new incoming message arrived to play Ka-ching sounds
      setMessages(prev => {
        if (prev.length > 0 && data.length > prev.length) {
          const newest = data[data.length - 1];
          if (newest.direction === 'incoming') {
            playSound('receive');
            hapticFeedback();
          }
        }
        return data;
      });

      // Auto mark read
      const unreadIds = data
        .filter(m => m.direction === 'incoming' && !m.read)
        .map(m => m.id);
      
      if (unreadIds.length > 0) {
        await zettlService.markMessagesAsRead(unreadIds);
      }
    } catch (e) {
      console.error('[USE-CHAT-MESSAGES] Error pulling messages:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, friendId, playSound, hapticFeedback]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();

    if (!currentUser?.id || !friendId) return;
    const unsub = zettlService.subscribeToChat(currentUser.id, friendId, () => {
      fetchMessages();
    });

    return () => {
      unsub();
    };
  }, [currentUser?.id, friendId, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
}

export function useSendRequest() {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback, refreshChatList } = useZettlContext();
  const [sending, setSending] = useState(false);

  const requestMoney = async (data: CreateRequestData) => {
    if (!currentUser?.id) {
      toast.error('Session expired');
      return;
    }
    setSending(true);
    try {
      await zettlService.sendRequest(data, currentUser.id);
      playSound('send');
      hapticFeedback();
      toast.success(`Request for ₹${data.amount} sent!`);
      refreshChatList();
    } catch (e: any) {
      toast.error(e.message || 'Request failed');
    } finally {
      setSending(false);
    }
  };

  return { requestMoney, sending };
}

export function useSendPayment() {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback, refreshChatList } = useZettlContext();
  const [sending, setSending] = useState(false);

  const makePayment = async (data: CreatePaymentData) => {
    if (!currentUser?.id) {
      toast.error('Session expired');
      return;
    }
    setSending(true);
    try {
      await zettlService.sendPayment(data, currentUser.id);
      playSound('send');
      hapticFeedback();
      toast.success(`Payment ₹${data.amount} submitted successfully!`);
      refreshChatList();
    } catch (e: any) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setSending(false);
    }
  };

  return { makePayment, sending };
}

export function useSendText() {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback, refreshChatList } = useZettlContext();
  const [sending, setSending] = useState(false);

  const sendText = async (friendId: string, text: string) => {
    if (!currentUser?.id || !text.trim()) return;
    setSending(true);
    try {
      await zettlService.sendTextMessage(friendId, text, currentUser.id);
      playSound('whoosh');
      hapticFeedback();
      refreshChatList();
    } catch (e: any) {
      toast.error('Failed to send text');
    } finally {
      setSending(false);
    }
  };

  return { sendText, sending };
}

export function useTypingIndicator(friendId: string | undefined) {
  const [isTyping, setIsTyping] = useState(false);

  // Mock highly stylized Typing Simulation when chat starts to give cozy active feedback without bloating DB traffic
  useEffect(() => {
    if (!friendId) return;
    const interval = setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
      }, 5000);
    }, 4000);

    return () => clearTimeout(interval);
  }, [friendId]);

  return { isTyping };
}

export function useUnreadCount() {
  const { unreadCount, refreshChatList } = useZettlContext();

  return { unreadCount, refresh: refreshChatList };
}

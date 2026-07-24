import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useZettlContext } from '../context/ZettlContext';
import { zettlService } from '../services/zettl.service';
import { supabase } from '../lib/supabaseClient';
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
    if (!currentUser?.id) return;

    fetchChats();

    // Event listener for accepted friend request
    const handleRefresh = () => {
      console.log('⚡ [useChatList] Friend accepted or chat list refresh event triggered, refetching chats...');
      fetchChats();
    };

    window.addEventListener('friend-request-accepted', handleRefresh);
    window.addEventListener('refresh-chat-list', handleRefresh);

    // Subscribe to chat updates
    const unsub = zettlService.subscribeToChat(currentUser.id, 'all-chats', () => {
      fetchChats();
      refreshChatList();
    });

    // Subscriptions for friends and friend_requests tables
    const friendsChannel = supabase
      .channel(`chat-list-friends-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        console.log('⚡ [useChatList] Realtime friends change received');
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        console.log('⚡ [useChatList] Realtime friend_requests change received');
        fetchChats();
      })
      .subscribe();

    return () => {
      window.removeEventListener('friend-request-accepted', handleRefresh);
      window.removeEventListener('refresh-chat-list', handleRefresh);
      unsub();
      supabase.removeChannel(friendsChannel);
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

export function useAddAmount() {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback, refreshChatList } = useZettlContext();
  const [adding, setAdding] = useState(false);

  const addAmount = async (data: import('../types/zettl.types').CreateAmountData) => {
    if (!currentUser?.id) {
      toast.error('Session expired');
      return;
    }
    setAdding(true);
    try {
      await zettlService.createAmountEntry(data, currentUser.id);
      playSound('send');
      hapticFeedback();
      refreshChatList();
    } catch (e: any) {
      toast.error(e.message || 'Failed adding amount');
      throw e;
    } finally {
      setAdding(false);
    }
  };

  return { addAmount, adding };
}

export function useSettleUp() {
  const { currentUser } = useStore();
  const { playSound, hapticFeedback, refreshChatList } = useZettlContext();
  const [settling, setSettling] = useState(false);

  const settleUp = async (friendId: string, paymentMethod: import('../types/zettl.types').PaymentMethod, amount: number, memo: string) => {
    if (!currentUser?.id) {
      toast.error('Session expired');
      return;
    }
    setSettling(true);
    try {
      await zettlService.settleBalances(friendId, paymentMethod, amount, memo, currentUser.id);
      playSound('receive');
      hapticFeedback();
      refreshChatList();
    } catch (e: any) {
      toast.error(e.message || 'Settlement failed');
      throw e;
    } finally {
      setSettling(false);
    }
  };

  return { settleUp, settling };
}

export function useDeleteMessage() {
  const { currentUser } = useStore();
  const { refreshChatList } = useZettlContext();

  const removeMessage = async (messageId: string) => {
    if (!currentUser?.id || !messageId) return;
    try {
      await zettlService.deleteMessage(messageId, currentUser.id);
      toast.success('Message deleted');
      refreshChatList();
    } catch (e: any) {
      toast.error('Failed to delete message');
    }
  };

  return { removeMessage };
}

export function useTypingIndicator(friendId: string | undefined) {
  const { currentUser } = useStore();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!friendId || !currentUser?.id) return;

    const channelName = `typing-${[currentUser.id, friendId].sort().join('-')}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id === friendId) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, friendId]);

  const sendTypingSignal = useCallback(() => {
    if (!friendId || !currentUser?.id) return;
    const channelName = `typing-${[currentUser.id, friendId].sort().join('-')}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUser.id },
    });
  }, [currentUser?.id, friendId]);

  return { isTyping, sendTypingSignal };
}

export function useOnlinePresence(friendId: string | undefined) {
  const { currentUser } = useStore();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>('Recently');

  useEffect(() => {
    if (!friendId || !currentUser?.id) return;

    const roomChannel = supabase.channel('online-users', {
      config: { presence: { key: currentUser.id } },
    });

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        const friendPresent = !!state[friendId];
        setIsOnline(friendPresent);
        if (!friendPresent) {
          setLastSeen('Recently');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({
            online_at: new Date().toISOString(),
            user_id: currentUser.id,
          });
        }
      });

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [currentUser?.id, friendId]);

  return { isOnline, lastSeen };
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        // Stop all audio stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Microphone permission required for voice notes');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) clearInterval(timerRef.current);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    setAudioUrl(null);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}

export function useUnreadCount() {
  const { unreadCount, refreshChatList } = useZettlContext();

  return { unreadCount, refresh: refreshChatList };
}

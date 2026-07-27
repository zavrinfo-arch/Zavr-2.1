import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { useZettlContext } from '../context/ZettlContext';
import { supabase } from '../lib/supabaseClient';
import { 
  useChatMessages, useSendRequest, useSendPayment, 
  useSendText, useAddAmount, useSettleUp, useDeleteMessage,
  useTypingIndicator, useOnlinePresence, useVoiceRecorder
} from '../hooks/useZettlChat';
import ChatBubble from '../components/Zettl/ChatBubble';
import RequestModal from '../components/Zettl/RequestModal';
import PaymentModal from '../components/Zettl/PaymentModal';
import ZettlAmountModal from '../components/Zettl/ZettlAmountModal';
import ZettlSettleModal from '../components/Zettl/ZettlSettleModal';
import ZettlSettlementHistoryModal from '../components/Zettl/ZettlSettlementHistoryModal';
import { ChatMessage } from '../types/zettl.types';
import { getAvatarUrl } from '../constants/avatars';

import { 
  ArrowLeft, Coins, HandCoins, Paperclip, 
  Send, Smile, Sparkles, CheckCircle2,
  Search, Pin, Mic, MicOff, StopCircle, X, History,
  CornerUpLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_EMOJIS = ['👍', '❤️', '💸', '🤝', '🔥', '😂', '🎉'];

export default function ZettlChatRoom() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  
  const { 
    currentChatFriendId, setCurrentChatFriendId, 
    payDebt, sendReminder 
  } = useZettlContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  // Core Hooks
  const { messages: rawMessages, loading, refetch } = useChatMessages(friendId);
  const { requestMoney } = useSendRequest();
  const { makePayment } = useSendPayment();
  const { sendText } = useSendText();
  const { addAmount } = useAddAmount();
  const { settleUp } = useSettleUp();
  const { removeMessage } = useDeleteMessage();
  const { isTyping, sendTypingSignal } = useTypingIndicator(friendId);
  const { isOnline, lastSeen } = useOnlinePresence(friendId);
  const {
    isRecording, recordingTime, startRecording,
    stopRecording, cancelRecording
  } = useVoiceRecorder();

  // Local state for pinned & reacted messages
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, string[]>>>({});

  // Friend profile state
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [netBalance, setNetBalance] = useState(0);

  // UI / Modals state
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAmountOpen, setIsAmountOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Input & Reply state
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Combine rawMessages with local reactions & pinned states
  const messages: ChatMessage[] = rawMessages.map((m) => ({
    ...m,
    is_pinned: pinnedMessageIds.includes(m.id),
    reactions: reactionsMap[m.id] || m.reactions,
  }));

  // Settle active friend ID on context load
  useEffect(() => {
    setCurrentChatFriendId(friendId || null);
    return () => {
      setCurrentChatFriendId(null);
    };
  }, [friendId, setCurrentChatFriendId]);

  // Handle automatic scrolling to bottom
  useEffect(() => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping]);

  // Load target connection metadata
  useEffect(() => {
    if (!friendId || !currentUser?.id) return;

    const pullFriendProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', friendId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setFriendProfile({
            id: data.id,
            name: data.full_name || data.username || 'Zettl Profile',
            avatar: getAvatarUrl(data.avatar_url, data.username || data.id),
            username: data.username
          });
        }
      } catch (e) {
        console.warn(e);
      }
    };

    pullFriendProfile();
  }, [friendId, currentUser?.id]);

  // Calculate Net balance for summary banner
  useEffect(() => {
    if (!messages.length) {
      setNetBalance(0);
      return;
    }
    
    let total = 0;
    messages.forEach((m) => {
      if (m.type === 'request' && m.status === 'pending') {
        const amt = m.amount || 0;
        if (m.direction === 'outgoing') {
          total += amt;
        } else {
          total -= amt;
        }
      }
    });
    setNetBalance(total);
  }, [messages]);

  // Handle input text changes + typing broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTypingSignal();
  };

  // Toggle Pin message (max 5)
  const handlePinMessage = (messageId: string) => {
    setPinnedMessageIds((prev) => {
      if (prev.includes(messageId)) {
        toast.success('Message unpinned');
        return prev.filter((id) => id !== messageId);
      }
      if (prev.length >= 5) {
        toast.error('Maximum 5 pinned messages allowed');
        return prev;
      }
      toast.success('Message pinned');
      return [...prev, messageId];
    });
  };

  // Toggle Reaction emoji
  const handleReactMessage = (messageId: string, emoji: string) => {
    if (!currentUser?.id) return;
    setReactionsMap((prev) => {
      const currentMsgReactions = prev[messageId] || {};
      const currentUsers = currentMsgReactions[emoji] || [];
      
      const newUsers = currentUsers.includes(currentUser.id)
        ? currentUsers.filter((id) => id !== currentUser.id)
        : [...currentUsers, currentUser.id];

      const newMsgReactions = { ...currentMsgReactions };
      if (newUsers.length > 0) {
        newMsgReactions[emoji] = newUsers;
      } else {
        delete newMsgReactions[emoji];
      }

      return { ...prev, [messageId]: newMsgReactions };
    });
  };

  // Jump to quoted reply message
  const handleJumpToReply = (replyId: string) => {
    const el = document.getElementById(`chat-bubble-${replyId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#FF6B6B]', 'transition-all');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#FF6B6B]'), 2000);
    }
  };

  // Settle transaction payoff triggered inside bubble
  const handlePayNowBubble = async (debtId: string, amount: number, purpose: string) => {
    try {
      await payDebt(debtId);
      await refetch();
    } catch (e) {
      // Handled inside payDebt
    }
  };

  const handleRemindBubble = async (debtId: string) => {
    try {
      await sendReminder(debtId);
      refetch();
    } catch (e) {
      // Handled inside remind
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await removeMessage(messageId);
    await refetch();
  };

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !friendId) return;

    const copy = inputText;
    setInputText('');
    setShowEmojiPicker(false);
    setReplyingTo(null);

    await sendText(friendId, copy.trim());
    await refetch();
  };

  // Send Voice Note
  const handleSendVoiceNote = async () => {
    if (!friendId) return;
    const blob = await stopRecording();
    if (blob) {
      const voiceUrl = URL.createObjectURL(blob);
      await sendText(friendId, `🎤 Voice Note (${recordingTime}s)`);
      toast.success('Voice message delivered!');
      await refetch();
    }
  };

  const handleQuickEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !friendId) return;

    try {
      toast.loading('Uploading media...', { id: 'file-upload' });
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      let publicUrl = '';
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      } else {
        publicUrl = URL.createObjectURL(file);
      }

      await sendText(friendId, publicUrl);
      toast.success('Attachment delivered!', { id: 'file-upload' });
      await refetch();
    } catch (err) {
      toast.error('Failed uploading attachment', { id: 'file-upload' });
    }
  };

  const handleSimulateCall = () => {
    toast(`Calling ${friendProfile?.name || 'Friend'}...`, { icon: '📞' });
  };

  // Filter messages if search active
  const filteredMessages = searchQuery
    ? messages.filter((m) =>
        (m.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.purpose || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.amount ? m.amount.toString().includes(searchQuery) : false)
      )
    : messages;

  // Pinned Messages list
  const pinnedMessages = messages.filter((m) => m.is_pinned);

  // Group messages chronologically by Date Header
  const groupedMessages: { label: string; items: typeof messages }[] = [];
  filteredMessages.forEach((msg) => {
    let label = 'Today';
    try {
      label = new Date(msg.created_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      label = 'Today';
    }

    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(msg);
    } else {
      groupedMessages.push({ label, items: [msg] });
    }
  });

  return (
    <motion.div
      id="zettl-chat-room"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col flex-1 w-full select-none relative h-screen bg-zinc-50 dark:bg-[#0a0a0f] overflow-hidden"
    >
      {/* Background radial subtle accent */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FF6B6B]/8 to-transparent pointer-events-none z-0" />

      {/* 9. Modern Chat Header (72px height, rounded bottom, 48px avatar) */}
      <header className="w-full h-[72px] sticky top-0 bg-white dark:bg-[#111118] border-b border-black/[0.06] dark:border-white/[0.08] backdrop-blur-xl px-4 rounded-b-2xl z-30 shrink-0 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/zettl')}
            className="p-2 -ml-1 hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300 hover:text-[#FF6B6B] dark:hover:text-[#FF7C7C] rounded-full transition-colors cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          
          {friendProfile && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={friendProfile.avatar}
                  alt={friendProfile.name}
                  className="w-12 h-12 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.08] shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111118] ${
                  isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                }`} />
              </div>
              <div className="min-w-0 text-left">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate leading-tight">
                  {friendProfile.name}
                </h3>
                <span className={`text-xs block leading-tight mt-0.5 font-medium ${
                  isTyping ? 'text-[#FF6B6B] font-semibold animate-pulse' : isOnline ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {isTyping ? 'typing...' : isOnline ? 'Online' : `Offline (${lastSeen})`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Header Actions (Search & Settle - No Call Buttons) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="p-2.5 bg-black/[0.03] dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:text-[#FF6B6B] dark:hover:text-[#FF7C7C] rounded-full transition-colors cursor-pointer"
            title="Search Messages"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={() => setIsSettleOpen(true)}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1.5"
          >
            <HandCoins size={14} />
            <span>Settle</span>
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar Drawer */}
      {showSearch && (
        <div className="mx-4 my-2 p-2.5 bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in duration-150 z-20">
          <Search size={16} className="text-zinc-400 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages by text, amount, note..."
            className="flex-1 text-xs bg-transparent text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[10px] font-bold font-mono text-zinc-400 px-1">
              {filteredMessages.length} matches
            </span>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-zinc-400"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="mx-4 my-1.5 p-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 overflow-x-auto no-scrollbar gap-2 z-20">
          <div className="flex items-center gap-2 truncate">
            <Pin size={13} className="shrink-0 fill-current rotate-45" />
            <span className="font-bold text-[11px] uppercase tracking-wider shrink-0">Pinned ({pinnedMessages.length}):</span>
            <div className="flex items-center gap-2 truncate">
              {pinnedMessages.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => handleJumpToReply(pm.id)}
                  className="hover:underline font-mono text-xs truncate max-w-[120px] bg-amber-500/10 px-2 py-0.5 rounded-lg cursor-pointer"
                >
                  {pm.message || pm.purpose || 'Expense'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Net Debt Summary Banner */}
      {friendProfile && (
        <div className="mx-4 my-1.5 p-2.5 px-3.5 rounded-2xl bg-white/80 dark:bg-[#111118]/80 border border-black/[0.06] dark:border-white/[0.06] backdrop-blur-md flex items-center justify-between text-xs shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Split:
            </span>
            <span className={`font-bold ${
              netBalance > 0
                ? 'text-emerald-500'
                : netBalance < 0
                ? 'text-[#FF6B6B]'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              {netBalance > 0
                ? `${friendProfile.name} owes you ₹${netBalance}`
                : netBalance < 0
                ? `You owe ${friendProfile.name} ₹${Math.abs(netBalance)}`
                : 'All Settled ✓'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <History size={12} /> History
            </button>
            <button
              type="button"
              onClick={() => setIsAmountOpen(true)}
              className="text-[11px] font-bold text-[#FF6B6B] dark:text-[#FF7C7C] hover:underline cursor-pointer"
            >
              + Expense
            </button>
          </div>
        </div>
      )}

      {/* 7. Messages Timeline Viewport (paddingBottom: 110px inside content) */}
      <main className="flex-1 w-full overflow-y-auto px-4 py-3 space-y-4 flex flex-col no-scrollbar relative z-10">
        <div className="flex-1 space-y-4 pb-[110px]">
          {loading ? (
            <div className="flex-1 flex flex-col justify-center items-center py-16 gap-3 opacity-50">
              <div className="w-7 h-7 rounded-full border-2 border-[#FF6B6B] border-t-transparent animate-spin" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Loading conversation...</p>
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center py-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                <Smile size={28} />
              </div>
              <div className="space-y-1.5 max-w-xs px-4">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Connected on ZETTL!</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Start chatting or tap <span className="font-bold text-[#FF6B6B]">₹</span> to split an expense instantly.
                </p>
              </div>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-black/[0.03] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 text-[10px] font-semibold uppercase tracking-wider rounded-full shadow-2xs">
                    {group.label}
                  </span>
                </div>

                {group.items.map((m) => (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    onPayNow={handlePayNowBubble}
                    onRemind={handleRemindBubble}
                    onDelete={handleDeleteMessage}
                    onReply={(msg) => setReplyingTo(msg)}
                    onPin={handlePinMessage}
                    onReact={handleReactMessage}
                    onJumpToReply={handleJumpToReply}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            ))
          )}

          {isTyping && (
            <div className="flex justify-start px-2 py-1">
              <div className="bg-white dark:bg-[#111118] border border-black/[0.06] dark:border-white/[0.08] text-[#FF6B6B] dark:text-[#FF7C7C] text-xs font-semibold px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce [animation-delay:0.4s]" />
                <span>@{friendProfile?.username || 'user'} is typing...</span>
              </div>
            </div>
          )}
          
          <div ref={bottomScrollRef} />
        </div>
      </main>

      {/* 4. & 6. Message Composer (56px height, 28px rounded, pinned at bottom with safe area) */}
      <footer className="fixed bottom-0 left-0 right-0 w-full px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 z-40 bg-gradient-to-t from-zinc-50 dark:from-[#0a0a0f] via-zinc-50/90 dark:via-[#0a0a0f]/90 to-transparent pointer-events-auto">
        {/* Quoted Reply Preview Bar */}
        {replyingTo && (
          <div className="mb-2 p-2.5 bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl shadow-lg flex items-center justify-between gap-2 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 border-l-2 border-[#FF6B6B] pl-2 overflow-hidden text-xs">
              <CornerUpLeft size={14} className="text-[#FF6B6B] shrink-0" />
              <div className="truncate">
                <span className="font-bold text-[10px] text-zinc-400 block">Replying to @{replyingTo.friend_name}:</span>
                <span className="truncate block font-medium text-zinc-800 dark:text-zinc-200">
                  {replyingTo.message || replyingTo.purpose || 'Expense item'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-zinc-400"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Emoji Quick Picker */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl shadow-xl flex items-center justify-around backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handleQuickEmojiSelect(e)}
                className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Live Voice Recording Control Banner */}
        {isRecording ? (
          <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-[28px] flex items-center justify-between gap-3 backdrop-blur-md animate-pulse">
            <div className="flex items-center gap-2 text-red-500 font-bold text-xs font-mono ml-2">
              <Mic size={16} className="animate-bounce" />
              <span>Recording Voice Note ({recordingTime}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 bg-black/10 dark:bg-white/10 hover:bg-red-500/20 text-zinc-600 dark:text-zinc-300 rounded-full cursor-pointer"
                title="Cancel"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={handleSendVoiceNote}
                className="px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-full shadow cursor-pointer flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          /* 5. & 6. Premium 56px height 28px rounded Composer */
          <div className="w-full h-[56px] rounded-[28px] bg-white dark:bg-[#111118] border border-[#EEEEEE] dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.06)] px-3.5 flex items-center gap-2">
            {/* Attachment shortcut icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-zinc-400 hover:text-[#FF6B6B] dark:hover:text-[#FF7C7C] transition-colors rounded-full cursor-pointer shrink-0"
              title="Attach File"
            >
              <Paperclip size={20} />
            </button>

            {/* Quick Add Expense Shortcut */}
            <button
              type="button"
              onClick={() => setIsAmountOpen(true)}
              className="w-7 h-7 rounded-full bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 text-[#FF6B6B] dark:text-[#FF7C7C] font-black text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Add Expense"
            >
              ₹
            </button>

            {/* Form & Text Input */}
            <form onSubmit={handleSendTextMessage} className="flex-1 flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="w-full text-[15px] text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-sans bg-transparent py-2"
              />

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-zinc-400 hover:text-amber-500 transition-colors p-1 cursor-pointer shrink-0"
                title="Emojis"
              >
                <Smile size={20} />
              </button>

              {/* 6. Send Button: Circular, Coral Gradient, Micro scale on tap */}
              <motion.button
                type="submit"
                disabled={!inputText.trim()}
                whileTap={{ scale: 0.92 }}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-30 transition-opacity shadow-[0_4px_12px_rgba(255,107,107,0.35)]"
              >
                <Send size={16} className="text-white ml-0.5" />
              </motion.button>
            </form>
          </div>
        )}
      </footer>

      {/* Hidden File Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf"
        className="hidden"
      />

      {/* Modals Overlay */}
      {friendProfile && (
        <>
          <ZettlAmountModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            isOpen={isAmountOpen}
            onClose={() => setIsAmountOpen(false)}
            onSubmit={async (data) => {
              await addAmount(data);
              await refetch();
            }}
          />

          <ZettlSettleModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            currentNetBalance={netBalance}
            isOpen={isSettleOpen}
            onClose={() => setIsSettleOpen(false)}
            onSubmit={async (method, amount, memo) => {
              await settleUp(friendProfile.id, method, amount, memo);
              await refetch();
            }}
          />

          <ZettlSettlementHistoryModal
            friendName={friendProfile.name}
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            messages={messages}
          />

          <RequestModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            isOpen={isRequestOpen}
            onClose={() => setIsRequestOpen(false)}
            onSubmit={async (data) => {
              await requestMoney(data);
              await refetch();
            }}
          />

          <PaymentModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            onSubmit={async (data) => {
              await makePayment(data);
              await refetch();
            }}
          />
        </>
      )}
    </motion.div>
  );
}

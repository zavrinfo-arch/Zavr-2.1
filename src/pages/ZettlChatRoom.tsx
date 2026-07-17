import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { useZettlContext } from '../context/ZettlContext';
import { supabase } from '../lib/supabaseClient';
import { 
  useChatMessages, useSendRequest, useSendPayment, 
  useSendText, useTypingIndicator 
} from '../hooks/useZettlChat';
import ChatBubble from '../components/Zettl/ChatBubble';
import RequestModal from '../components/Zettl/RequestModal';
import PaymentModal from '../components/Zettl/PaymentModal';

import { 
  ArrowLeft, Coins, HandCoins, Paperclip, 
  Send, Smile, Sparkles 
} from 'lucide-react';

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

  // Hook details
  const { messages, loading, refetch } = useChatMessages(friendId);
  const { requestMoney } = useSendRequest();
  const { makePayment } = useSendPayment();
  const { sendText } = useSendText();
  const { isTyping } = useTypingIndicator(friendId);

  // Friend details state
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [netBalance, setNetBalance] = useState(0);

  // Modals state
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Text message inputs
  const [inputText, setInputText] = useState('');

  // Settle active friend ID on context load
  useEffect(() => {
    setCurrentChatFriendId(friendId || null);
    return () => {
      setCurrentChatFriendId(null);
    };
  }, [friendId, setCurrentChatFriendId]);

  // Handle automatic scrolling to bottom when message arrives
  useEffect(() => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

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
            avatar: data.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${data.username}`,
            username: data.username
          });
        }
      } catch (e) {
        console.warn(e);
      }
    };

    pullFriendProfile();
  }, [friendId, currentUser?.id]);

  // Calculate Net balance for top banner
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
          total += amt; // Owed to me
        } else {
          total -= amt; // I owe them
        }
      }
    });
    setNetBalance(total);
  }, [messages]);

  // Settle transaction payoff triggered inside a bubble
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

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !friendId) return;

    const copy = inputText;
    setInputText('');
    await sendText(friendId, copy.trim());
    await refetch();
  };

  const handleReceiptIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !friendId) return;

    try {
      const path = `receipts/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

      const { data, error } = await supabase.storage
        .from('zettl-receipts')
        .upload(path, file);

      let url = '';
      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('zettl-receipts')
          .getPublicUrl(path);
        url = publicData.publicUrl;
      } else {
        url = URL.createObjectURL(file);
      }

      await sendText(friendId, url);
      await refetch();
    } catch (err) {
      console.error('[STORAGE-RECEIPT] Error uploading image asset:', err);
    }
  };

  // Grouping dates
  const getGroupedLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Earlier';
    }
  };

  // Group messages array by date
  const groupedMessages: { label: string; items: any[] }[] = [];
  messages.forEach((msg) => {
    const label = getGroupedLabel(msg.created_at);
    const existing = groupedMessages.find((g) => g.label === label);
    if (existing) {
      existing.items.push(msg);
    } else {
      groupedMessages.push({ label, items: [msg] });
    }
  });

  return (
    <motion.div
      id="zettl-chat-room"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col select-none relative h-[calc(100vh-140px)]"
    >
      {/* Background radial gradient to align with dashboard accent glow */}
      <div className="absolute inset-x-0 -top-16 h-36 bg-gradient-to-b from-[#FF6B6B]/5 to-transparent pointer-events-none" />

      {/* Claymorphic detail Header */}
      <header className="sticky top-0 bg-white/90 dark:bg-[#111118]/90 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-3 rounded-2xl z-30 shrink-0 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 max-w-[65%]">
          <button
            onClick={() => navigate('/zettl')}
            className="p-1 px-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-400 dark:text-white/40 hover:text-[#FF6B6B] dark:hover:text-[#FF7C7C] rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          
          {friendProfile && (
            <div className="flex items-center gap-2.5 truncate">
              <img
                src={friendProfile.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.08] shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="truncate text-left">
                <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate leading-tight">
                  {friendProfile.name}
                </h3>
                <span className="text-[9px] text-[#FF6B6B] dark:text-[#FF7C7C] tracking-wider font-extrabold uppercase font-mono block leading-none mt-1">
                  {isTyping ? 'Typing...' : `@${friendProfile.username}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick balance ribbon */}
        {netBalance !== 0 && (
          <div className={`px-2.5 py-1.5 rounded-full text-[10px] font-black tracking-widest border shrink-0 uppercase ${
            netBalance > 0
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'
              : 'bg-[#FF6B6B]/10 dark:bg-[#FF7C7C]/10 text-[#FF6B6B] dark:text-[#FF7C7C] border-black/[0.06] dark:border-white/[0.06]'
          }`}>
            {netBalance > 0 ? `Owes: ₹${netBalance}` : `Owed: ₹${Math.abs(netBalance)}`}
          </div>
        )}
      </header>

      {/* Message Timeline List viewport */}
      <main className="flex-1 w-full overflow-y-auto py-4 space-y-4 flex flex-col no-scrollbar pb-24">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-12 gap-3 opacity-40">
            <div className="w-6 h-6 rounded-full border-2 border-[#FF6B6B] border-t-transparent animate-spin" />
            <p className="text-[9.5px] text-zinc-500 dark:text-white font-bold uppercase tracking-wider">Loading Ledger List...</p>
          </div>
        ) : groupedMessages.length === 0 ? (
          /* Empty Chat History Display */
          <div className="flex-1 flex flex-col justify-center items-center text-center py-12 space-y-4">
            <div className="w-14 h-14 rounded-full bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-zinc-300 dark:text-white/20">
              <Smile size={24} />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-xs font-black uppercase text-zinc-800 dark:text-white/80 tracking-widest">Clear Ledger Activity</p>
              <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 font-bold uppercase tracking-wider leading-relaxed">
                Send text messages or tap the quick coins buttons to request/pay split settlements.
              </p>
            </div>
          </div>
        ) : (
          /* Grouped list printer */
          <div className="flex-1 space-y-4">
            {groupedMessages.map((group) => (
              <div key={group.label} className="space-y-3">
                {/* Date Header Badge */}
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] text-zinc-400 dark:text-white/40 text-[9px] font-black uppercase tracking-wider rounded-full">
                    {group.label}
                  </span>
                </div>

                {group.items.map((m) => (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    onPayNow={handlePayNowBubble}
                    onRemind={handleRemindBubble}
                  />
                ))}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start px-2 py-1">
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] text-[#FF6B6B] dark:text-[#FF7C7C] text-[9.5px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-[#FF6B6B] dark:bg-[#FF7C7C] rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="uppercase tracking-wider">@{friendProfile?.username || 'user'} typing...</span>
                </div>
              </div>
            )}
            
            <div ref={bottomScrollRef} />
          </div>
        )}
      </main>

      {/* Styled Chat Keyboard Floats above BottomNav */}
      <footer className="fixed bottom-[84px] left-0 right-0 max-w-md mx-auto px-6 z-40">
        <div className="bg-white/90 dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] p-2 rounded-2xl flex items-center gap-2 shadow-lg backdrop-blur-md">
          {/* Quick Transaction Action Drawer Shortcuts */}
          {friendProfile && (
            <div className="flex items-center gap-1.5 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] px-2 h-11 rounded-full shrink-0">
              <button
                type="button"
                onClick={() => setIsRequestOpen(true)}
                className="p-1.5 bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/25 text-[#FF6B6B] rounded-full transition-all cursor-pointer"
                title="Request Money"
              >
                <Coins size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsPaymentOpen(true)}
                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-500 rounded-full transition-all cursor-pointer"
                title="Pay Money"
              >
                <HandCoins size={14} />
              </button>
              <button
                type="button"
                onClick={handleReceiptIconClick}
                className="p-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-400 dark:text-white/40 hover:text-[#FF6B6B] dark:hover:text-[#FF7C7C] rounded-full transition-all cursor-pointer"
                title="Attach Receipt"
              >
                <Paperclip size={14} />
              </button>
            </div>
          )}

          {/* Core Send Message Textbox Form */}
          <form onSubmit={handleSendTextMessage} className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-11 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-full px-4 flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a ledger memo..."
                className="w-full text-xs text-zinc-800 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/30 font-sans bg-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-30 transition-opacity"
            >
              <Send size={14} className="text-white" />
            </button>
          </form>
        </div>
      </footer>

      {/* Hidden File uploads inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Modals Containers Overlay */}
      {friendProfile && (
        <>
          <RequestModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            isOpen={isRequestOpen}
            onClose={() => setIsRequestOpen(false)}
            onSubmit={requestMoney}
          />

          <PaymentModal
            friendId={friendProfile.id}
            friendName={friendProfile.name}
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            onSubmit={makePayment}
          />
        </>
      )}
    </motion.div>
  );
}

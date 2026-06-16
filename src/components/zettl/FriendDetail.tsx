import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Send, MessageSquare, Phone, 
  HelpCircle, Trash2, Check, Bell, RefreshCw 
} from 'lucide-react';
import { formatCurrency, cn, formatDateSafely } from '../../lib/utils';
import toast from 'react-hot-toast';

interface FriendDetailProps {
  friend: any;
  currentUser: any;
  personalZettls: any[];
  onBack: () => void;
  onSendMoney: (amount: number, note: string) => Promise<void>;
  onRequestMoney: (amount: number, note: string) => Promise<void>;
  onSettleZettl: (id: string) => Promise<void>;
  onRemindZettl: (id: string) => Promise<void>;
}

export default function FriendDetail({
  friend,
  currentUser,
  personalZettls,
  onBack,
  onSendMoney,
  onRequestMoney,
  onSettleZettl,
  onRemindZettl
}: FriendDetailProps) {
  const [loading, setLoading] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [noteText, setNoteText] = useState('');
  const [actionType, setActionType] = useState<'send' | 'request'>('send');

  const filteredZettls = personalZettls.filter(
    z => (z.fromUserId === currentUser?.id && z.toUserId === friend.friendId) ||
         (z.toUserId === currentUser?.id && z.fromUserId === friend.friendId)
  );

  // Calculate Net Position
  const friendOwesMe = personalZettls
    .filter(z => !z.isSettled && z.toUserId === currentUser?.id && z.fromUserId === friend.friendId)
    .reduce((sum, z) => sum + z.amount, 0);

  const iOweFriend = personalZettls
    .filter(z => !z.isSettled && z.fromUserId === currentUser?.id && z.toUserId === friend.friendId)
    .reduce((sum, z) => sum + z.amount, 0);

  const activeNet = friendOwesMe - iOweFriend;

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(quickAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!noteText) {
      toast.error('Enter what this is for');
      return;
    }

    setLoading(true);
    try {
      if (actionType === 'send') {
        await onSendMoney(parsedAmount, noteText);
        toast.success(`Successfully sent ₹${parsedAmount}!`);
      } else {
        await onRequestMoney(parsedAmount, noteText);
        toast.success(`Requested ₹${parsedAmount}!`);
      }
      setQuickAmount('');
      setNoteText('');
    } catch (err: any) {
      toast.error(err.message || 'Transaction submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[75vh]" id="friend-detail-view-container">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 clay-inset rounded-xl flex items-center justify-center text-foreground/45 hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </motion.button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl clay-inset p-0.5 border border-foreground/5">
            <img 
              src={friend.friendAvatar} 
              alt="" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <h3 className="text-sm font-black italic">@{friend.friendUsername}</h3>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{friend.friendFullName}</p>
          </div>
        </div>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      {/* 2. Conversational Net Balance Header */}
      <div className="clay-card p-5 border border-foreground/5 bg-surface/40 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Conversation Balance</p>
          <p className={cn(
            "text-2xl font-black italic mt-1 tracking-tight",
            activeNet > 0 ? "text-emerald-500" : activeNet < 0 ? "text-amber-500" : "text-foreground/40"
          )}>
            {activeNet === 0 ? 'Settled Up' : activeNet > 0 ? `+${formatCurrency(activeNet)}` : `-${formatCurrency(Math.abs(activeNet))}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-black opacity-30 uppercase tracking-[0.1em]">Ledger Ledger</p>
          <span className="text-[10px] font-bold opacity-50 block mt-1">
            {activeNet > 0 ? 'John owes you' : activeNet < 0 ? 'You owe John' : 'Ready' }
          </span>
        </div>
      </div>

      {/* 3. Chat-like Chronological Ledger Feed */}
      <div className="flex-1 space-y-3 min-h-[250px] max-h-[350px] overflow-y-auto pr-1.5 custom-scrollbar">
        {filteredZettls.length === 0 ? (
          <div className="py-12 text-center opacity-40">
            <p className="text-[10px] font-black uppercase tracking-widest">No transaction history between you</p>
          </div>
        ) : (
          filteredZettls.map((zettl) => {
            const iAmOwed = zettl.toUserId === currentUser?.id;
            
            return (
              <motion.div 
                key={zettl.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "max-w-[78%] p-3.5 rounded-2xl flex flex-col relative border",
                  zettl.isSettled 
                    ? "bg-foreground/5 opacity-55 border-foreground/5 ml-auto mr-auto text-center" 
                    : iAmOwed 
                      ? "bg-emerald-500/10 border-emerald-500/10 ml-auto items-end text-right" 
                      : "bg-amber-500/10 border-amber-500/10 mr-auto items-start text-left"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-55">
                    {zettl.isSettled ? 'SETTLED ✓' : iAmOwed ? 'YOU LENT' : 'YOU BORROWED'}
                  </span>
                </div>
                
                <h4 className="text-sm font-black italic tracking-tighter mt-1">
                  {formatCurrency(zettl.amount)}
                </h4>
                
                <p className="text-[10px] font-bold opacity-60 mt-1 leading-tight">{zettl.note}</p>
                <p className="text-[7.5px] opacity-35 font-medium mt-1.5 uppercase tracking-wide">
                  {formatDateSafely(zettl.createdAt)}
                </p>

                {/* Settle actions */}
                {!zettl.isSettled && (
                  <div className="flex gap-1 mt-2.5">
                    {iAmOwed ? (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemindZettl(zettl.id)}
                        className="p-1 px-2.5 clay-inset bg-emerald-500/20 text-emerald-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest"
                      >
                        Nudge
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSettleZettl(zettl.id)}
                        className="p-1 px-2.5 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest"
                      >
                        PAY NOW
                      </motion.button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* 4. Quick Action Input Bar (like GPay conversation chat bar) */}
      <div className="border-t border-foreground/5 pt-4">
        <form onSubmit={handleActionSubmit} className="space-y-3 p-4 clay-inset bg-foreground/5 rounded-2xl">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Send or Request immediately</span>
            <div className="flex gap-2 p-0.5 bg-foreground/5 rounded-lg">
              <button
                type="button"
                onClick={() => setActionType('send')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                  actionType === 'send' ? "bg-[#FF6B6B] text-white" : "opacity-50"
                )}
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => setActionType('request')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                  actionType === 'request' ? "bg-emerald-500 text-white" : "opacity-50"
                )}
              >
                Request
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black italic opacity-35">₹</span>
              <input 
                type="number"
                value={quickAmount}
                onChange={e => setQuickAmount(e.target.value)}
                placeholder="Amount"
                className="w-full bg-transparent border-b border-foreground/10 py-2 pl-6 text-sm font-black italic focus:border-[#FF6B6B] outline-none"
              />
            </div>
            <input 
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add memo..."
              className="flex-1 bg-transparent border-b border-foreground/10 py-2 text-xs font-bold focus:border-[#FF6B6B] outline-none"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={loading || !quickAmount || !noteText}
              className="w-9 h-9 clay-coral rounded-xl flex items-center justify-center text-white disabled:opacity-40"
            >
              <Send size={15} />
            </motion.button>
          </div>
        </form>
      </div>

    </div>
  );
}

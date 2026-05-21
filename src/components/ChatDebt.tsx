import React, { useState, useEffect, useRef } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Send, DollarSign, Wallet, Check, AlertCircle, Clock, Bell, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatDebtProps {
  friend: {
    friendId: string;
    friendUsername: string;
    friendFullName: string;
    friendAvatar: string;
  };
}

export default function ChatDebt({ friend }: ChatDebtProps) {
  const { currentUser } = useStore();
  const { zettls, requestMoney, payDebt, sendReminder, fetchData } = useZettlContext();
  const [typedMessage, setTypedMessage] = useState('');
  const [showQuickRequest, setShowQuickRequest] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter zettls involving this friend
  const activeUserId = currentUser?.id || '';
  const conversationZettls = zettls.filter(z => 
    (z.fromUserId === activeUserId && z.toUserId === friend.friendId) ||
    (z.fromUserId === friend.friendId && z.toUserId === activeUserId)
  );

  // Scroll to bottom on load or new zettls
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationZettls]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    const query = typedMessage.trim();
    // Check if it is a slash command
    if (query.startsWith('/request ')) {
      const match = query.match(/^\/request\s+(\d+)(?:\s+for\s+(.+)|(?:\s+(.+))|)$/i);
      if (match) {
        const amt = parseInt(match[1]);
        const note = match[2] || match[3] || 'Requested split';
        if (isNaN(amt) || amt <= 0) {
          toast.error('Invalid amount specified');
          return;
        }
        try {
          await requestMoney(friend.friendId, amt, note);
          setTypedMessage('');
        } catch (err: any) {
          toast.error(err.message || 'Request failed');
        }
      } else {
        toast.error('Format error! Use: /request <amount> for <reason>');
      }
    } else {
      // Create a dummy chat comment/activity just for the chat feel, since the DB tables store debts
      try {
        await requestMoney(friend.friendId, 0, query, 'chat-only' as any);
        setTypedMessage('');
      } catch (err) {
        // Fallback
        toast.error('Chat message requires a valid debt command, or use /request <amt>');
      }
    }
  };

  const handleCreateQuickSplit = async () => {
    const amt = parseFloat(quickAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const note = quickNote.trim() || 'Split bill';
    try {
      await requestMoney(friend.friendId, amt, note);
      setQuickAmount('');
      setQuickNote('');
      setShowQuickRequest(false);
    } catch (err: any) {
      toast.error(err.message || 'Request failed');
    }
  };

  return (
    <div className="clay bg-surface overflow-hidden flex flex-col h-[520px] rounded-2xl relative border border-foreground/5">
      {/* Chat header */}
      <div className="p-4 bg-foreground/3 border-b border-foreground/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl clay-inset p-0.5 border border-purple-500/10 shrink-0">
            <img
              src={friend.friendAvatar}
              alt=""
              className="w-full h-full object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h4 className="text-xs font-black italic text-foreground">@{friend.friendUsername}</h4>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{friend.friendFullName}</p>
          </div>
        </div>

        <button
          onClick={() => setShowQuickRequest(!showQuickRequest)}
          className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay cursor-pointer flex items-center gap-1 shrink-0"
        >
          <DollarSign size={10} /> Quick Request
        </button>
      </div>

      {/* Main chat body representing the zettls conversation */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-background/5">
        
        {/* Helper instructions bubbles */}
        <div className="flex justify-center">
          <div className="text-[8px] font-black uppercase tracking-[0.2em] bg-foreground/5 text-purple-400 px-3 py-1.5 rounded-full text-center max-w-xs leading-relaxed">
            💬 Tip: Type <code className="text-white">/request 500 for dinner</code> here to request instantly!
          </div>
        </div>

        {conversationZettls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-25 text-center">
            <Wallet size={36} className="mb-2 text-purple-400 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-widest">No transaction chat logged</p>
            <p className="text-[8px] font-bold mt-1 max-w-[200px]">Perform your first transaction request or slash commands above</p>
          </div>
        ) : (
          conversationZettls.map((z) => {
            const isMyRequest = z.toUserId === activeUserId; // I am creditor (requested from friend)
            const isZeroComment = z.amount === 0;

            if (isZeroComment) {
              // Simple chat comment layout
              return (
                <div key={z.id} className={`flex ${isMyRequest ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-xl p-3 text-xs font-medium relative ${
                    isMyRequest
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-foreground/10 text-foreground rounded-bl-none border border-foreground/5'
                  }`}>
                    <p>{z.note}</p>
                    <span className="text-[7px] opacity-40 float-right mt-1.5">
                      {new Date(z.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            }

            // Interactive GPay split debt bubble
            return (
              <div key={z.id} className={`flex ${isMyRequest ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-xl border ${
                  isMyRequest
                    ? 'bg-purple-900/40 border-purple-500/20 text-foreground rounded-br-none'
                    : 'bg-foreground/5 border-foreground/15 text-foreground rounded-bl-none'
                }`}>
                  
                  {/* Title & amount badge */}
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <span className="text-[8px] font-black uppercase text-purple-400 tracking-widest">
                      {isMyRequest ? '📤 Outgoing split' : '📥 Incoming split'}
                    </span>
                    <span className="text-xs font-mono font-black py-0.5 px-2 bg-foreground/10 text-foreground border border-foreground/5 rounded-full">
                      {new Date(z.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Note block */}
                  <h5 className="text-[11px] font-bold mb-2 break-words leading-snug">
                    {z.note || 'Split amount request'}
                  </h5>

                  {/* Large visual amount split object */}
                  <div className="clay-inset p-3 bg-foreground/10 rounded-xl mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xl font-black italic tracking-tight">₹{z.amount}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-foreground/40 mt-0.5">
                        {z.isSettled ? '✅ PAID COMPLETED' : '🕒 WAITING PAYMENT'}
                      </p>
                    </div>

                    {z.isSettled ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/10">
                        <Check size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/10 animate-pulse">
                        <Clock size={16} />
                      </div>
                    )}
                  </div>

                  {/* Actions bar inside chat bubble */}
                  {!z.isSettled && (
                    <div className="flex gap-2 justify-end">
                      {isMyRequest ? (
                        <button
                          onClick={() => sendReminder(z.id)}
                          className="px-2.5 py-1 bg-purple-600/30 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg text-[8.5px] font-black uppercase tracking-widest clay transition-colors active:scale-95"
                        >
                          Nudge Reminder ⏰
                        </button>
                      ) : (
                        <button
                          onClick={() => payDebt(z.id)}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-[8.5px] font-black uppercase tracking-widest clay active:scale-95 transition-colors"
                        >
                          Pay Now 💳
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Slideover quick request model inside the frame */}
      <AnimatePresence>
        {showQuickRequest && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-16 inset-x-4 clay p-4 bg-surface border border-purple-600/20 z-10 space-y-3"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Quick Split Bill Panel</span>
              <button onClick={() => setShowQuickRequest(false)} className="text-[10px] opacity-40 hover:opacity-100 font-bold uppercase tracking-wider">Close</button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={quickAmount}
                onChange={e => setQuickAmount(e.target.value)}
                placeholder="₹ Amount"
                className="col-span-1 clay-inset bg-foreground/5 p-2 text-xs font-black outline-none focus:ring-1 focus:ring-purple-600 rounded-lg text-foreground placeholder:text-foreground/30"
              />
              <input
                type="text"
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                placeholder="What is this split for?"
                className="col-span-2 clay-inset bg-foreground/5 p-2 text-xs font-black outline-none focus:ring-1 focus:ring-purple-600 rounded-lg text-foreground placeholder:text-foreground/30"
              />
            </div>

            <button
              onClick={handleCreateQuickSplit}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg clay"
            >
              Push Split Request
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Typing box */}
      <form onSubmit={handleSendMessage} className="p-3 bg-foreground/3 border-t border-foreground/5 flex items-center gap-2">
        <input
          type="text"
          value={typedMessage}
          onChange={(e) => setTypedMessage(e.target.value)}
          placeholder="Split command e.g. /request 500 Uber ride..."
          className="flex-1 clay-inset bg-foreground/5 p-3 text-xs outline-none focus:ring-1 focus:ring-purple-600 rounded-xl text-foreground placeholder:opacity-30"
        />
        <button
          type="submit"
          className="w-10 h-10 bg-purple-600 text-white hover:bg-purple-500 rounded-xl flex items-center justify-center clay transition-transform active:scale-90 cursor-pointer shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

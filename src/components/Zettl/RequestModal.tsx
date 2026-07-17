import React, { useState } from 'react';
import { X, Coins } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestModalProps {
  friendId: string;
  friendName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { friend_id: string; amount: number; purpose: string; due_date?: string | null }) => Promise<void>;
}

export default function RequestModal({ friendId, friendName, isOpen, onClose, onSubmit }: RequestModalProps) {
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericalAmount = parseFloat(amount);
    if (isNaN(numericalAmount) || numericalAmount <= 0) {
      toast.error('Please input a valid positive amount');
      return;
    }

    if (!purpose.trim()) {
      toast.error('Please provide a short purpose statement');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        friend_id: friendId,
        amount: numericalAmount,
        purpose: purpose.trim(),
        due_date: dueDate || null
      });
      toast.success(`Request sent to ${friendName}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed dispatching request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 dark:bg-[#0a0a0f]/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative">
        {/* Banner header icon */}
        <div className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-white/90" />
            <h3 className="text-base font-black uppercase tracking-wider">Request Money</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {/* Target Profile Label */}
          <div className="bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-3">
            <span className="text-[10px] text-[#FF6B6B] dark:text-[#FF7C7C] font-black uppercase tracking-widest block">Recipient Friend</span>
            <span className="text-sm font-bold text-zinc-900 dark:text-white block mt-0.5">{friendName}</span>
          </div>

          {/* Amount Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-extrabold block">
              Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#FF6B6B]">
                ₹
              </span>
              <input
                type="number"
                pattern="[0-9]*"
                inputMode="numeric"
                required
                disabled={loading}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-slate-100 font-extrabold text-lg px-9 rounded-2xl focus:border-[#FF8A8A]/60 dark:focus:border-[#FF8A8A]/60 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Note Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-extrabold block">
              Purpose *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is this request for?"
              className="w-full h-11 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-slate-100 text-xs px-4 rounded-xl focus:border-[#FF8A8A]/60 dark:focus:border-[#FF8A8A]/60 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-white/30"
            />
          </div>

          {/* Due Calendar Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-extrabold block">
              Due Date (Optional)
            </label>
            <input
              type="date"
              disabled={loading}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-11 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-slate-100 text-xs px-4 rounded-xl focus:border-[#FF8A8A]/60 dark:focus:border-[#FF8A8A]/60 outline-none transition-all [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.08] text-zinc-500 dark:text-zinc-300 font-bold text-xs rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white font-extrabold text-xs rounded-2xl cursor-pointer shadow-lg shadow-[rgba(255,107,107,0.35)] hover:scale-[1.01] transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

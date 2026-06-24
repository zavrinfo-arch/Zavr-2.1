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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800/80 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Banner header icon */}
        <div className="bg-gradient-to-r from-purple-800 to-purple-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-purple-200" />
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
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] text-purple-400/90 font-black uppercase tracking-widest block">Recipient Friend</span>
            <span className="text-sm font-bold text-slate-100 block mt-0.5">{friendName}</span>
          </div>

          {/* Amount Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-purple-400">
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
                className="w-full h-12 bg-slate-950 border border-slate-800 text-slate-100 font-extrabold text-lg px-9 rounded-2xl focus:border-purple-500/50 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Note Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Purpose *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is this request for?"
              className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 text-xs px-4 rounded-xl focus:border-purple-500/50 outline-none transition-colors"
            />
          </div>

          {/* Due Calendar Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Due Date (Optional)
            </label>
            <input
              type="date"
              disabled={loading}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 text-xs px-4 rounded-xl focus:border-purple-500/50 outline-none transition-colors"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 border border-slate-800 text-slate-300 font-bold text-xs rounded-2xl hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-2xl cursor-pointer shadow-lg shadow-purple-600/20 hover:scale-[1.01] transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

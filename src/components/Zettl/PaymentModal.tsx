import React, { useState, useEffect } from 'react';
import { X, HandCoins } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

interface PendingDebtRef {
  id: string;
  amount: number;
  note: string;
  created_at: string;
}

interface PaymentModalProps {
  friendId: string;
  friendName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { friend_id: string; amount: number; purpose: string; debt_id?: string }) => Promise<void>;
}

export default function PaymentModal({ friendId, friendName, isOpen, onClose, onSubmit }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  const [pendingDebts, setPendingDebts] = useState<PendingDebtRef[]>([]);
  const [loading, setLoading] = useState(false);

  // Load unpaid raw debts we owe to this friend
  useEffect(() => {
    let active = true;
    if (!isOpen || !friendId) return;

    const fetchWeOweDebts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Debts I owe means: from_user_id = me, to_user_id = friend, is_settled = false
        const { data, error } = await supabase
          .from('personal_zettls')
          .select('id, amount, note, created_at')
          .eq('from_user_id', user.id)
          .eq('to_user_id', friendId)
          .eq('is_settled', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (active) {
          setPendingDebts(data || []);
        }
      } catch (err) {
        console.warn('[PAYMENT-MODAL] Warning loading unpaid debts:', err);
      }
    };

    fetchWeOweDebts();
    return () => {
      active = false;
    };
  }, [isOpen, friendId]);

  // If a debt is selected, automatically lock the amount and prepopulate the note
  const handleDebtChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedDebtId(val);

    if (val) {
      const match = pendingDebts.find((d) => d.id === val);
      if (match) {
        setAmount(String(match.amount));
        setPurpose(`Settle: ${match.note || 'Debt'}`);
      }
    } else {
      setAmount('');
      setPurpose('');
    }
  };

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericalAmount = parseFloat(amount);
    if (isNaN(numericalAmount) || numericalAmount <= 0) {
      toast.error('Please input a valid positive amount');
      return;
    }

    if (!purpose.trim()) {
      toast.error('Please specify a summary description');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        friend_id: friendId,
        amount: numericalAmount,
        purpose: purpose.trim(),
        debt_id: selectedDebtId ? selectedDebtId : undefined
      });
      toast.success(`Payment sent to ${friendName}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed recording payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800/80 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Header Ribbon bar */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <HandCoins size={20} className="text-emerald-200" />
            <h3 className="text-base font-black uppercase tracking-wider">Report Payment</h3>
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
          {/* Target Profile Link */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest block">Paying Friend</span>
            <span className="text-sm font-bold text-slate-100 block mt-0.5">{friendName}</span>
          </div>

          {/* Optional Debt selection mapping dropdown */}
          {pendingDebts.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
                Select Active Debt to Settle
              </label>
              <select
                disabled={loading}
                value={selectedDebtId}
                onChange={handleDebtChange}
                className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-300 text-xs px-3 rounded-xl focus:border-emerald-500/50 outline-none transition-colors cursor-pointer"
              >
                <option value="">Spontaneous Direct Cash Pay (No debt match)</option>
                {pendingDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    ₹{d.amount} for "{d.note || 'debt'}"
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount field box */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-400">
                ₹
              </span>
              <input
                type="number"
                pattern="[0-9]*"
                inputMode="numeric"
                required
                disabled={loading || !!selectedDebtId}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-slate-950 border border-slate-800 text-slate-100 font-extrabold text-lg px-9 rounded-2xl focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Purpose Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Purpose *
            </label>
            <input
              type="text"
              required
              disabled={loading || !!selectedDebtId}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="E.g., paid for tea, movies, lunch"
              className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 text-xs px-4 rounded-xl focus:border-emerald-500/50 outline-none transition-colors"
            />
          </div>

          {/* Buttons footer */}
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
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl cursor-pointer shadow-lg shadow-emerald-600/20 hover:scale-[1.01] transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Send Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

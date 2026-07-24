import React, { useState } from 'react';
import { X, HandCoins, CheckCircle2, QrCode, Building2, Wallet, CreditCard } from 'lucide-react';
import { PaymentMethod } from '../../types/zettl.types';
import toast from 'react-hot-toast';

interface ZettlSettleModalProps {
  friendId: string;
  friendName: string;
  currentNetBalance: number;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentMethod: PaymentMethod, amount: number, memo: string) => Promise<void>;
}

const PAYMENT_METHODS: { method: PaymentMethod; icon: React.ReactNode; label: string }[] = [
  { method: 'UPI', icon: <QrCode size={18} />, label: 'UPI / QR' },
  { method: 'Cash', icon: <Wallet size={18} />, label: 'Cash' },
  { method: 'Bank Transfer', icon: <Building2 size={18} />, label: 'Bank' },
  { method: 'Other', icon: <CreditCard size={18} />, label: 'Other' },
];

export default function ZettlSettleModal({
  friendId,
  friendName,
  currentNetBalance,
  isOpen,
  onClose,
  onSubmit,
}: ZettlSettleModalProps) {
  const absNet = Math.abs(currentNetBalance);
  const [amount, setAmount] = useState(absNet > 0 ? absNet.toString() : '');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [memo, setMemo] = useState('Settlement clearance');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericalAmount = parseFloat(amount);
    if (isNaN(numericalAmount) || numericalAmount <= 0) {
      toast.error('Please input a valid settlement amount');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(method, numericalAmount, memo.trim());
      toast.success(`Settlement of ₹${numericalAmount} completed!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Settlement failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-[#0a0a0f]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <HandCoins size={22} className="text-white/90" />
            <div>
              <h3 className="text-base font-black uppercase tracking-wider leading-tight">Settle Up</h3>
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest">With {friendName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {/* Net balance alert box */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">Current Status</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-white block">
                {currentNetBalance > 0
                  ? `${friendName} owes you ₹${absNet}`
                  : currentNetBalance < 0
                  ? `You owe ${friendName} ₹${absNet}`
                  : 'All balances cleared'}
              </span>
            </div>
            {currentNetBalance === 0 ? (
              <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Clear ✓</span>
            ) : (
              <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Pending</span>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Settlement Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">
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
                className="w-full h-14 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-zinc-900 dark:text-white font-black text-2xl pl-10 pr-4 rounded-2xl focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  type="button"
                  onClick={() => setMethod(pm.method)}
                  className={`p-3 rounded-2xl flex items-center gap-2.5 transition-all border cursor-pointer ${
                    method === pm.method
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 ring-2 ring-emerald-500/20'
                      : 'bg-black/[0.01] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:border-black/20'
                  }`}
                >
                  <div className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5">{pm.icon}</div>
                  <span className="text-xs font-extrabold">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note / Memo */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Settlement Note
            </label>
            <input
              type="text"
              disabled={loading}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Cleared via GPay / UPI"
              className="w-full h-11 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold text-zinc-900 dark:text-white px-4 rounded-2xl focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-opacity disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              {loading ? 'Processing...' : 'Complete Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

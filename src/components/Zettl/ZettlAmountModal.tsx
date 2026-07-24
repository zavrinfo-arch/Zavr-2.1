import React, { useState } from 'react';
import { X, DollarSign, Utensils, Plane, ShoppingBag, Fuel, Film, Stethoscope, FileText, CheckCircle2 } from 'lucide-react';
import { DebtCategory, SplitType, CreateAmountData } from '../../types/zettl.types';
import toast from 'react-hot-toast';

interface ZettlAmountModalProps {
  friendId: string;
  friendName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAmountData) => Promise<void>;
}

const CATEGORIES: { name: DebtCategory; icon: React.ReactNode; color: string }[] = [
  { name: 'Food', icon: <Utensils size={16} />, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { name: 'Travel', icon: <Plane size={16} />, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { name: 'Shopping', icon: <ShoppingBag size={16} />, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { name: 'Fuel', icon: <Fuel size={16} />, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { name: 'Entertainment', icon: <Film size={16} />, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  { name: 'Medical', icon: <Stethoscope size={16} />, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { name: 'Other', icon: <FileText size={16} />, color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
];

export default function ZettlAmountModal({
  friendId,
  friendName,
  isOpen,
  onClose,
  onSubmit,
}: ZettlAmountModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [whoPaid, setWhoPaid] = useState<'me' | 'friend'>('me');
  const [splitType, setSplitType] = useState<SplitType>('Half');
  const [category, setCategory] = useState<DebtCategory>('Food');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const totalNum = parseFloat(amount) || 0;
  let calculatedDebt = 0;

  if (splitType === 'Full') {
    calculatedDebt = totalNum;
  } else if (splitType === 'Half') {
    calculatedDebt = totalNum / 2;
  } else if (splitType === 'Custom') {
    calculatedDebt = parseFloat(customAmount) || 0;
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(totalNum) || totalNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if (splitType === 'Custom' && (isNaN(calculatedDebt) || calculatedDebt <= 0)) {
      toast.error('Please enter a valid custom split amount');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        friend_id: friendId,
        amount: totalNum,
        description: description.trim(),
        who_paid: whoPaid,
        split_type: splitType,
        category,
        custom_amount: splitType === 'Custom' ? calculatedDebt : undefined,
      });
      toast.success('Amount entry recorded!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed adding amount entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-[#0a0a0f]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
              ₹
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider leading-tight">Add Expense / Debt</h3>
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

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto no-scrollbar flex-1">
          {/* Amount Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Total Expense Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[#FF6B6B]">
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
                className="w-full h-14 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-zinc-900 dark:text-white font-black text-2xl pl-10 pr-4 rounded-2xl focus:border-[#FF6B6B] outline-none transition-all placeholder:text-zinc-400"
              />
            </div>

            {/* Quick Amount Presets */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {[100, 250, 500, 1000, 2000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-2.5 py-1 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-[10px] font-black text-zinc-600 dark:text-zinc-300 hover:border-[#FF6B6B] hover:text-[#FF6B6B] transition-all cursor-pointer shrink-0"
                >
                  +₹{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Description Box */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Description / Note *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner, Taxi fare, Groceries"
              className="w-full h-11 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold text-zinc-900 dark:text-white px-4 rounded-2xl focus:border-[#FF6B6B] outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          {/* Who Paid? Toggle */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Who Paid?
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] rounded-2xl">
              <button
                type="button"
                onClick={() => setWhoPaid('me')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  whoPaid === 'me'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                🙋‍♂️ I Paid
              </button>
              <button
                type="button"
                onClick={() => setWhoPaid('friend')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  whoPaid === 'friend'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                🤝 {friendName} Paid
              </button>
            </div>
          </div>

          {/* Split Type Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Split Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Full', 'Half', 'Custom'] as SplitType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black tracking-wider transition-all cursor-pointer border ${
                    splitType === type
                      ? 'bg-black dark:bg-white text-white dark:text-black border-transparent shadow-sm'
                      : 'bg-transparent border-black/[0.08] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:border-black/20'
                  }`}
                >
                  {type === 'Full' ? 'Full (100%)' : type === 'Half' ? 'Half (50/50)' : 'Custom'}
                </button>
              ))}
            </div>

            {splitType === 'Custom' && (
              <div className="mt-2">
                <input
                  type="number"
                  placeholder="Enter custom owe amount (₹)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full h-10 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold px-3 rounded-xl outline-none"
                />
              </div>
            )}
          </div>

          {/* Category Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-black block">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border cursor-pointer ${
                    category === cat.name
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 ring-2 ring-emerald-500/20'
                      : 'bg-black/[0.01] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:border-black/20'
                  }`}
                >
                  {cat.icon}
                  <span className="text-[9px] font-bold tracking-tight">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Debt Summary Calculation Box */}
          {totalNum > 0 && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
              <CheckCircle2 size={20} className="shrink-0" />
              <div className="text-xs font-bold leading-tight">
                {whoPaid === 'me' ? (
                  <span>
                    You paid ₹{totalNum}. <strong className="font-extrabold">{friendName} owes you ₹{calculatedDebt}</strong>.
                  </span>
                ) : (
                  <span>
                    {friendName} paid ₹{totalNum}. <strong className="font-extrabold">You owe {friendName} ₹{calculatedDebt}</strong>.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Submit Actions */}
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
              disabled={loading || totalNum <= 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-xs font-extrabold shadow-lg shadow-[#FF6B6B]/20 hover:opacity-95 transition-opacity disabled:opacity-40 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save & Record Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

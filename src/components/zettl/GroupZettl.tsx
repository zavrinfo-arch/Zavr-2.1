import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, DollarSign, Calendar, ArrowLeft, Plus, 
  CheckCircle, Loader2, CreditCard, ChevronRight, MessageSquare 
} from 'lucide-react';
import { formatCurrency, cn, formatDateSafely } from '../../lib/utils';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';

interface GroupZettlProps {
  group: any;
  currentUser: any;
  onBack: () => void;
  onAddExpense: (amount: number, desc: string, splits: { userId: string; amountOwed: number }[]) => Promise<void>;
  onSettleSplit: (expenseId: string, splitId: string) => Promise<void>;
}

export default function GroupZettl({
  group,
  currentUser,
  onBack,
  onAddExpense,
  onSettleSplit
}: GroupZettlProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // New Expense form states
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  const fetchGroupExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/zettl/groups/${group.id}/expenses`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data || []);
      }
    } catch (err) {
      console.error('Fetch group expenses failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupExpenses();
  }, [group.id]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseInt(expenseAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!expenseDesc) {
      toast.error('Please add an expense description');
      return;
    }

    // Prepare divisions
    const groupMembers = group.members || [];
    const memberCount = groupMembers.length;
    let splitsPayload: { userId: string; amountOwed: number }[] = [];

    if (splitType === 'equal') {
      const perHead = Math.floor(amountVal / memberCount);
      splitsPayload = groupMembers.map((m: any) => ({
        userId: m.user_id,
        amountOwed: m.user_id === currentUser.id ? 0 : perHead // You don't owe yourself
      }));
    } else {
      let allocatedTotal = 0;
      splitsPayload = groupMembers.map((m: any) => {
        const customVal = parseInt(customSplits[m.user_id]) || 0;
        allocatedTotal += customVal;
        return {
          userId: m.user_id,
          amountOwed: m.user_id === currentUser.id ? 0 : customVal
        };
      });

      if (allocatedTotal > amountVal) {
        toast.error('Allocated splits exceed total invoice!');
        return;
      }
    }

    try {
      await onAddExpense(amountVal, expenseDesc, splitsPayload);
      toast.success('Group expense added successfully!');
      setIsAddExpenseOpen(false);
      setExpenseAmount('');
      setExpenseDesc('');
      setCustomSplits({});
      fetchGroupExpenses();
    } catch (err: any) {
      toast.error(err.message || 'Split addition failed');
    }
  };

  const handleSettleActiveSplit = async (expenseId: string, splitId: string) => {
    try {
      await onSettleSplit(expenseId, splitId);
      toast.success('Successfully paid group share!');
      fetchGroupExpenses();
    } catch (err: any) {
      toast.error('Settle group split failed');
    }
  };

  // Aggregation of total expenses
  const totalGroupSpent = expenses.reduce((sum, e) => sum + e.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Navigation */}
      <div className="flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-9 h-9 clay-inset rounded-xl flex items-center justify-center text-foreground/45 hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </motion.button>
        <div className="text-center">
          <h2 className="text-lg font-black italic">#{group.name}</h2>
          <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.1em]">Group Ledger</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddExpenseOpen(true)}
          className="w-9 h-9 clay-coral rounded-xl flex items-center justify-center text-white"
        >
          <Plus size={16} />
        </motion.button>
      </div>

      {/* 2. Group Stats Card */}
      <div className="clay-card p-5 relative overflow-hidden border border-foreground/5 bg-surface/50">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Settled Group Cost</p>
            <h3 className="text-3xl font-black italic mt-1 text-[#FF6B6B]">{formatCurrency(totalGroupSpent)}</h3>
            <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-1 inline-block">
              {(group.members || []).length} members registered
            </span>
          </div>
          <div className="w-10 h-10 bg-[#FF6B6B]/15 rounded-xl flex items-center justify-center text-[#FF6B6B]">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* 3. Splitting Breakdown Timeline list */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 px-2">Group Expenses & Splits</h3>
        
        {loading ? (
          <div className="py-12 text-center opacity-40">
            <Loader2 size={24} className="animate-spin mx-auto text-[#FF6B6B]" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="clay-card p-12 text-center opacity-40 border border-dashed border-foreground/10">
            <p className="text-xs font-bold uppercase tracking-widest">No expenses recorded yet</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAddExpenseOpen(true)}
              className="mt-4 px-4 py-2.5 clay-inset hover:bg-foreground/5 rounded-xl text-[10px] font-black uppercase text-[#FF6B6B]"
            >
              Add First Expense
            </motion.button>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => {
              const mySplit = exp.splits?.find((s: any) => s.user_id === currentUser.id);
              const paidByMe = exp.paid_by_user_id === currentUser.id;
              
              // Count settled splits
              const splits = exp.splits || [];
              const pendingSplits = splits.filter((s: any) => !s.is_settled);
              const paidCount = splits.length - pendingSplits.length;
              const isSettledFully = pendingSplits.length === 0;

              return (
                <div key={exp.id} className="clay-card p-4 space-y-4 border border-foreground/5">
                  {/* Header Expense Details */}
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 clay-inset rounded-xl p-0.5 border border-foreground/5 flex items-center justify-center bg-[#FF6B6B]/10 text-coral">
                        <Users size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black italic">{exp.description}</h4>
                        <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-1">
                          Paid upfront by {paidByMe ? "You" : "@" + (exp.paid_by_profile?.username || 'member')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black italic tracking-tighter">{formatCurrency(exp.total_amount)}</p>
                      <p className="text-[8px] font-black opacity-30 uppercase tracking-widest mt-1">
                        Total split value
                      </p>
                    </div>
                  </div>

                  {/* Split Table / Members List */}
                  <div className="clay-inset bg-foreground/5 p-3 rounded-2xl space-y-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] opacity-40">Status: {paidCount} of {splits.length} Settle</p>
                    <div className="divide-y divide-foreground/5">
                      {splits.map((s: any) => {
                        const isSplitOwner = s.user_id === currentUser.id;
                        return (
                          <div key={s.id} className="flex justify-between items-center py-2 text-[10px]">
                            <span className="font-bold opacity-75">
                              {isSplitOwner ? "You (Owe)" : `@${s.user_profile?.username || 'member'}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-black tracking-tight",
                                s.is_settled ? "text-foreground/30 line-through" : "text-[#FF6B6B]"
                              )}>
                                {formatCurrency(s.amount_owed)}
                              </span>
                              {s.is_settled ? (
                                <span className="text-emerald-500 font-bold">✓ Paid</span>
                              ) : isSplitOwner ? (
                                <motion.button
                                  whileTap={{ scale: 0.93 }}
                                  onClick={() => handleSettleActiveSplit(exp.id, s.id)}
                                  className="px-2 py-1 bg-[#FF6B6B] text-white rounded-lg font-black uppercase text-[8px] tracking-widest"
                                >
                                  PAY NOW
                                </motion.button>
                              ) : (
                                <span className="text-amber-500 text-[8px] uppercase font-black">Pending</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. EXPENSE MODAL */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddExpenseOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm clay-card p-6 relative z-10 border-2 border-foreground/5"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-black italic">Log Bill Expense</h3>
                <button onClick={() => setIsAddExpenseOpen(false)} className="opacity-20 hover:opacity-100">
                  <CheckCircle size={24} className="text-foreground/30 hover:text-foreground" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black italic opacity-25">₹</div>
                  <input 
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="Invoice Value"
                    className="w-full clay-inset bg-foreground/5 p-4.5 pl-10 text-xl font-black italic outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-2xl"
                  />
                </div>

                <input 
                  required
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  placeholder="Dinner party, taxi fare..."
                  className="w-full clay-inset bg-foreground/5 p-4 text-xs font-bold tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl"
                />

                <div className="flex gap-2 p-1 bg-foreground/5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSplitType('equal')}
                    className={cn(
                      "flex-1 text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      splitType === 'equal' ? "clay-card text-foreground" : "text-foreground/45"
                    )}
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('custom')}
                    className={cn(
                      "flex-1 text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      splitType === 'custom' ? "clay-card text-foreground" : "text-foreground/45"
                    )}
                  >
                    Custom Shares
                  </button>
                </div>

                {splitType === 'custom' && (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto p-1.5 custom-scrollbar">
                    {group.members?.map((m: any) => (
                      <div key={m.user_id} className="flex justify-between items-center text-xs">
                        <span className="font-bold opacity-60">@{m.profiles?.username || 'member'}</span>
                        <input 
                          type="number"
                          value={customSplits[m.user_id] || ''}
                          onChange={e => setCustomSplits(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                          placeholder="₹ value"
                          className="w-20 py-1.5 px-2 bg-foreground/5 border-b border-foreground/10 text-right outline-none text-xs font-black italic focus:border-coral"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-4 mt-2 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.98] text-white text-xs uppercase tracking-widest"
                >
                  Confirm Split
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, cn } from '../lib/utils';
import { 
  History as HistoryIcon, Target, Users, 
  TrendingUp, Trash2, Eraser, Plus, Minus, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  format, parseISO, isWithinInterval, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  subDays, isSameDay
} from 'date-fns';
import PullToRefresh from '../components/PullToRefresh';
import { 
  XAxis, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import toast from 'react-hot-toast';

export default function TransactionHistory() {
  const { transactions, currentUser, refreshData, deleteTransaction, clearAllHistory } = useStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [filter, setFilter] = useState<'all' | 'solo' | 'group' | 'emergency'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('all');
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string | 'all';
  }>({ isOpen: false, id: '' });

  const handleConfirmAction = async () => {
    try {
      if (confirmDelete.id === 'all') {
        await clearAllHistory();
        toast.success('History cleared. All balances reset.');
      } else {
        await deleteTransaction(confirmDelete.id);
        toast.success('Transaction deleted');
      }
      setConfirmDelete({ isOpen: false, id: '' });
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filter === 'all' || tx.goalType === filter;
      const date = parseISO(tx.timestamp);
      let matchesTime = true;
      
      if (timeFilter === 'month') {
        matchesTime = isWithinInterval(date, { 
          start: startOfMonth(new Date()), 
          end: endOfMonth(new Date()) 
        });
      } else if (timeFilter === 'week') {
        matchesTime = isWithinInterval(date, { 
          start: startOfWeek(new Date()), 
          end: endOfWeek(new Date()) 
        });
      }
      
      return matchesType && matchesTime;
    });
  }, [transactions, filter, timeFilter]);

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const saved = filteredTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawn = filteredTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const avg = filteredTransactions.length > 0 ? total / filteredTransactions.length : 0;
    
    const categories: Record<string, number> = {};
    filteredTransactions.forEach(tx => {
      if (tx.amount > 0) {
        categories[tx.category] = (categories[tx.category] || 0) + tx.amount;
      }
    });
    
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    return { total, saved, withdrawn, avg, topCategory };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayTotal = transactions
        .filter(tx => isSameDay(parseISO(tx.timestamp), date))
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        name: format(date, 'EEE'),
        amount: dayTotal
      };
    });
    return last7Days;
  }, [transactions]);

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="space-y-10 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#FF6B6B] font-bold uppercase tracking-[0.25em]">Statement</span>
            <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mt-1">History</h2>
          </div>
          <button 
            onClick={() => setConfirmDelete({ isOpen: true, id: 'all' })}
            className="p-4 bg-white/60 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-2xl text-red-500/80 hover:text-red-500 hover:bg-black/[0.02] dark:hover:bg-white/[0.06] transition-all cursor-pointer shadow-sm"
            title="Clear all history"
          >
            <Eraser size={20} />
          </button>
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmDelete.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDelete({ isOpen: false, id: '' })}
                className="absolute inset-0 bg-black/40 dark:bg-[#0a0a0f]/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-[2.5rem] p-8 space-y-6 text-center shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Trash2 size={28} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {confirmDelete.id === 'all' ? 'Clear All History?' : 'Delete Transaction?'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-[#94A3B8]/60 leading-relaxed">
                    {confirmDelete.id === 'all' 
                      ? 'This will delete ALL transactions and reset ALL goal balances to zero. This cannot be undone.' 
                      : 'This transaction will be permanently removed and goal balance will be updated. This cannot be undone.'}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmDelete({ isOpen: false, id: '' })}
                    className="flex-1 h-12 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmAction}
                    className="flex-1 h-12 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[rgba(255,107,107,0.35)] transition-all cursor-pointer"
                  >
                    {confirmDelete.id === 'all' ? 'Clear All' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Stats Overview */}
        <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 rounded-2xl relative overflow-hidden shadow-sm dark:shadow-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF6B6B]/5 rounded-full -mr-24 -mt-24 blur-3xl" />
          <div className="grid grid-cols-2 gap-10 relative z-10">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-[0.2em] mb-2">Net Savings</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-white">
                {formatCurrency(stats.total, currentUser?.preferences?.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-[0.2em] mb-2">Withdrawn</p>
              <p className="text-3xl font-black text-[#FF6B6B]">
                {formatCurrency(stats.withdrawn, currentUser?.preferences?.currency)}
              </p>
            </div>
          </div>
          
          <div className="mt-10 h-44 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: isDark ? '#ffffff' : '#1e293b', opacity: 0.4, fontSize: 10, fontWeight: '700' }}
                  dy={15}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#111118' : '#ffffff', 
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', 
                    borderRadius: '16px',
                    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.06)',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#FF6B6B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  cursor={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#FF6B6B" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-6">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {['all', 'solo', 'group', 'emergency'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap cursor-pointer",
                  filter === f 
                    ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-lg shadow-[rgba(255,107,107,0.15)]" 
                    : "bg-white/60 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] text-zinc-500 dark:text-[#94A3B8]/60 hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                )}
              >
                {f}
              </button>
            ))}
            <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1 self-center" />
            {['all', 'month', 'week'].map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f as any)}
                className={cn(
                  "px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap cursor-pointer",
                  timeFilter === f 
                    ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-lg shadow-[rgba(255,107,107,0.15)]" 
                    : "bg-white/60 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] text-zinc-500 dark:text-[#94A3B8]/60 hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                )}
              >
                {f === 'all' ? 'All Time' : f === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredTransactions.length === 0 ? (
              <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-20 text-center rounded-2xl opacity-60">
                <HistoryIcon className="w-16 h-16 mx-auto mb-6 text-zinc-400 dark:text-[#94A3B8]" />
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 dark:text-[#94A3B8]">No transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx, i) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-5 rounded-2xl flex items-center justify-between group hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={cn(
                      "w-12 h-12 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                      tx.amount < 0 ? "text-[#FF6B6B]" : "text-emerald-400"
                    )}>
                      {tx.amount < 0 ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">{tx.goalName}</h4>
                      <p className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/40 font-bold uppercase tracking-[0.2em] mt-1">
                        {tx.type === 'withdrawal' ? 'Withdrawal' : 'Contribution'} • {format(parseISO(tx.timestamp), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="text-right">
                      <p className={cn(
                        "font-black text-base tracking-tight",
                        tx.amount < 0 ? "text-[#FF6B6B]" : "text-emerald-400"
                      )}>
                        {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), currentUser?.preferences?.currency)}
                      </p>
                      <span className="inline-block text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-[#94A3B8]/40 bg-black/[0.02] dark:bg-white/[0.03] px-2 py-0.5 border border-black/[0.06] dark:border-white/[0.05] rounded-lg mt-1">
                        {tx.goalType}
                      </span>
                    </div>
                    <button 
                      onClick={() => setConfirmDelete({ isOpen: true, id: tx.id })}
                      className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] text-zinc-400 dark:text-[#94A3B8]/30 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

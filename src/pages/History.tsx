/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency, cn } from '../lib/utils';
import { 
  History, Filter, Target, Users, 
  Calendar, TrendingUp, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { 
  format, parseISO, isWithinInterval, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  subDays, isSameDay
} from 'date-fns';
import PullToRefresh from '../components/PullToRefresh';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

export default function TransactionHistory() {
  const { transactions, currentUser, refreshData } = useStore();
  const [filter, setFilter] = useState<'all' | 'solo' | 'group'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filter === 'all' || tx.type === filter;
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
        <h2 className="text-3xl font-bold text-foreground tracking-tight">History</h2>

      {/* Stats Overview */}
      <div className="clay p-8 relative overflow-hidden bg-surface">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#4ECDC4]/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="grid grid-cols-2 gap-10 relative z-10">
          <div>
            <p className="text-[10px] opacity-20 font-black uppercase tracking-[0.2em] mb-2">Net Savings</p>
            <p className="text-3xl font-black text-[#4ECDC4]">
              {formatCurrency(stats.total, currentUser?.preferences.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] opacity-20 font-black uppercase tracking-[0.2em] mb-2">Withdrawn</p>
            <p className="text-3xl font-black text-[#FF6B6B]">
              {formatCurrency(stats.withdrawn, currentUser?.preferences.currency)}
            </p>
          </div>
        </div>
        
        <div className="mt-10 h-56 w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4ECDC4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'currentColor', opacity: 0.2, fontSize: 10, fontWeight: '900' }}
                dy={15}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--surface)', 
                  border: 'none', 
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                  padding: '12px'
                }}
                itemStyle={{ color: '#4ECDC4', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#4ECDC4" 
                strokeWidth={4}
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
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4">
          {['all', 'solo', 'group'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap active:scale-95",
                filter === f ? "clay-coral text-white shadow-2xl" : "clay-card opacity-30 hover:opacity-50"
              )}
            >
              {f}
            </button>
          ))}
          <div className="w-px h-10 bg-foreground/5 mx-2 self-center" />
          {['all', 'month', 'week'].map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f as any)}
              className={cn(
                "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap active:scale-95",
                timeFilter === f ? "clay-coral text-white shadow-2xl" : "clay-card opacity-30 hover:opacity-50"
              )}
            >
              {f === 'all' ? 'All Time' : f === 'month' ? 'Month' : 'Week'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="clay p-20 text-center opacity-20">
              <History className="w-16 h-16 mx-auto mb-6 text-foreground" />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-foreground">No transactions found</p>
            </div>
          ) : (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="clay p-6 flex items-center justify-between group hover:bg-foreground/5 transition-colors"
              >
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl clay-inset flex items-center justify-center transition-transform group-hover:scale-110",
                    tx.type === 'solo' ? "text-[#FF6B6B]" : "text-[#4ECDC4]"
                  )}>
                    {tx.type === 'solo' ? <Target size={28} /> : <Users size={28} />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground tracking-tight">{tx.goalName}</h4>
                    <p className="text-[9px] opacity-20 font-black uppercase tracking-[0.2em] mt-1.5">
                      {tx.amount < 0 ? 'Withdrawal' : 'Contribution'} • {format(parseISO(tx.timestamp), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-black text-lg tracking-tight",
                    tx.amount < 0 ? "text-[#FF6B6B]" : "text-[#4ECDC4]"
                  )}>
                    {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), currentUser?.preferences.currency)}
                  </p>
                  <span className="inline-block text-[8px] font-black uppercase tracking-[0.2em] opacity-10 px-2 py-1 clay-inset rounded-lg mt-1">
                    {tx.type}
                  </span>
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

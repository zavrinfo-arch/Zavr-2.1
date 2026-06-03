import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, Coins, Plus, CheckCircle, 
  AlertTriangle, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, 
  Handshake, DollarSign
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { useDashboardStats } from './useDashboardStats';
import DebtActivity from './DebtActivity';
import FriendBreakdown from './FriendBreakdown';

interface DashboardStatsProps {
  onNewZettl: () => void;
}

export default function DashboardStats({ onNewZettl }: DashboardStatsProps) {
  const { currentUser } = useStore();
  const currencySymbol = currentUser?.preferences?.currency || 'INR';

  const {
    totalLent,
    totalBorrowed,
    netBalance,
    totalActiveDebts,
    whoOwesMe,
    iOweThem,
    recentActivity,
    monthlyTrend,
    statusDistribution,
    loading,
    settleAll,
    settleFriendDebts
  } = useDashboardStats();

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="clay p-3 bg-surface border border-foreground/5 text-xs rounded-xl shadow-lg">
          <p className="font-bold text-[10px] uppercase tracking-wider text-foreground/45 mb-1">{label}</p>
          <p className="text-emerald-400 font-bold flex items-center gap-1.5">
            Lent: <span className="font-mono">{formatCurrency(payload[0].value, currencySymbol)}</span>
          </p>
          <p className="text-red-400 font-bold flex items-center gap-1.5">
            Borrowed: <span className="font-mono">{formatCurrency(payload[1].value, currencySymbol)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // 1. Loading Skeletons
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Main stats cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="clay-inset p-5 h-28 bg-foreground/3 rounded-2xl flex flex-col justify-between" />
          ))}
        </div>

        {/* Charts & Actions skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 clay p-6 h-72 bg-foreground/3 rounded-2xl" />
          <div className="clay p-6 h-72 bg-foreground/3 rounded-2xl" />
        </div>

        {/* Friend breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="clay p-6 h-80 bg-foreground/3 rounded-2xl" />
          <div className="clay p-6 h-80 bg-foreground/3 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-foreground">

      {/* QUICK QUICK ACTIONS CONTROL PANEL */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 clay bg-surface/50 rounded-2xl">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Zettl Stats Hub</h2>
          <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mt-0.5">Real-time ledger analytics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Settle All action (only if there are active debts) */}
          {totalActiveDebts > 0 && (
            <button
              onClick={settleAll}
              className="px-4 py-2 bg-foreground/5 hover:bg-emerald-500/10 hover:text-emerald-400 border border-foreground/5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Handshake size={12} />
              Settle All
            </button>
          )}
          {/* New Zettl action */}
          <button
            onClick={onNewZettl}
            className="px-4 py-2 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:shadow-[#FF6B6B]/25 hover:scale-102 transition-all active:scale-98 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={12} className="stroke-[3px]" />
            New Zettl
          </button>
        </div>
      </div>

      {/* 1. DEBT SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Lent */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="clay p-5 bg-surface relative overflow-hidden group border-b-2 border-emerald-500/25"
        >
          <div className="absolute top-3 right-3 w-7 h-7 rounded-lg clay-inset bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ArrowUpRight size={14} className="stroke-[2.5px]" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Money Owed To You</p>
          <h3 className="text-xl font-black mt-3 text-emerald-400 tracking-tight">
            {formatCurrency(totalLent, currencySymbol)}
          </h3>
          <p className="text-[8px] font-bold opacity-20 uppercase tracking-wider mt-1">Lent to friends</p>
        </motion.div>

        {/* Total Borrowed */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="clay p-5 bg-surface relative overflow-hidden group border-b-2 border-red-500/25"
        >
          <div className="absolute top-3 right-3 w-7 h-7 rounded-lg clay-inset bg-red-500/10 text-red-100 flex items-center justify-center">
            <ArrowDownLeft size={14} className="stroke-[2.5px]" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-30">You Owe Others</p>
          <h3 className="text-xl font-black mt-3 text-red-500 tracking-tight">
            {formatCurrency(totalBorrowed, currencySymbol)}
          </h3>
          <p className="text-[8px] font-bold opacity-20 uppercase tracking-wider mt-1">Borrowed from friends</p>
        </motion.div>

        {/* Net Balance */}
        <motion.div 
          whileHover={{ y: -2 }}
          className={`clay p-5 bg-surface relative overflow-hidden group border-b-2 ${
            netBalance >= 0 ? "border-emerald-500/25" : "border-red-500/25"
          }`}
        >
          <div className={`absolute top-3 right-3 w-7 h-7 rounded-lg clay-inset flex items-center justify-center ${
            netBalance >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}>
            {netBalance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Net Balance</p>
          <h3 className={`text-xl font-black mt-3 tracking-tight ${
            netBalance >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance, currencySymbol)}
          </h3>
          <p className="text-[8px] font-bold opacity-20 uppercase tracking-wider mt-1">Overall standing</p>
        </motion.div>

        {/* Total Active Debts */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="clay p-5 bg-surface relative overflow-hidden group border-b-2 border-indigo-500/25"
        >
          <div className="absolute top-3 right-3 w-7 h-7 rounded-lg clay-inset bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Coins size={14} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Active Debts</p>
          <h3 className="text-xl font-black mt-3 text-indigo-400 tracking-tight">
            {totalActiveDebts} <span className="text-[10px] font-normal opacity-50 uppercase tracking-widest">Zettls</span>
          </h3>
          <p className="text-[8px] font-bold opacity-20 uppercase tracking-wider mt-1">Pending payout cycles</p>
        </motion.div>

      </div>

      {/* 2. MONTHLY TREND & STATUS DISTRIBUTION BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Monthly Trend Chart */}
        <div className="md:col-span-2 clay p-6 bg-surface">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg clay-inset bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Transaction Trend</h3>
                <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Lent vs Borrowed (Last 6 Months)</p>
              </div>
            </div>
            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[8.5px] font-black uppercase tracking-widest opacity-75">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-emerald-500 shrink-0" />
                <span>Lent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-[#FF6B6B] shrink-0" />
                <span>Borrowed</span>
              </div>
            </div>
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis 
                  dataKey="month" 
                  stroke="currentColor" 
                  className="opacity-25 text-[9px] font-black"
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="currentColor" 
                  className="opacity-25 text-[9px] font-black font-mono"
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                <Bar dataKey="Lent" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={true} animationDuration={1200} animationBegin={150} />
                <Bar dataKey="Borrowed" fill="#FF6B6B" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={true} animationDuration={1200} animationBegin={300} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Debt Status Distribution */}
        <div className="clay p-6 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg clay-inset bg-pink-500/10 text-pink-400 flex items-center justify-center">
                <CheckCircle size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Status Split</h3>
                <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Lifespan ratio of all debts</p>
              </div>
            </div>

            {/* Visual Multi-Segment Stacked Progress Bar */}
            <div className="h-3 rounded-full overflow-hidden clay-inset bg-foreground/5 flex w-full mb-6">
              {statusDistribution.total === 0 ? (
                <div className="h-full bg-foreground/15 w-full" />
              ) : (
                <>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${statusDistribution.paidPercent}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-emerald-500" 
                    title={`Paid: ${statusDistribution.paidPercent}%`}
                  />
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${statusDistribution.pendingPercent}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                    className="h-full bg-yellow-500" 
                    title={`Pending: ${statusDistribution.pendingPercent}%`}
                  />
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${statusDistribution.overduePercent}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    className="h-full bg-[#FF6B6B]" 
                    title={`Overdue: ${statusDistribution.overduePercent}%`}
                  />
                </>
              )}
            </div>

            {/* List breakdown counters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Paid</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">{statusDistribution.paidCount} Zettls</p>
                  <p className="text-[8px] font-black uppercase text-emerald-400">{statusDistribution.paidPercent}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Pending</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">{statusDistribution.pendingCount} Zettls</p>
                  <p className="text-[8px] font-black uppercase text-yellow-500">{statusDistribution.pendingPercent}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B] shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Overdue</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">{statusDistribution.overdueCount} Zettls</p>
                  <p className="text-[8px] font-black uppercase text-[#FF6B6B]">{statusDistribution.overduePercent}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-foreground/5 text-center">
            <span className="text-[8.5px] font-black uppercase tracking-widest opacity-30">
              Total history: {statusDistribution.total} transactions
            </span>
          </div>
        </div>

      </div>

      {/* 3. BREAKDOWN BY FRIEND (WHO OWES / I OWE) */}
      <FriendBreakdown
        whoOwesMe={whoOwesMe}
        iOweThem={iOweThem}
        onSettleFriend={settleFriendDebts}
        currencySymbol={currencySymbol}
      />

      {/* 4. ACTIVITY TIMELINE */}
      <DebtActivity activities={recentActivity} />

    </div>
  );
}

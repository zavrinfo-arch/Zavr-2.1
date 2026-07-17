/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Sparkles, Target, Calculator, TrendingUp, Flame, Trophy, ChevronRight,
  Plus, Minus, Clock, Users, Eye, EyeOff
} from 'lucide-react';
import GamingDashboard from '../components/GamingDashboard';
import { formatCurrency, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { startOfDay, startOfWeek, startOfMonth, isAfter, parseISO, differenceInDays, format } from 'date-fns';

export default function Home({ onAddMoney, onWithdraw }: {
  onAddMoney: (goalId: string, type: 'solo' | 'group' | 'emergency', amount?: number) => void;
  onWithdraw: (goalId: string, type: 'solo' | 'group' | 'emergency') => void;
}) {
  const navigate = useNavigate();
  const { 
    currentUser, soloGoals, groupGoals, emergencyGoals,
    streakData, weeklyChallenge, transactions 
  } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gaming'>('dashboard');
  const [hideSavings, setHideSavings] = useState(true);

  const totalSavings = useMemo(() => {
    const soloTotal = soloGoals.reduce((sum, g) => sum + g.currentAmount, 0);
    const emergencyTotal = emergencyGoals.reduce((sum, g) => sum + g.currentAmount, 0);
    const groupTotal = groupGoals.reduce((sum, g) => {
      const myContr = g.members.find(m => m.userId === currentUser?.id)?.contributed || 0;
      return sum + myContr;
    }, 0);
    return soloTotal + emergencyTotal + groupTotal;
  }, [soloGoals, groupGoals, emergencyGoals, currentUser]);

  const activeGoals = [...soloGoals, ...groupGoals, ...emergencyGoals].filter(g => !g.completed);
  const waitingGoals = [...soloGoals, ...groupGoals, ...emergencyGoals].filter(g => g.completed);

  const getNeededThisPeriod = (goal: any) => {
    if (!goal.frequency || goal.completed) return 0;
    
    // For emergency goals, we use target / some arbitrary period or just the routine amount
    // The user said "select the amount they needed to save and saving routine"
    // So target is total, frequency is routine. 
    // We need to know how many periods. Since no deadline, maybe we assume a default or just use the target/frequency?
    // Actually, the user said "select the amount they needed to save and saving routine".
    // Let's assume the "target" is the total goal, and we need a "routine amount".
    // Wait, the PlusModal I wrote just has "target". I should probably add "routineAmount" or calculate it.
    // If no deadline, we can't calculate "needed". 
    // Let's assume for emergency goals, the user specifies a "Routine Amount" instead of a deadline.
    
    if ('deadline' in goal) {
      const days = differenceInDays(parseISO(goal.deadline), new Date());
      if (days <= 0) return 0;
      let periods = 1;
      if (goal.frequency === 'daily') periods = days;
      else if (goal.frequency === 'weekly') periods = Math.ceil(days / 7);
      else if (goal.frequency === 'monthly') periods = Math.ceil(days / 30);
      
      const remaining = goal.targetAmount - ('totalCollected' in goal ? goal.totalCollected : goal.currentAmount);
      return Math.ceil(remaining / Math.max(1, periods));
    }
    
    // For Emergency goals (no deadline), let's assume a default period of 12 months if not specified
    // Or better, let's just use a fixed routine of 10% of target per month?
    // User said: "select the amount they needed to save and saving routine"
    // I'll update PlusModal to include a routine amount for emergency goals.
    return goal.routineAmount || Math.ceil(goal.targetAmount / 10); 
  };

  const getContributedThisPeriod = (goalId: string, frequency: string) => {
    const now = new Date();
    let start;
    if (frequency === 'daily') start = startOfDay(now);
    else if (frequency === 'weekly') start = startOfWeek(now);
    else start = startOfMonth(now);

    return transactions
      .filter(t => t.goalId === goalId && isAfter(parseISO(t.timestamp), start) && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const isGamingTab = activeTab === 'gaming';

  if (isGamingTab) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 lg:p-12 pb-32">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="serif-heading text-4xl">Gaming Hub</h2>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="px-6 py-2 clay text-xs font-bold hover:bg-foreground/5 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <GamingDashboard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0f] text-zinc-900 dark:text-white pb-32">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/60 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-2xl mb-10 shadow-sm">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex-1 py-3 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest cursor-pointer",
              activeTab === 'dashboard' ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-lg shadow-[rgba(255,107,107,0.35)]" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-100 hover:text-zinc-800 dark:hover:text-white"
            )}
          >
            Finance
          </button>
          <button 
            onClick={() => setActiveTab('gaming')}
            className={cn(
              "flex-1 py-3 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer",
              isGamingTab ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-lg shadow-[rgba(255,107,107,0.35)]" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-100 hover:text-zinc-800 dark:hover:text-white"
            )}
          >
            Gaming
            <Flame size={12} className={isGamingTab ? "text-white" : "text-[#FF6B6B]"} />
          </button>
        </div>

        {/* Total Savings Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 rounded-2xl relative overflow-hidden group shadow-sm dark:shadow-xl"
        >
          {/* Subtle Glow background */}
          <div className="absolute -right-20 -top-20 w-48 h-48 bg-[#FF6B6B]/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-[#FF7C7C]/5 blur-[80px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-500 dark:text-[#94A3B8] uppercase tracking-[0.2em]">Total Savings</p>
              <button
                onClick={() => setHideSavings(!hideSavings)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-600 dark:text-[#94A3B8] dark:hover:text-white transition-all cursor-pointer flex items-center justify-center"
                aria-label={hideSavings ? "Show savings" : "Hide savings"}
              >
                {hideSavings ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex items-baseline gap-4">
              <h2 className="text-4xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">
                {hideSavings ? (
                  `${formatCurrency(0, currentUser?.preferences?.currency).replace(/[0-9\s,.]/g, '')} ---`
                ) : (
                  formatCurrency(totalSavings, currentUser?.preferences?.currency)
                )}
              </h2>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#10b981]/10 text-[#10b981] text-[10px] font-bold">
                <TrendingUp size={12} />
                +12%
              </div>
            </div>
          </div>
          {/* Decorative Sparkline-like background */}
          <div className="absolute bottom-0 right-0 w-full h-24 opacity-15 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full preserve-3d">
              <path d="M0,80 Q25,20 50,70 T100,30" fill="none" stroke="#FF6B6B" strokeWidth="2" />
            </svg>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Streak Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-6 rounded-2xl relative overflow-hidden shadow-sm dark:shadow-lg"
          >
            <div className="absolute top-2 right-2">
              <div className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-[rgba(255,107,107,0.15)]">Bronze</div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-[#FF6B6B]">
                <Flame size={20} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-white">{streakData.currentStreak}</p>
                  <p className="text-[8px] font-bold text-[#FF6B6B] uppercase tracking-widest">X{streakData.multiplier} XP</p>
                </div>
                <p className="text-[9px] font-bold text-zinc-400 dark:text-[#94A3B8]/60 uppercase tracking-widest mt-1">Current Streak</p>
              </div>
              <div className="h-1.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(streakData.currentStreak % 7) * 14.28}%` }}
                  className="h-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B]"
                />
              </div>
            </div>
          </motion.div>

          {/* Weekly Challenge Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-6 rounded-2xl relative overflow-hidden shadow-sm dark:shadow-lg"
          >
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-[#e2b05e]">
                <Trophy size={20} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-tight truncate max-w-[80px]">
                    {weeklyChallenge?.title || 'Save ₹500'}
                  </p>
                  <p className="text-[8px] font-bold text-[#e2b05e] uppercase tracking-widest">+{weeklyChallenge?.rewardXP || 150} XP</p>
                </div>
                <p className="text-[9px] font-bold text-zinc-400 dark:text-[#94A3B8]/60 uppercase tracking-widest mt-1">Weekly Challenge</p>
              </div>
              <div className="h-1.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((weeklyChallenge?.progress || 0) / (weeklyChallenge?.target || 1)) * 100}%` }}
                  className="h-full bg-gradient-to-r from-[#e2b05e] to-yellow-500"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Active Goals Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Active Goals</h3>
            <button 
              onClick={() => navigate('/goals')}
              className="flex items-center gap-1 text-[10px] font-bold text-[#FF6B6B] hover:text-[#FF7C7C] transition-colors uppercase tracking-widest cursor-pointer"
            >
              View All <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
            {activeGoals.length === 0 ? (
              <div className="w-full bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-12 text-center rounded-2xl shadow-sm opacity-60">
                <Target size={32} className="mx-auto mb-4 text-[#94A3B8]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">No active goals</p>
              </div>
            ) : (
              activeGoals.map((goal) => (
                <motion.div 
                  key={goal.id}
                  whileHover={{ y: -4 }}
                  className="min-w-[290px] bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-6 rounded-2xl space-y-6 shadow-sm dark:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center",
                        'members' in goal ? "text-[#4ECDC4]" : "text-[#FF6B6B]"
                      )}>
                        {'members' in goal ? <Users size={20} /> : <Target size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{goal.name}</h4>
                        <p className="text-[9px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest">
                          {'members' in goal ? 'Group' : 'Solo'}
                        </p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.05] text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8] uppercase">
                      Active
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]">
                      <span>{('targetAmount' in goal) ? 'Progress' : 'Total Saved'}</span>
                      {('targetAmount' in goal) && (
                        <span className="text-zinc-800 dark:text-white font-bold">{Math.round((('totalCollected' in goal ? goal.totalCollected : goal.currentAmount) / goal.targetAmount) * 100)}%</span>
                      )}
                    </div>
                    {('targetAmount' in goal) ? (
                      <div className="h-1.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (('totalCollected' in goal ? goal.totalCollected : goal.currentAmount) / goal.targetAmount) * 100)}%` }}
                          className={cn(
                            "h-full rounded-full",
                            'members' in goal ? "bg-gradient-to-r from-[#4ECDC4] to-[#20968F]" : "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B]"
                          )}
                        />
                      </div>
                    ) : (
                      <div className="text-xl font-extrabold text-zinc-900 dark:text-white">
                        {formatCurrency(goal.currentAmount, currentUser?.preferences?.currency)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {(() => {
                      const needed = getNeededThisPeriod(goal);
                      const contributed = getContributedThisPeriod(goal.id, goal.frequency);
                      const remaining = Math.max(0, needed - contributed);
                      const type = 'members' in goal ? 'group' : ('deadline' in goal ? 'solo' : 'emergency');

                      if (remaining > 0) {
                        return (
                          <div className="space-y-3">
                            <div className="p-4 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] rounded-xl text-center">
                              <p className="text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-[0.2em] mb-1">To add this {goal.frequency || 'period'}</p>
                              <p className="text-xl font-black text-[#FF6B6B] shadow-sm">
                                {formatCurrency(remaining, currentUser?.preferences?.currency)}
                              </p>
                            </div>
                            <button 
                              onClick={() => onAddMoney(goal.id, type, remaining)}
                              className="w-full h-11 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:shadow-[0_6px_20px_rgba(255,107,107,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                            >
                              <Plus size={14} /> Add {formatCurrency(remaining, currentUser?.preferences?.currency)}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-xl">
                            <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => onAddMoney(goal.id, type)}
                              className="flex-1 h-11 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:shadow-[0_6px_20px_rgba(255,107,107,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white rounded-xl cursor-pointer"
                            >
                              <Plus size={14} /> Add More
                            </button>
                            <button 
                              onClick={() => onWithdraw(goal.id, type)}
                              className="flex-1 h-11 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-300 rounded-xl text-zinc-700 dark:text-white cursor-pointer"
                            >
                              <Minus size={14} /> Withdraw
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Waiting for you Section */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Waiting for you</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
            {waitingGoals.length === 0 ? (
              <div className="w-full bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-12 text-center rounded-2xl opacity-60 shadow-sm">
                <Clock size={32} className="mx-auto mb-4 text-[#94A3B8]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Nothing waiting</p>
              </div>
            ) : (
              waitingGoals.map((goal) => (
                <motion.div 
                  key={goal.id}
                  className="min-w-[280px] bg-white dark:bg-white/[0.01] border border-black/[0.06] dark:border-white/[0.04] backdrop-blur-md p-6 rounded-2xl space-y-6 opacity-60 dark:opacity-40 grayscale"
                >
                  {/* Same card content as above but muted */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center opacity-20 text-zinc-900 dark:text-white">
                        <Target size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{goal.name}</h4>
                        <p className="text-[9px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest">Completed</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-black/[0.02] dark:bg-white/[0.02] rounded-full overflow-hidden">
                    <div className="h-full w-full bg-black/[0.06] dark:bg-white/[0.1]" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tools */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Target, label: 'Goals', color: '#e2b05e', action: () => navigate('/goals') },
            { icon: Clock, label: 'History', color: '#4ECDC4', action: () => navigate('/history') },
          ].map((tool, i) => (
            <button 
              key={i}
              onClick={tool.action}
              className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-6 rounded-2xl flex items-center gap-4 hover:bg-black/[0.01] dark:hover:bg-white/[0.06] hover:border-black/10 dark:hover:border-white/[0.12] transition-all duration-300 group active:scale-95 cursor-pointer text-left w-full shadow-sm dark:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ color: tool.color }}>
                <tool.icon size={20} />
              </div>
              <h4 className="font-bold text-xs text-zinc-900 dark:text-white opacity-90">{tool.label}</h4>
            </button>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Recent Activity</h3>
            <button 
              onClick={() => navigate('/history')}
              className="text-[10px] font-bold text-zinc-400 dark:text-[#94A3B8]/60 hover:text-zinc-800 dark:hover:text-white transition-colors uppercase tracking-widest cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 3).map((tx) => (
              <div key={tx.id} className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-4 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-md">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center",
                    tx.type === 'deposit' ? "text-[#10b981]" : "text-[#FF6B6B]"
                  )}>
                    {tx.type === 'deposit' ? <Plus size={18} /> : <Minus size={18} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{tx.goalName}</h4>
                    <p className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest">
                      {format(parseISO(tx.timestamp), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <p className={cn(
                  "font-bold text-sm",
                  tx.type === 'deposit' ? "text-[#10b981]" : "text-[#FF6B6B]"
                )}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, currentUser?.preferences?.currency)}
                </p>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 text-center rounded-2xl opacity-60 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">No recent activity</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Sparkles, Target, Calculator, PieChart as PieIcon, 
  MessageSquare, TrendingUp, Flame, Trophy, ChevronRight,
  Plus, Minus, Clock, Users
} from 'lucide-react';
import SalarySplitter from '../components/SalarySplitter';
import GamingDashboard from '../components/GamingDashboard';
import { formatCurrency, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { startOfDay, startOfWeek, startOfMonth, isAfter, parseISO, differenceInDays } from 'date-fns';

export default function Home({ onAddMoney, onWithdraw }: {
  onAddMoney: (goalId: string, type: 'solo' | 'group' | 'emergency', amount?: number) => void;
  onWithdraw: (goalId: string, type: 'solo' | 'group' | 'emergency') => void;
}) {
  const navigate = useNavigate();
  const { 
    currentUser, soloGoals, groupGoals, emergencyGoals,
    streakData, weeklyChallenge, transactions 
  } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gaming' | 'splitter'>('dashboard');

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

  if (activeTab === 'gaming') {
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

  if (activeTab === 'splitter') {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 lg:p-12 pb-32">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="serif-heading text-4xl">Salary Splitter</h2>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="px-6 py-2 clay text-xs font-bold hover:bg-foreground/5 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <SalarySplitter />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* Tab Switcher */}
        <div className="flex p-1 clay-inset mb-10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
              activeTab === 'dashboard' ? "bg-surface text-foreground shadow-xl" : "opacity-30"
            )}
          >
            Finance
          </button>
          <button 
            onClick={() => setActiveTab('gaming')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2",
              activeTab === 'gaming' ? "bg-surface text-foreground shadow-xl" : "opacity-30"
            )}
          >
            Gaming
            <Flame size={12} className={activeTab === 'gaming' ? "text-orange-500" : ""} />
          </button>
          <button 
            onClick={() => setActiveTab('splitter')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
              activeTab === 'splitter' ? "bg-surface text-foreground shadow-xl" : "opacity-30"
            )}
          >
            Splitter
          </button>
        </div>

        {/* Total Savings Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="clay p-8 bg-gradient-to-br from-surface to-surface-light relative overflow-hidden group"
        >
          <div className="relative z-10 space-y-4">
            <p className="text-[10px] font-black opacity-20 uppercase tracking-[0.2em]">Total Savings</p>
            <div className="flex items-baseline gap-4">
              <h2 className="text-5xl font-black tracking-tighter">
                {formatCurrency(totalSavings, currentUser?.preferences.currency)}
              </h2>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#4ECDC4]/10 text-[#4ECDC4] text-[10px] font-black">
                <TrendingUp size={12} />
                +12%
              </div>
            </div>
          </div>
          {/* Decorative Sparkline-like background */}
          <div className="absolute bottom-0 right-0 w-full h-24 opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full preserve-3d">
              <path d="M0,80 Q25,20 50,70 T100,30" fill="none" stroke="#4ECDC4" strokeWidth="2" />
            </svg>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Streak Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="clay-card p-6 bg-surface relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2">
              <div className="clay-coral text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Bronze</div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center text-[#FF6B6B]">
                <Flame size={20} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-3xl font-black">{streakData.currentStreak}</p>
                  <p className="text-[8px] font-black text-[#FF6B6B] uppercase tracking-widest">X{streakData.multiplier} XP</p>
                </div>
                <p className="text-[9px] font-black opacity-20 uppercase tracking-widest mt-1">Current Streak</p>
              </div>
              <div className="h-1.5 w-full clay-inset overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(streakData.currentStreak % 7) * 14.28}%` }}
                  className="h-full bg-[#FF6B6B]"
                />
              </div>
            </div>
          </motion.div>

          {/* Weekly Challenge Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="clay-card p-6 bg-surface"
          >
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center text-[#E2B05E]">
                <Trophy size={20} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[10px] font-black opacity-80 uppercase tracking-tight truncate max-w-[80px]">
                    {weeklyChallenge?.title || 'Save ₹500'}
                  </p>
                  <p className="text-[8px] font-black text-[#E2B05E] uppercase tracking-widest">+{weeklyChallenge?.rewardXP || 150} XP</p>
                </div>
                <p className="text-[9px] font-black opacity-20 uppercase tracking-widest mt-1">Weekly Challenge</p>
              </div>
              <div className="h-1.5 w-full clay-inset overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((weeklyChallenge?.progress || 0) / (weeklyChallenge?.target || 1)) * 100}%` }}
                  className="h-full bg-[#E2B05E]"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Active Goals Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight serif-heading">Active Goals</h3>
            <button 
              onClick={() => navigate('/goals')}
              className="flex items-center gap-1 text-[10px] font-black text-[#FF6B6B] uppercase tracking-widest"
            >
              View All <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-2 px-2">
            {activeGoals.length === 0 ? (
              <div className="w-full clay-card p-12 text-center opacity-20">
                <Target size={32} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No active goals</p>
              </div>
            ) : (
              activeGoals.map((goal) => (
                <motion.div 
                  key={goal.id}
                  whileHover={{ y: -5 }}
                  className="min-w-[280px] clay-card p-6 bg-surface space-y-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl clay-inset flex items-center justify-center",
                        'members' in goal ? "text-[#4ECDC4]" : "text-[#FF6B6B]"
                      )}>
                        {'members' in goal ? <Users size={20} /> : <Target size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{goal.name}</h4>
                        <p className="text-[9px] opacity-20 font-black uppercase tracking-widest">
                          {'members' in goal ? 'Group' : 'Solo'}
                        </p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded-lg clay-inset bg-foreground/5 text-[8px] font-black opacity-40 uppercase">
                      296d left
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-20">Progress</span>
                      <span className="opacity-100">{Math.round((('totalCollected' in goal ? goal.totalCollected : goal.currentAmount) / goal.targetAmount) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full clay-inset overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (('totalCollected' in goal ? goal.totalCollected : goal.currentAmount) / goal.targetAmount) * 100)}%` }}
                        className={cn(
                          "h-full",
                          'members' in goal ? "bg-[#4ECDC4]" : "bg-[#FF6B6B]"
                        )}
                      />
                    </div>
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
                            <div className="p-4 clay-inset bg-foreground/5 text-center">
                              <p className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">Estimated money to add</p>
                              <p className="text-xl font-black text-[#FF6B6B]">
                                {formatCurrency(remaining, currentUser?.preferences.currency)}
                              </p>
                            </div>
                            <button 
                              onClick={() => onAddMoney(goal.id, type, remaining)}
                              className="w-full py-4 clay-coral text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all rounded-xl shadow-xl text-white"
                            >
                              <Plus size={14} /> Add {formatCurrency(remaining, currentUser?.preferences.currency)}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          <div className="p-4 clay-inset bg-emerald-500/5 text-center border border-emerald-500/10">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => onAddMoney(goal.id, type)}
                              className="flex-1 py-4 clay-coral text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all rounded-xl text-white shadow-lg"
                            >
                              <Plus size={14} /> Add More
                            </button>
                            <button 
                              onClick={() => onWithdraw(goal.id, type)}
                              className="flex-1 py-4 clay-inset bg-foreground/5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/10 transition-all rounded-xl"
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
          <h3 className="text-xl font-bold tracking-tight serif-heading">Waiting for you</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-2 px-2">
            {waitingGoals.length === 0 ? (
              <div className="w-full clay-card p-12 text-center opacity-20">
                <Clock size={32} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nothing waiting</p>
              </div>
            ) : (
              waitingGoals.map((goal) => (
                <motion.div 
                  key={goal.id}
                  className="min-w-[280px] clay-card p-6 bg-surface space-y-6 opacity-60 grayscale"
                >
                  {/* Same card content as above but muted */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center opacity-20">
                        <Target size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{goal.name}</h4>
                        <p className="text-[9px] opacity-20 font-black uppercase tracking-widest">Completed</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-2 w-full clay-inset overflow-hidden">
                    <div className="h-full w-full bg-foreground/10" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tools */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Calculator, label: 'Splitter', color: '#FF6B6B', action: () => setActiveTab('splitter') },
            { icon: PieIcon, label: 'Budget', color: '#4ECDC4' },
            { icon: Target, label: 'Goals', color: '#E2B05E' },
            { icon: MessageSquare, label: 'AI Chat', color: 'currentColor' },
          ].map((tool, i) => (
            <button 
              key={i}
              onClick={tool.action}
              className="clay-card p-6 flex items-center gap-4 hover:bg-foreground/5 transition-all group active:scale-95 bg-surface"
            >
              <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center group-hover:scale-110 transition-transform" style={{ color: tool.color }}>
                <tool.icon size={20} />
              </div>
              <h4 className="font-bold text-xs opacity-90">{tool.label}</h4>
            </button>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight serif-heading">Recent Activity</h3>
            <button 
              onClick={() => navigate('/history')}
              className="text-[10px] font-black opacity-20 uppercase tracking-widest"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 3).map((tx) => (
              <div key={tx.id} className="clay-card p-4 bg-surface flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl clay-inset flex items-center justify-center",
                    tx.type === 'deposit' ? "text-[#4ECDC4]" : "text-[#FF6B6B]"
                  )}>
                    {tx.type === 'deposit' ? <Plus size={18} /> : <Minus size={18} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{tx.goalName}</h4>
                    <p className="text-[9px] opacity-20 font-black uppercase tracking-widest">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className={cn(
                  "font-black text-sm",
                  tx.type === 'deposit' ? "text-[#4ECDC4]" : "text-[#FF6B6B]"
                )}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, currentUser?.preferences.currency)}
                </p>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="clay-card p-8 text-center opacity-20">
                <p className="text-[10px] font-black uppercase tracking-widest">No recent activity</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

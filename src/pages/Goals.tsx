/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Target, Users, Plus, Calendar, 
  ChevronRight, Trash2, Edit3, Copy, LogOut, UserMinus,
  MinusCircle, Bell, X
} from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';
import toast from 'react-hot-toast';
import PullToRefresh from '../components/PullToRefresh';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ShieldAlert } from 'lucide-react';

const GoalSparkline = ({ goalId, color, transactions }: { goalId: string, color: string, transactions: any[] }) => {
  const data = useMemo(() => {
    const goalTransactions = transactions
      .filter(tx => tx.goalId === goalId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    let cumulative = 0;
    const points = goalTransactions.map(tx => {
      cumulative += tx.amount;
      return { amount: Math.max(0, cumulative) };
    });

    // Add a starting point if there's only one transaction
    if (points.length === 1) {
      return [{ amount: 0 }, ...points];
    }
    return points;
  }, [goalId, transactions]);

  if (data.length < 2) return null;

  return (
    <div className="h-8 w-20 opacity-50">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke={color} 
            fill={color} 
            fillOpacity={0.1} 
            strokeWidth={2} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Goals({ onAddMoney, onWithdraw }: { 
  onAddMoney: (goalId: string, type: 'solo' | 'group' | 'emergency', amount?: number) => void;
  onWithdraw: (goalId: string, type: 'solo' | 'group' | 'emergency') => void;
}) {
  const [activeTab, setActiveTab] = useState<'solo' | 'group' | 'emergency'>('solo');
  const { 
    currentUser, soloGoals, groupGoals, emergencyGoals, transactions,
    deleteSoloGoal, leaveGroupGoal, removeGroupMember, refreshData,
    nudgeGroup, updateSoloGoal, updateGroupGoal, deleteEmergencyGoal
  } = useStore();

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    goal: any;
    type: 'solo' | 'group';
  }>({ isOpen: false, goal: null, type: 'solo' });

  const handleEditGoal = (goal: any, type: 'solo' | 'group') => {
    setEditModal({ isOpen: true, goal: { ...goal }, type });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModal.type === 'solo') {
      updateSoloGoal(editModal.goal.id, editModal.goal);
    } else {
      updateGroupGoal(editModal.goal.id, editModal.goal);
    }
    setEditModal({ isOpen: false, goal: null, type: 'solo' });
    toast.success('Goal updated!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Group ID copied!');
  };

  const calculateNeeded = (target: number, current: number, deadline: string, frequency: string) => {
    const daysLeft = differenceInDays(parseISO(deadline), new Date());
    if (daysLeft <= 0) return 0;
    
    const remaining = target - current;
    if (remaining <= 0) return 0;

    switch (frequency) {
      case 'daily':
        return remaining / daysLeft;
      case 'weekly':
        return remaining / (daysLeft / 7);
      case 'monthly':
        return remaining / (daysLeft / 30);
      default:
        return remaining / daysLeft;
    }
  };

  const getNeededThisPeriod = (goal: any) => {
    if (!goal.frequency || goal.completed) return 0;
    
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

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete-solo' | 'leave-group' | 'delete-emergency';
    id: string;
    quote?: string;
  }>({ isOpen: false, type: 'delete-solo', id: '' });

  const quotes = [
    "It does not matter how slowly you go as long as you do not stop. 🐢",
    "Success is the sum of small efforts, repeated day in and day out. ✨",
    "Don't give up. The beginning is always the hardest. 💪",
    "Your future self will thank you for not giving up today. 🚀",
    "Consistency is what transforms average into excellence. 💎"
  ];

  const handleDeleteSolo = (id: string) => {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    setConfirmModal({ isOpen: true, type: 'delete-solo', id, quote });
  };

  const handleLeaveGroup = (id: string) => {
    setConfirmModal({ isOpen: true, type: 'leave-group', id });
  };

  const confirmAction = () => {
    if (confirmModal.type === 'delete-solo') {
      deleteSoloGoal(confirmModal.id);
      toast.success('Goal deleted. Start a new journey soon!');
    } else if (confirmModal.type === 'delete-emergency') {
      deleteEmergencyGoal(confirmModal.id);
      toast.success('Emergency fund removed.');
    } else {
      leaveGroupGoal(confirmModal.id);
      toast.success('Left the group.');
    }
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="space-y-8 pb-8">
        {/* Edit Modal */}
        <AnimatePresence>
          {editModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditModal({ ...editModal, isOpen: false })}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm clay bg-surface p-8 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Edit Goal</h3>
                  <button onClick={() => setEditModal({ ...editModal, isOpen: false })} className="p-2 hover:bg-foreground/5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={saveEdit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Goal Name</label>
                    <input 
                      className="w-full clay-inset bg-foreground/5 p-4 rounded-xl text-sm outline-none focus:border-[#FF6B6B]/50 border border-transparent transition-all"
                      value={editModal.goal.name}
                      onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, name: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Target Amount</label>
                    <input 
                      type="number"
                      className="w-full clay-inset bg-foreground/5 p-4 rounded-xl text-sm outline-none focus:border-[#FF6B6B]/50 border border-transparent transition-all"
                      value={editModal.goal.targetAmount}
                      onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, targetAmount: parseInt(e.target.value) } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Deadline</label>
                    <input 
                      type="date"
                      className="w-full clay-inset bg-foreground/5 p-4 rounded-xl text-sm outline-none focus:border-[#FF6B6B]/50 border border-transparent transition-all"
                      value={editModal.goal.deadline}
                      onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, deadline: e.target.value } })}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 clay-coral text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                  >
                    Save Changes
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm clay bg-surface p-10 space-y-8 text-center"
              >
                <div className={cn(
                  "w-20 h-20 mx-auto rounded-2xl clay-inset flex items-center justify-center",
                  confirmModal.type === 'delete-solo' ? "text-[#FF6B6B]" : "text-[#E2B05E]"
                )}>
                  {confirmModal.type === 'delete-solo' ? <Trash2 size={36} /> : <LogOut size={36} />}
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {confirmModal.type === 'delete-solo' ? 'Delete Goal?' : 'Leave Group?'}
                  </h3>
                  {confirmModal.type === 'delete-solo' && (
                    <p className="text-xs italic opacity-30 px-4 leading-relaxed">
                      "{confirmModal.quote}"
                    </p>
                  )}
                  <p className="text-[11px] opacity-20 uppercase tracking-widest leading-relaxed">
                    {confirmModal.type === 'delete-solo' 
                      ? 'Are you sure you want to remove this goal? All progress will be lost.' 
                      : 'Are you sure you want to exit this group goal?'}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    className="flex-1 py-4 clay-card rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all"
                  >
                    No, Stay
                  </button>
                  <button 
                    onClick={confirmAction}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all active:scale-95",
                      confirmModal.type === 'delete-solo' ? "clay-coral" : "bg-[#E2B05E]"
                    )}
                  >
                    Yes, {confirmModal.type === 'delete-solo' ? 'Delete' : 'Leave'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">My Goals</h2>
        <div className="flex p-1 clay-inset w-fit">
          <button 
            onClick={() => setActiveTab('solo')}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === 'solo' ? "clay-coral text-white" : "opacity-20"
            )}
          >
            Solo
          </button>
          <button 
            onClick={() => setActiveTab('group')}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === 'group' ? "clay-teal text-black" : "opacity-20"
            )}
          >
            Group
          </button>
          <button 
            onClick={() => setActiveTab('emergency')}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === 'emergency' ? "bg-[#E2B05E] text-black" : "opacity-20"
            )}
          >
            Emergency
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'solo' ? (
          <motion.div
            key="solo-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {soloGoals.length === 0 ? (
              <div className="clay p-20 text-center opacity-30">
                <Target className="w-20 h-20 mx-auto mb-6" />
                <p className="text-xl font-bold uppercase tracking-widest">No solo goals yet</p>
              </div>
            ) : (
              soloGoals.map((goal) => (
                <div key={goal.id} className="clay p-8 bg-surface space-y-8">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-2xl clay-inset flex items-center justify-center text-[#FF6B6B]">
                        <Target size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold tracking-tight">{goal.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] opacity-30 font-bold uppercase tracking-[0.2em]">{goal.category}</p>
                          <span className="w-1 h-1 rounded-full bg-foreground/10" />
                          <p className="text-[10px] text-[#FF6B6B] font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="text-right mr-2">
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-1">Needed {goal.frequency}</p>
                        <p className="text-sm font-black text-[#FF6B6B]">
                          {formatCurrency(calculateNeeded(goal.targetAmount, goal.currentAmount, goal.deadline, goal.frequency), currentUser?.preferences?.currency)}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleEditGoal(goal, 'solo')}
                        className="p-3 rounded-xl clay-inset opacity-20 hover:text-[#4ECDC4] hover:opacity-100 transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteSolo(goal.id)}
                        className="p-3 rounded-xl clay-inset opacity-20 hover:text-red-500 hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-2">Progress</p>
                        <p className="text-3xl font-black">
                          {formatCurrency(goal.currentAmount, currentUser?.preferences?.currency)}
                          <span className="text-sm opacity-20 font-bold ml-3">
                            / {formatCurrency(goal.targetAmount, currentUser?.preferences?.currency)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <GoalSparkline goalId={goal.id} color="#FF6B6B" transactions={transactions} />
                        <span className="text-lg font-black text-[#FF6B6B]">
                          {Math.round((goal.currentAmount / goal.targetAmount) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-4 w-full clay-inset overflow-hidden rounded-full">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-[#FF6B6B] to-[#EE5253] rounded-full"
                      />
                    </div>
                  </div>

                    <div className="flex flex-col gap-4 pt-2">
                      {(() => {
                        const needed = getNeededThisPeriod(goal);
                        const contributed = getContributedThisPeriod(goal.id, goal.frequency);
                        const remaining = Math.max(0, needed - contributed);

                        if (remaining > 0) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 clay-inset bg-foreground/5 text-center">
                                <p className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">Estimated money to add</p>
                                <p className="text-xl font-black text-[#FF6B6B]">
                                  {formatCurrency(remaining, currentUser?.preferences?.currency)}
                                </p>
                              </div>
                              <button 
                                onClick={() => onAddMoney(goal.id, 'solo', remaining)}
                                className="w-full py-4 clay-coral text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                              >
                                <Plus size={14} /> Add {formatCurrency(remaining, currentUser?.preferences?.currency)}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            <div className="p-4 clay-inset bg-emerald-500/5 text-center border border-emerald-500/10">
                              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                            </div>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => onAddMoney(goal.id, 'solo')}
                                className="flex-1 py-4 clay-coral text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                              >
                                <Plus size={14} /> Add More
                              </button>
                              <button 
                                onClick={() => onWithdraw(goal.id, 'solo')}
                                className="flex-1 py-4 clay-card opacity-40 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                              >
                                <MinusCircle size={14} /> Withdraw
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                </div>
              ))
            )}
          </motion.div>
        ) : activeTab === 'group' ? (
          <motion.div
            key="group-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {groupGoals.length === 0 ? (
              <div className="clay p-20 text-center opacity-30">
                <Users className="w-20 h-20 mx-auto mb-6" />
                <p className="text-xl font-bold uppercase tracking-widest">No group goals yet</p>
              </div>
            ) : (
              groupGoals.map((goal) => {
                const myContribution = goal.members.find(m => m.userId === currentUser?.id)?.contributed || 0;
                const myShare = goal.targetAmount / goal.members.length;
                const isCreator = goal.creatorId === currentUser?.id;

                return (
                  <div key={goal.id} className="clay p-8 space-y-8">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-5">
                        <div className="w-16 h-16 rounded-2xl clay-inset flex items-center justify-center text-[#4ECDC4]">
                          <Users size={32} />
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold tracking-tight">{goal.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <button 
                              onClick={() => copyToClipboard(goal.groupId)}
                              className="flex items-center gap-2 text-[#4ECDC4] text-[10px] font-bold bg-[#4ECDC4]/10 px-3 py-1 rounded-full uppercase tracking-widest"
                            >
                              ID: {goal.groupId} <Copy size={10} />
                            </button>
                            <span className="w-1 h-1 rounded-full opacity-10" />
                            <p className="text-[10px] text-[#4ECDC4] font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-1">Needed {goal.frequency}</p>
                          <p className="text-sm font-black text-[#4ECDC4]">
                            {formatCurrency(calculateNeeded(goal.targetAmount / goal.memberCount, myContribution, goal.deadline, goal.frequency), currentUser?.preferences?.currency)}
                          </p>
                        </div>
                          <button 
                            onClick={() => handleEditGoal(goal, 'group')}
                            className="p-3 rounded-xl clay-inset opacity-20 hover:text-[#4ECDC4] transition-all"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                          onClick={() => handleLeaveGroup(goal.id)}
                          className="p-3 rounded-xl clay-inset opacity-20 hover:text-red-500 transition-all"
                        >
                          <LogOut size={16} />
                        </button>
                    </div>
                  </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="clay-inset p-5 rounded-2xl">
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-2">Total Collected</p>
                        <p className="text-xl font-bold">{formatCurrency(goal.totalCollected, currentUser?.preferences?.currency)}</p>
                        <p className="text-[10px] opacity-10 font-medium mt-1">Target: {formatCurrency(goal.targetAmount, currentUser?.preferences?.currency)}</p>
                      </div>
                      <div className="clay-inset p-5 rounded-2xl">
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-2">Your Share</p>
                        <p className="text-xl font-bold">{formatCurrency(myContribution, currentUser?.preferences?.currency)}</p>
                        <p className="text-[10px] opacity-10 font-medium mt-1">Target: {formatCurrency(myShare, currentUser?.preferences?.currency)}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="opacity-20">Group Progress</span>
                        <div className="flex items-center gap-4">
                          <GoalSparkline goalId={goal.id} color="#4ECDC4" transactions={transactions} />
                          <span className="text-lg font-black text-[#4ECDC4]">{Math.round((goal.totalCollected / goal.targetAmount) * 100)}%</span>
                        </div>
                      </div>
                      <div className="h-4 w-full clay-inset overflow-hidden rounded-full">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (goal.totalCollected / goal.targetAmount) * 100)}%` }}
                          className="h-full bg-gradient-to-r from-[#4ECDC4] to-[#45B7AF] rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-[0.2em]">Members ({goal.members.length})</p>
                        {goal.members.some(m => m.contributed === 0) && (
                          <button 
                            onClick={() => {
                              nudgeGroup(goal.id);
                              toast.success('Group notified! 🚀');
                            }}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#4ECDC4] bg-[#4ECDC4]/10 px-3 py-1.5 rounded-xl hover:bg-[#4ECDC4]/20 transition-all"
                          >
                            <Bell size={12} /> Notify Group
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {goal.members.map((member) => (
                          <div key={member.userId} className={cn(
                            "flex items-center justify-between p-4 clay-inset rounded-2xl transition-all",
                            member.contributed === 0 ? "border-red-500/20 bg-red-500/5" : "border-foreground/5"
                          )}>
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <img src={member.avatar} className="w-10 h-10 rounded-full bg-foreground/5 p-1" alt="" />
                                {member.contributed === 0 && (
                                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-surface rounded-full" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold opacity-80">
                                  {member.name} {member.userId === currentUser?.id && '(You)'}
                                  {member.contributed === 0 && <span className="text-[8px] text-red-500 ml-2 font-black uppercase tracking-widest">Inactive</span>}
                                </p>
                                <p className="text-[10px] opacity-20 font-bold uppercase tracking-wider mt-0.5">{Math.round((member.contributed / myShare) * 100)}% completed</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "text-xs font-black",
                                member.contributed === 0 ? "text-red-500/30" : "text-foreground"
                              )}>
                                {formatCurrency(member.contributed, currentUser?.preferences?.currency)}
                              </span>
                              {isCreator && member.userId !== currentUser?.id && (
                                <button 
                                  onClick={() => removeGroupMember(goal.id, member.userId)}
                                  className="text-red-500/30 hover:text-red-500 transition-colors"
                                >
                                  <UserMinus size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {(() => {
                        const needed = getNeededThisPeriod(goal);
                        const contributed = getContributedThisPeriod(goal.id, goal.frequency);
                        const remaining = Math.max(0, needed - contributed);

                        if (remaining > 0) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 clay-inset bg-foreground/5 text-center">
                                <p className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">Estimated money to contribute</p>
                                <p className="text-xl font-black text-[#4ECDC4]">
                                  {formatCurrency(remaining, currentUser?.preferences?.currency)}
                                </p>
                              </div>
                              <button 
                                onClick={() => onAddMoney(goal.id, 'group', remaining)}
                                className="w-full py-4 clay-teal text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                              >
                                <Plus size={14} /> Contribute {formatCurrency(remaining, currentUser?.preferences?.currency)}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            <div className="p-4 clay-inset bg-emerald-500/5 text-center border border-emerald-500/10">
                              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                            </div>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => onAddMoney(goal.id, 'group')}
                                className="flex-1 py-4 clay-teal text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                              >
                                <Plus size={14} /> Contribute More
                              </button>
                              <button 
                                onClick={() => onWithdraw(goal.id, 'group')}
                                className="flex-1 py-4 clay-card opacity-40 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                              >
                                <MinusCircle size={14} /> Withdraw
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div
            key="emergency-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {emergencyGoals.length === 0 ? (
              <div className="clay p-20 text-center opacity-30">
                <ShieldAlert className="w-20 h-20 mx-auto mb-6" />
                <p className="text-xl font-bold uppercase tracking-widest">No emergency funds yet</p>
              </div>
            ) : (
              emergencyGoals.map((goal) => (
                <div key={goal.id} className="clay p-8 bg-surface space-y-8">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-2xl clay-inset flex items-center justify-center text-[#E2B05E]">
                        <ShieldAlert size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold tracking-tight">{goal.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] opacity-30 font-bold uppercase tracking-[0.2em]">Emergency Fund</p>
                          <span className="w-1 h-1 rounded-full opacity-10" />
                          <p className="text-[10px] text-[#E2B05E] font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setConfirmModal({ isOpen: true, type: 'delete-emergency', id: goal.id })}
                        className="p-3 rounded-xl clay-inset opacity-20 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] opacity-20 font-bold uppercase tracking-widest mb-2">Total Saved</p>
                        <p className="text-3xl font-black">
                          {formatCurrency(goal.currentAmount, currentUser?.preferences?.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <GoalSparkline goalId={goal.id} color="#E2B05E" transactions={transactions} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-2">
                    <div className="space-y-4">
                      <div className="p-4 clay-inset bg-foreground/5 text-center">
                        <p className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">Routine Saving</p>
                        <p className="text-xl font-black text-[#E2B05E]">
                          {formatCurrency(goal.routineAmount, currentUser?.preferences?.currency)}
                          <span className="text-[10px] font-bold ml-1 opacity-40">/{goal.frequency}</span>
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => onAddMoney(goal.id, 'emergency', goal.routineAmount)}
                          className="flex-1 py-4 bg-[#E2B05E] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                        >
                          <Plus size={14} /> Add {formatCurrency(goal.routineAmount, currentUser?.preferences?.currency)}
                        </button>
                        <button 
                          onClick={() => onWithdraw(goal.id, 'emergency')}
                          className="flex-1 py-4 clay-card opacity-40 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          <MinusCircle size={14} /> Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
  );
}

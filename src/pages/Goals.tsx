/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency, cn, formatDateSafely } from '../lib/utils';
import { 
  Target, Users, Plus, Calendar, 
  ChevronRight, Trash2, Edit3, Copy, LogOut, UserMinus,
  MinusCircle, Bell, X, Settings2, Eraser
} from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';
import toast from 'react-hot-toast';
import PullToRefresh from '../components/PullToRefresh';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ShieldAlert } from 'lucide-react';
import { getRandomQuote } from '../constants/quotes';

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
    nudgeGroup, updateSoloGoal, updateGroupGoal, updateEmergencyGoal, deleteEmergencyGoal,
    clearGoalHistory, deleteGroupGoal, transferAdminRole
  } = useStore();

  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    goal: any;
    type: 'solo' | 'group' | 'emergency';
  }>({ isOpen: false, goal: null, type: 'solo' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete-solo' | 'leave-group' | 'delete-emergency' | 'delete-group' | 'clear-history';
    id: string;
    goalType?: 'solo' | 'group' | 'emergency';
    quote: string;
  }>({ isOpen: false, type: 'delete-solo', id: '', quote: '' });

  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    goal: any;
    selectedUserId: string;
  }>({ isOpen: false, goal: null, selectedUserId: '' });

  const handleAction = (type: typeof confirmModal['type'], id: string, goalType?: 'solo' | 'group' | 'emergency') => {
    // Permission check for Leave Group
    if (type === 'leave-group') {
      const goal = groupGoals.find(g => g.id === id);
      if (goal && goal.creatorId === currentUser?.id) {
        toast.error("You are the admin. Delete the goal or transfer admin role first.");
        setActiveActionsMenu(null);
        return;
      }
    }

    setConfirmModal({
      isOpen: true,
      type,
      id,
      goalType,
      quote: getRandomQuote()
    });
    setActiveActionsMenu(null);
  };

  const confirmAction = async () => {
    try {
      if (confirmModal.type === 'delete-solo') {
        await deleteSoloGoal(confirmModal.id);
        toast.success('Solo goal deleted. Start a new journey soon!');
      } else if (confirmModal.type === 'delete-group') {
        await deleteGroupGoal(confirmModal.id);
        toast.success('Group goal deleted.');
      } else if (confirmModal.type === 'delete-emergency') {
        await deleteEmergencyGoal(confirmModal.id);
        toast.success('Emergency fund removed.');
      } else if (confirmModal.type === 'leave-group') {
        await leaveGroupGoal(confirmModal.id);
        toast.success('You left the group');
      } else if (confirmModal.type === 'clear-history') {
        await clearGoalHistory(confirmModal.id, confirmModal.goalType!);
        toast.success('History cleared. Start fresh!');
      }
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (err: any) {
      const failMsg = confirmModal.type.includes('delete') ? 'Failed to delete goal' : 
                     confirmModal.type === 'leave-group' ? 'Failed to leave group' : 
                     'Action failed';
      toast.error(failMsg);
    }
  };

  const handleTransferAdmin = async () => {
    if (!transferModal.selectedUserId) {
      toast.error('Please select a member to transfer to');
      return;
    }
    try {
      await transferAdminRole(transferModal.goal.id, transferModal.selectedUserId);
      await leaveGroupGoal(transferModal.goal.id);
      setTransferModal({ isOpen: false, goal: null, selectedUserId: '' });
      toast.success('Admin role transferred and you left the group');
    } catch (err) {
      toast.error('Failed to transfer admin role');
    }
  };

  const handleEditGoal = (goal: any, type: 'solo' | 'group' | 'emergency') => {
    setEditModal({ isOpen: true, goal: { ...goal }, type });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModal.type === 'solo') {
      updateSoloGoal(editModal.goal.id, editModal.goal);
    } else if (editModal.type === 'group') {
      updateGroupGoal(editModal.goal.id, editModal.goal);
    } else if (editModal.type === 'emergency') {
      updateEmergencyGoal(editModal.goal.id, {
        name: editModal.goal.name,
        frequency: editModal.goal.frequency,
        routineAmount: Number(editModal.goal.routineAmount) || 0,
        targetAmount: 0
      });
    }
    setEditModal({ isOpen: false, goal: null, type: 'solo' });
    toast.success('Goal updated!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Group ID copied!');
  };

  const calculateNeeded = (target: number, current: number, deadline: string, frequency: string) => {
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) return 0;

    let daysLeft = 0;
    if (deadline) {
      try {
        const parsed = parseISO(deadline);
        if (!isNaN(parsed.getTime())) {
          daysLeft = differenceInDays(parsed, new Date());
        }
      } catch (e) {
        daysLeft = 0;
      }
    }

    if (daysLeft > 0) {
      switch (frequency) {
        case 'daily':
          return Math.ceil(remaining / daysLeft);
        case 'weekly':
          return Math.ceil(remaining / Math.max(1, Math.ceil(daysLeft / 7)));
        case 'monthly':
          return Math.ceil(remaining / Math.max(1, Math.ceil(daysLeft / 30)));
        default:
          return Math.ceil(remaining / daysLeft);
      }
    } else {
      switch (frequency) {
        case 'daily':
          return Math.ceil(remaining / 365);
        case 'weekly':
          return Math.ceil(remaining / 52);
        case 'monthly':
          return Math.ceil(remaining / 12);
        default:
          return Math.ceil(remaining / 12);
      }
    }
  };

  const getNeededThisPeriod = (goal: any) => {
    if (!goal.frequency || goal.completed) return 0;
    
    if ('deadline' in goal && goal.deadline) {
      let days = 0;
      try {
        const parsed = parseISO(goal.deadline);
        if (!isNaN(parsed.getTime())) {
          days = differenceInDays(parsed, new Date());
        }
      } catch (e) {
        days = 0;
      }

      let periods = 1;
      if (days > 0) {
        if (goal.frequency === 'daily') periods = Math.max(1, days);
        else if (goal.frequency === 'weekly') periods = Math.max(1, Math.ceil(days / 7));
        else if (goal.frequency === 'monthly') periods = Math.max(1, Math.ceil(days / 30));
      } else {
        if (goal.frequency === 'daily') periods = 365;
        else if (goal.frequency === 'weekly') periods = 52;
        else if (goal.frequency === 'monthly') periods = 12;
      }
      
      const remaining = Math.max(0, (goal.targetAmount || 0) - ('totalCollected' in goal ? goal.totalCollected : goal.currentAmount));
      if (remaining <= 0) return 0;

      const perPersonRemaining = ('memberCount' in goal && goal.memberCount > 1) 
        ? remaining / goal.memberCount 
        : remaining;

      return Math.max(0, Math.ceil(perPersonRemaining / Math.max(1, periods)));
    }
    
    return goal.routineAmount || Math.ceil((goal.targetAmount || 0) / 10); 
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

  const calculateEditModalMetrics = () => {
    if (!editModal.goal) return null;
    if (editModal.type === 'emergency') {
      return {
        neededPerPeriod: editModal.goal.routineAmount || 0,
        daysLeft: 0,
        weeksLeft: 0,
        monthsLeft: 0,
        periodsLeft: 0,
        perPersonTarget: 0,
        hasDeadline: false,
        memberCount: 1
      };
    }
    const target = editModal.goal.targetAmount || 0;
    const deadline = editModal.goal.deadline || '';
    const frequency = editModal.goal.frequency || 'weekly';
    const isGroup = editModal.type === 'group';
    const memberCount = isGroup ? (editModal.goal.memberCount || editModal.goal.members?.length || 1) : 1;
    const perPersonTarget = isGroup ? target / Math.max(1, memberCount) : target;

    let daysLeft = 0;
    let hasDeadline = false;

    if (deadline) {
      try {
        const parsed = parseISO(deadline);
        if (!isNaN(parsed.getTime())) {
          daysLeft = Math.max(1, differenceInDays(parsed, new Date()));
          hasDeadline = true;
        }
      } catch (e) {
        daysLeft = 0;
      }
    }

    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));

    let periods = 1;
    if (hasDeadline && daysLeft > 0) {
      if (frequency === 'daily') periods = daysLeft;
      else if (frequency === 'weekly') periods = weeksLeft;
      else if (frequency === 'monthly') periods = monthsLeft;
    } else {
      if (frequency === 'daily') periods = 365;
      else if (frequency === 'weekly') periods = 52;
      else if (frequency === 'monthly') periods = 12;
    }

    const neededPerPeriod = (target > 0) ? Math.ceil(perPersonTarget / Math.max(1, periods)) : 0;

    return {
      neededPerPeriod,
      daysLeft,
      weeksLeft,
      monthsLeft,
      periodsLeft: periods,
      perPersonTarget,
      hasDeadline,
      memberCount
    };
  };

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="space-y-8 pb-8">
        {/* Transfer Admin Modal */}
        <AnimatePresence>
          {transferModal.isOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTransferModal({ ...transferModal, isOpen: false })}
                className="absolute inset-0 bg-black/40 dark:bg-[#0a0a0f]/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-[2.5rem] p-8 space-y-6 shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Transfer Admin</h3>
                  <button onClick={() => setTransferModal({ ...transferModal, isOpen: false })} className="p-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-full transition-colors text-zinc-500 dark:text-white/60">
                    <X size={20} />
                  </button>
                </div>
                
                <p className="text-sm text-zinc-500 dark:text-[#94A3B8]/60">Choose a member to transfer the admin role to. You will leave the group after transferring.</p>
                
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {transferModal.goal?.members
                    .filter((m: any) => m.userId !== currentUser?.id)
                    .map((member: any) => (
                      <button
                        key={member.userId}
                        onClick={() => setTransferModal({ ...transferModal, selectedUserId: member.userId })}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                          transferModal.selectedUserId === member.userId 
                            ? "border-[#4ECDC4] bg-[#4ECDC4]/5 text-zinc-900 dark:text-white shadow-sm" 
                            : "bg-black/[0.01] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-700 dark:text-white/70"
                        )}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-black/[0.08] dark:border-white/[0.08]">
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">{member.name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 uppercase tracking-widest">{formatCurrency(member.contributed, currentUser?.preferences?.currency)} saved</p>
                        </div>
                      </button>
                    ))}
                    
                  {transferModal.goal?.members.length <= 1 && (
                    <div className="p-10 text-center opacity-40">
                      <p className="text-xs text-zinc-500 dark:text-white">No other members to transfer to.</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleTransferAdmin}
                  disabled={!transferModal.selectedUserId}
                  className="w-full h-14 bg-gradient-to-r from-[#4ECDC4] to-[#20968F] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#4ECDC4]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                >
                  Confirm Transfer & Leave
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditModal({ ...editModal, isOpen: false })}
                className="absolute inset-0 bg-black/40 dark:bg-[#0a0a0f]/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-[2.5rem] p-8 space-y-6 shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Edit Goal</h3>
                  <button onClick={() => setEditModal({ ...editModal, isOpen: false })} className="p-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-full transition-colors text-zinc-500 dark:text-white/60">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={saveEdit} className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Goal Name</label>
                    <input 
                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 rounded-2xl p-4 text-sm font-semibold text-zinc-900 dark:text-white outline-none transition-all"
                      value={editModal.goal.name}
                      onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, name: e.target.value } })}
                    />
                  </div>
                  {editModal.type === 'emergency' ? (
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Routine Amount</label>
                      <input 
                        type="number"
                        className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 rounded-2xl p-4 text-sm font-semibold text-zinc-900 dark:text-white outline-none transition-all"
                        value={editModal.goal.routineAmount || ''}
                        onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, routineAmount: parseInt(e.target.value) || 0 } })}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Target Amount</label>
                        <input 
                          type="number"
                          className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 rounded-2xl p-4 text-sm font-semibold text-zinc-900 dark:text-white outline-none transition-all"
                          value={editModal.goal.targetAmount}
                          onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, targetAmount: parseInt(e.target.value) || 0 } })}
                        />
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Deadline</label>
                        <input 
                          type="date"
                          className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 rounded-2xl p-4 text-sm font-semibold text-zinc-900 dark:text-white outline-none transition-all dark:[color-scheme:dark]"
                          value={editModal.goal.deadline}
                          onChange={e => setEditModal({ ...editModal, goal: { ...editModal.goal, deadline: e.target.value } })}
                        />
                        {editModal.goal.deadline && (
                          <p className="text-[10px] text-[#FF6B6B] font-bold uppercase tracking-widest ml-1">
                            Deadline Selected: {formatDateSafely(editModal.goal.deadline)}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/40 ml-4">Saving Routine</label>
                    <div className="flex p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl">
                      {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setEditModal({ ...editModal, goal: { ...editModal.goal, frequency: freq } })}
                          className={cn(
                            "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all capitalize",
                            editModal.goal.frequency === freq ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-md" : "text-zinc-500 dark:text-[#94A3B8]/60 hover:text-zinc-800 dark:hover:text-white"
                          )}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const metrics = calculateEditModalMetrics();
                    if (!metrics) return null;
                    return (
                      <div className="clay-inset p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] space-y-3 text-left">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60">
                              {editModal.type === 'emergency' ? 'Recurring Contribution' : 'Estimated Routine'}
                            </p>
                            <p className="text-xl font-black text-[#FF6B6B] mt-0.5">
                              {formatCurrency(metrics.neededPerPeriod, currentUser?.preferences?.currency)}
                              <span className="text-[10px] font-bold ml-1 text-zinc-400">/{editModal.goal.frequency}</span>
                            </p>
                          </div>
                          {editModal.type !== 'emergency' && (
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60">
                                {editModal.type === 'group' ? 'Group Target' : 'Target'}
                              </p>
                              <p className="text-sm font-bold text-zinc-800 dark:text-white mt-0.5">
                                {formatCurrency(editModal.goal.targetAmount, currentUser?.preferences?.currency)}
                              </p>
                              {editModal.type === 'group' && (
                                <p className="text-[9px] font-bold text-[#4ECDC4]">
                                  ({formatCurrency(metrics.perPersonTarget, currentUser?.preferences?.currency)} / member)
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {metrics.hasDeadline && (
                          <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl text-center">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Days Left</p>
                              <p className="text-xs font-black text-zinc-900 dark:text-white">{metrics.daysLeft} Days</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Weeks Left</p>
                              <p className="text-xs font-black text-zinc-900 dark:text-white">{metrics.weeksLeft} Weeks</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Months Left</p>
                              <p className="text-xs font-black text-zinc-900 dark:text-white">{metrics.monthsLeft} Months</p>
                            </div>
                          </div>
                        )}

                        <p className="text-[9px] text-zinc-500 dark:text-[#94A3B8]/70 leading-relaxed pt-1 border-t border-black/[0.06] dark:border-white/[0.06]">
                          {editModal.type === 'emergency'
                            ? `You save ${formatCurrency(metrics.neededPerPeriod, currentUser?.preferences?.currency)} ${editModal.goal.frequency} into your emergency fund.`
                            : metrics.hasDeadline
                            ? editModal.type === 'group'
                              ? `Completes in ${metrics.daysLeft} days (${metrics.periodsLeft} ${editModal.goal.frequency} cycles) by ${formatDateSafely(editModal.goal.deadline)}. Each member saves ${formatCurrency(metrics.neededPerPeriod, currentUser?.preferences?.currency)} / ${editModal.goal.frequency}.`
                              : `Completes in ${metrics.daysLeft} days (${metrics.periodsLeft} ${editModal.goal.frequency} cycles) by ${formatDateSafely(editModal.goal.deadline)}. Save ${formatCurrency(metrics.neededPerPeriod, currentUser?.preferences?.currency)} / ${editModal.goal.frequency}.`
                            : `Select a deadline date to calculate exact days to complete target.`}
                        </p>
                      </div>
                    );
                  })()}
                  <button 
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[rgba(255,107,107,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all cursor-pointer"
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
                className="absolute inset-0 bg-black/40 dark:bg-[#0a0a0f]/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-[2.5rem] p-10 space-y-8 text-center shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
              >
                <div className={cn(
                  "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08]",
                  (confirmModal.type.includes('delete') || confirmModal.type === 'clear-history') ? "text-[#FF6B6B]" : "text-[#E2B05E]"
                )}>
                  {confirmModal.type.includes('delete') ? <Trash2 size={36} /> : 
                   confirmModal.type === 'clear-history' ? <Eraser size={36} /> :
                   <LogOut size={36} />}
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {confirmModal.type.includes('delete') ? 'Delete Goal?' : 
                     confirmModal.type === 'clear-history' ? 'Clear History?' :
                     'Leave Group?'}
                  </h3>
                  
                  <div className="p-4 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] rounded-2xl">
                    <p className="text-[11px] font-medium leading-relaxed italic text-zinc-500 dark:text-[#94A3B8]/60">
                      "{confirmModal.quote}"
                    </p>
                  </div>

                  <p className="text-[11px] text-zinc-400 dark:text-[#94A3B8]/30 uppercase font-black tracking-widest leading-relaxed">
                    {confirmModal.type.includes('delete')
                      ? 'All transactions will be permanently deleted. This cannot be undone.' 
                      : confirmModal.type === 'clear-history'
                      ? 'All transaction records will be deleted. Current balance will reset to zero. This cannot be undone.'
                      : 'You will lose access to this goal\'s history. Are you sure?'}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    className="flex-1 py-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.05] rounded-xl text-[10px] text-zinc-700 dark:text-white font-bold uppercase tracking-[0.2em] hover:opacity-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmAction}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 cursor-pointer",
                      (confirmModal.type.includes('delete') || confirmModal.type === 'clear-history') ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] shadow-[rgba(255,107,107,0.35)]" : "bg-gradient-to-r from-[#E2B05E] to-yellow-500 shadow-yellow-500/20"
                    )}
                  >
                    Yes, {confirmModal.type === 'delete-solo' || confirmModal.type === 'delete-group' || confirmModal.type === 'delete-emergency' ? 'Delete' : 
                          confirmModal.type === 'clear-history' ? 'Clear' : 'Leave'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">My Goals</h2>
        <div className="flex p-1 bg-white/60 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-2xl w-fit shadow-sm">
          <button 
            onClick={() => setActiveTab('solo')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer",
              activeTab === 'solo' ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-md shadow-[rgba(255,107,107,0.15)]" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-100 hover:text-zinc-800 dark:hover:text-white"
            )}
          >
            Solo
          </button>
          <button 
            onClick={() => setActiveTab('group')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer",
              activeTab === 'group' ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-md shadow-[rgba(255,107,107,0.15)]" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-100 hover:text-zinc-800 dark:hover:text-white"
            )}
          >
            Group
          </button>
          <button 
            onClick={() => setActiveTab('emergency')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer",
              activeTab === 'emergency' ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-md shadow-[rgba(255,107,107,0.15)]" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-100 hover:text-zinc-800 dark:hover:text-white"
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
              <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-20 text-center rounded-2xl opacity-60">
                <Target className="w-20 h-20 mx-auto mb-6 text-zinc-400 dark:text-[#94A3B8]" />
                <p className="text-xl font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]">No solo goals yet</p>
              </div>
            ) : (
              soloGoals.map((goal) => (
                <div key={goal.id} className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 rounded-2xl space-y-8 shadow-sm dark:shadow-lg relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center text-[#FF6B6B]">
                        <Target size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{goal.name}</h4>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-[0.2em]">{goal.category}</p>
                          <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                          <p className="text-[10px] text-[#FF6B6B] font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                          {goal.deadline && (() => {
                            const diff = differenceInDays(parseISO(goal.deadline), new Date());
                            const daysLeft = Math.max(0, diff);
                            const weeksLeft = Math.ceil(daysLeft / 7);
                            return (
                              <>
                                <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                                <p className="text-[10px] text-zinc-600 dark:text-[#94A3B8] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Calendar size={11} className="text-[#FF6B6B]" />
                                  <span>{daysLeft} Days Left ({weeksLeft} wks)</span>
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 relative">
                      <button 
                        onClick={() => setActiveActionsMenu(activeActionsMenu === goal.id ? null : goal.id)}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer"
                      >
                        <Settings2 size={16} />
                      </button>

                      <AnimatePresence>
                        {activeActionsMenu === goal.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-12 right-0 w-48 bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-2 z-50 space-y-1 shadow-xl dark:shadow-2xl backdrop-blur-2xl"
                          >
                            <button 
                              onClick={() => { handleEditGoal(goal, 'solo'); setActiveActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit3 size={14} /> Edit Goal
                            </button>
                            <button 
                              onClick={() => handleAction('clear-history', goal.id, 'solo')}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                            >
                              <Eraser size={14} /> Clear History
                            </button>
                            <button 
                              onClick={() => handleAction('delete-solo', goal.id, 'solo')}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500/80 hover:bg-red-500/5 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} /> Delete Goal
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest mb-2">Progress</p>
                        <p className="text-3xl font-black text-zinc-900 dark:text-white">
                          {formatCurrency(goal.currentAmount, currentUser?.preferences?.currency)}
                          <span className="text-sm text-zinc-400 dark:text-[#94A3B8]/40 font-bold ml-3">
                            / {formatCurrency(goal.targetAmount, currentUser?.preferences?.currency)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <GoalSparkline goalId={goal.id} color="#FF6B6B" transactions={transactions} />
                        <span className="text-lg font-bold text-[#FF6B6B]">
                          {Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-full"
                      />
                    </div>
                  </div>

                    <div className="flex flex-col gap-4 pt-2">
                      {(() => {
                        if (goal.completed) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-2xl">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal completed! 🎉</p>
                              </div>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => onWithdraw(goal.id, 'solo')}
                                  className="w-full h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
                                >
                                  <MinusCircle size={14} /> Withdraw
                                </button>
                              </div>
                            </div>
                          );
                        }

                        const needed = getNeededThisPeriod(goal);
                        const contributed = getContributedThisPeriod(goal.id, goal.frequency);
                        const remaining = Math.max(0, needed - contributed);

                        if (remaining > 0) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] rounded-2xl text-center">
                                <p className="text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-[0.2em] mb-1">To add this {goal.frequency || 'period'}</p>
                                <p className="text-xl font-black text-[#FF6B6B]">
                                  {formatCurrency(remaining, currentUser?.preferences?.currency)}
                                </p>
                              </div>
                              <button 
                                onClick={() => onAddMoney(goal.id, 'solo', remaining)}
                                className="w-full h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[rgba(255,107,107,0.15)] hover:shadow-[0_8px_25px_rgba(255,107,107,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                              >
                                <Plus size={14} /> Add {formatCurrency(remaining, currentUser?.preferences?.currency)}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-2xl">
                              <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                            </div>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => onAddMoney(goal.id, 'solo')}
                                className="flex-1 h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[rgba(255,107,107,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                              >
                                <Plus size={14} /> Add More
                              </button>
                              <button 
                                onClick={() => onWithdraw(goal.id, 'solo')}
                                className="flex-1 h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
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
              <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-20 text-center rounded-2xl opacity-60">
                <Users className="w-20 h-20 mx-auto mb-6 text-zinc-400 dark:text-[#94A3B8]" />
                <p className="text-xl font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]">No group goals yet</p>
              </div>
            ) : (
              groupGoals.map((goal) => {
                const myContribution = goal.members.find(m => m.userId === currentUser?.id)?.contributed || 0;
                const myShare = goal.targetAmount / goal.members.length;
                const isCreator = goal.creatorId === currentUser?.id;

                return (
                  <div key={goal.id} className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 rounded-2xl space-y-8 shadow-sm dark:shadow-lg relative overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center text-[#4ECDC4]">
                          <Users size={32} />
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{goal.name}</h4>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <button 
                              onClick={() => copyToClipboard(goal.groupId)}
                              className="flex items-center gap-2 text-[#4ECDC4] text-[10px] font-bold bg-[#4ECDC4]/10 px-3 py-1 rounded-full uppercase tracking-widest cursor-pointer hover:bg-[#4ECDC4]/20 transition-all duration-300"
                            >
                              ID: {goal.groupId} <Copy size={10} />
                            </button>
                            <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                            <p className="text-[10px] text-[#4ECDC4] font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                            {goal.deadline && (() => {
                              const diff = differenceInDays(parseISO(goal.deadline), new Date());
                              const daysLeft = Math.max(0, diff);
                              const weeksLeft = Math.ceil(daysLeft / 7);
                              return (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                                  <p className="text-[10px] text-zinc-600 dark:text-[#94A3B8] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Calendar size={11} className="text-[#4ECDC4]" />
                                    <span>{daysLeft} Days Left ({weeksLeft} wks)</span>
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 relative">
                        <div className="text-right mr-2">
                          <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest mb-1">Needed {goal.frequency}</p>
                          <p className="text-sm font-black text-[#4ECDC4]">
                            {formatCurrency(calculateNeeded(goal.targetAmount / goal.memberCount, myContribution, goal.deadline, goal.frequency), currentUser?.preferences?.currency)}
                          </p>
                        </div>
                        <button 
                          onClick={() => setActiveActionsMenu(activeActionsMenu === goal.id ? null : goal.id)}
                          className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer"
                        >
                          <Settings2 size={16} />
                        </button>

                        <AnimatePresence>
                          {activeActionsMenu === goal.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-12 right-0 w-48 bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-2 z-50 space-y-1 shadow-xl dark:shadow-2xl backdrop-blur-2xl"
                            >
                              {isCreator ? (
                                <>
                                  <button 
                                    onClick={() => { handleEditGoal(goal, 'group'); setActiveActionsMenu(null); }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                                  >
                                    <Edit3 size={14} /> Edit Goal
                                  </button>
                                  <button 
                                    onClick={() => { setTransferModal({ isOpen: true, goal, selectedUserId: '' }); setActiveActionsMenu(null); }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-400/5 rounded-xl transition-colors cursor-pointer"
                                  >
                                    <UserMinus size={14} /> Transfer Admin
                                  </button>
                                  <button 
                                    onClick={() => handleAction('clear-history', goal.id, 'group')}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                                  >
                                    <Eraser size={14} /> Clear History
                                  </button>
                                  <button 
                                    onClick={() => handleAction('delete-group', goal.id, 'group')}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500/80 hover:bg-red-500/5 rounded-xl transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={14} /> Delete Goal
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => handleAction('leave-group', goal.id)}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500/80 hover:bg-red-500/5 rounded-xl transition-colors cursor-pointer"
                                >
                                  <LogOut size={14} /> Leave Group
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] p-5 rounded-2xl">
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest mb-2">Total Collected</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatCurrency(goal.totalCollected, currentUser?.preferences?.currency)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 font-medium mt-1">Target: {formatCurrency(goal.targetAmount, currentUser?.preferences?.currency)}</p>
                      </div>
                      <div className="bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] p-5 rounded-2xl">
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest mb-2">Your Share</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatCurrency(myContribution, currentUser?.preferences?.currency)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 font-medium mt-1">Target: {formatCurrency(myShare, currentUser?.preferences?.currency)}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-500 dark:text-[#94A3B8]/60">Group Progress</span>
                        <div className="flex items-center gap-4">
                          <GoalSparkline goalId={goal.id} color="#4ECDC4" transactions={transactions} />
                          <span className="text-lg font-bold text-[#4ECDC4]">{Math.min(100, Math.round((goal.totalCollected / goal.targetAmount) * 100))}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (goal.totalCollected / goal.targetAmount) * 100)}%` }}
                          className="h-full bg-gradient-to-r from-[#4ECDC4] to-[#20968F] rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-[0.2em]">Members ({goal.members.length})</p>
                        {goal.members.some(m => m.contributed === 0) && (
                          <button 
                            onClick={() => {
                              nudgeGroup(goal.id);
                              toast.success('Group notified! 🚀');
                            }}
                            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[#4ECDC4] bg-[#4ECDC4]/10 px-3 py-1.5 rounded-xl hover:bg-[#4ECDC4]/20 transition-all cursor-pointer"
                          >
                            <Bell size={12} /> Notify Group
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {goal.members.map((member) => (
                          <div key={member.userId} className={cn(
                            "flex items-center justify-between p-4 bg-black/[0.01] dark:bg-white/[0.01] border rounded-2xl transition-all duration-300",
                            member.contributed === 0 ? "border-red-500/20 bg-red-500/[0.02]" : "border-black/[0.06] dark:border-white/[0.05]"
                          )}>
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <img src={member.avatar} className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.04] p-1" alt="" />
                                {member.contributed === 0 && (
                                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white dark:border-[#111118] rounded-full" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white/95">
                                  {member.name} {member.userId === currentUser?.id && '(You)'}
                                  {member.contributed === 0 && <span className="text-[8px] text-red-500 ml-2 font-bold uppercase tracking-widest">Inactive</span>}
                                </p>
                                <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 font-bold uppercase tracking-wider mt-0.5">{Math.min(100, Math.round((member.contributed / myShare) * 100))}% completed</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "text-xs font-bold",
                                member.contributed === 0 ? "text-red-500/30" : "text-zinc-900 dark:text-white"
                              )}>
                                {formatCurrency(member.contributed, currentUser?.preferences?.currency)}
                              </span>
                              {isCreator && member.userId !== currentUser?.id && (
                                <button 
                                  onClick={() => removeGroupMember(goal.id, member.userId)}
                                  className="text-red-500/30 hover:text-red-500 transition-colors cursor-pointer"
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
                        if (goal.completed) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-2xl">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal completed! 🎉</p>
                              </div>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => onWithdraw(goal.id, 'group')}
                                  className="w-full h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
                                >
                                  <MinusCircle size={14} /> Withdraw
                                </button>
                              </div>
                            </div>
                          );
                        }

                        const needed = getNeededThisPeriod(goal);
                        const contributed = getContributedThisPeriod(goal.id, goal.frequency);
                        const remaining = Math.max(0, needed - contributed);

                        if (remaining > 0) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] rounded-2xl text-center">
                                <p className="text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-[0.2em] mb-1">To add this {goal.frequency || 'period'}</p>
                                <p className="text-xl font-black text-[#4ECDC4]">
                                  {formatCurrency(remaining, currentUser?.preferences?.currency)}
                                </p>
                              </div>
                              <button 
                                onClick={() => onAddMoney(goal.id, 'group', remaining)}
                                className="w-full h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[rgba(255,107,107,0.15)] hover:shadow-[0_8px_25px_rgba(255,107,107,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                              >
                                <Plus size={14} /> Contribute {formatCurrency(remaining, currentUser?.preferences?.currency)}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-2xl">
                              <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal met for this {goal.frequency}! ✨</p>
                            </div>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => onAddMoney(goal.id, 'group')}
                                className="flex-1 h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[rgba(255,107,107,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                              >
                                <Plus size={14} /> Contribute More
                              </button>
                              <button 
                                onClick={() => onWithdraw(goal.id, 'group')}
                                className="flex-1 h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
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
              <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-20 text-center rounded-2xl opacity-60">
                <ShieldAlert className="w-20 h-20 mx-auto mb-6 text-zinc-400 dark:text-[#94A3B8]" />
                <p className="text-xl font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]">No emergency funds yet</p>
              </div>
            ) : (
              emergencyGoals.map((goal) => (
                <div key={goal.id} className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-8 rounded-2xl space-y-8 shadow-sm dark:shadow-lg relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center text-amber-400">
                        <ShieldAlert size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{goal.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-[0.2em]">Emergency Fund</p>
                          <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10" />
                          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.2em]">{goal.frequency}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleAction('delete-emergency', goal.id)}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-red-500/50 hover:text-red-500 transition-all cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/60 font-bold uppercase tracking-widest mb-2">
                          {goal.targetAmount > 0 ? "Progress" : "Total Saved"}
                        </p>
                        <p className="text-3xl font-black text-zinc-900 dark:text-white">
                          {formatCurrency(goal.currentAmount, currentUser?.preferences?.currency)}
                          {goal.targetAmount > 0 && (
                            <span className="text-sm text-zinc-400 dark:text-[#94A3B8]/40 font-bold ml-3">
                              / {formatCurrency(goal.targetAmount, currentUser?.preferences?.currency)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <GoalSparkline goalId={goal.id} color="#F59E0B" transactions={transactions} />
                        {goal.targetAmount > 0 && (
                          <span className="text-lg font-bold text-[#F59E0B]">
                            {Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))}%
                          </span>
                        )}
                      </div>
                    </div>
                    {goal.targetAmount > 0 && (
                      <div className="h-2.5 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 pt-2">
                    {goal.completed ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-emerald-500/[0.04] text-center border border-emerald-500/10 rounded-2xl">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Goal completed! 🎉</p>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => onWithdraw(goal.id, 'emergency')}
                            className="w-full h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
                          >
                            <MinusCircle size={14} /> Withdraw
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] rounded-2xl text-center">
                          <p className="text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-[0.2em] mb-1">Routine Saving</p>
                          <p className="text-xl font-black text-amber-400">
                            {formatCurrency(goal.routineAmount, currentUser?.preferences?.currency)}
                            <span className="text-[10px] font-bold ml-1 text-zinc-400 dark:text-[#94A3B8]/40">/{goal.frequency}</span>
                          </p>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => onAddMoney(goal.id, 'emergency', goal.routineAmount)}
                            className="flex-1 h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[rgba(255,107,107,0.15)] hover:shadow-[0_8px_25px_rgba(255,107,107,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 text-white cursor-pointer"
                          >
                            <Plus size={14} /> Add {formatCurrency(goal.routineAmount, currentUser?.preferences?.currency)}
                          </button>
                          <button 
                            onClick={() => onWithdraw(goal.id, 'emergency')}
                            className="flex-1 h-14 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[10px] font-bold uppercase tracking-[0.20em] rounded-2xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 cursor-pointer"
                          >
                            <MinusCircle size={14} /> Withdraw
                          </button>
                        </div>
                      </div>
                    )}
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

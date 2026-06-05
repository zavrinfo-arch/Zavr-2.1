import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XCircle, CheckCircle2, Loader2, ArrowRight, Wallet, Users, Search, DollarSign, Calendar, Sparkles, Scale, Info, PieChart } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface CreateZettlModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: any[];
  onRequestMoney: (friendId: string, amount: number, note: string, dueDate?: string) => Promise<void>;
  onSendMoney: (friendId: string, amount: number, note: string) => Promise<void>;
  onCreateGroup: (name: string, friendIds: string[]) => Promise<void>;
  groups?: any[];
  onPostGroupExpense?: (groupId: string, amount: number, description: string, splits: { userId: string; amountOwed: number }[]) => Promise<void>;
}

export default function CreateZettlModal({
  isOpen,
  onClose,
  friends,
  onRequestMoney,
  onSendMoney,
  onCreateGroup,
  groups = [],
  onPostGroupExpense
}: CreateZettlModalProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'pay' | 'group'>('request');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Group Creation specific states
  const [groupSubMode, setGroupSubMode] = useState<'create_group' | 'split_expense'>('split_expense');
  const [groupName, setGroupName] = useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = useState<string[]>([]);

  // Split Expense specific states
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupExpenseAmount, setGroupExpenseAmount] = useState('');
  const [groupExpenseNote, setGroupExpenseNote] = useState('');
  const [participatingMembers, setParticipatingMembers] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Reset states when modal toggled
  useEffect(() => {
    setSelectedFriend(null);
    setAmount('');
    setNote('');
    setDueDate('');
    setGroupName('');
    setSelectedGroupFriends([]);
    setGroupExpenseAmount('');
    setGroupExpenseNote('');
    if (groups && groups.length > 0) {
      setSelectedGroup(groups[0]);
    } else {
      setSelectedGroup(null);
    }
  }, [isOpen, groups]);

  // Set default participating members when selected group changes
  useEffect(() => {
    if (selectedGroup) {
      const memberIds = (selectedGroup.members || []).map((m: any) => m.user_id || m.profiles?.id).filter(Boolean);
      setParticipatingMembers(memberIds);
      // Reset custom amounts
      const initAmounts: Record<string, string> = {};
      memberIds.forEach((id: string) => {
        initAmounts[id] = '';
      });
      setCustomAmounts(initAmounts);
    }
  }, [selectedGroup]);

  if (!isOpen) return null;

  // Live calculation of custom amounts total
  const getCustomTotal = () => {
    return Object.entries(customAmounts)
      .filter(([id]) => participatingMembers.includes(id))
      .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedGroupFriends.length === 0) {
      toast.error('Please select at least 1 friend');
      return;
    }

    setLoading(true);
    try {
      await onCreateGroup(groupName.trim(), selectedGroupFriends);
      toast.success('Circle created successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Circle creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) {
      toast.error('Please select a group first');
      return;
    }
    const totalFloat = parseFloat(groupExpenseAmount);
    if (isNaN(totalFloat) || totalFloat <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!groupExpenseNote.trim()) {
      toast.error('Please enter the bill description');
      return;
    }
    if (participatingMembers.length === 0) {
      toast.error('At least 1 member must participate');
      return;
    }
    if (!onPostGroupExpense) {
      toast.error('Group splits are not supported under current scope');
      return;
    }

    let calculatedSplits: { userId: string; amountOwed: number }[] = [];

    if (splitMode === 'equal') {
      const share = Math.round((totalFloat / participatingMembers.length) * 100) / 100;
      calculatedSplits = participatingMembers.map(userId => ({
        userId,
        amountOwed: share
      }));
    } else {
      // Validate sum matches total amount
      const customSum = getCustomTotal();
      if (Math.abs(customSum - totalFloat) > 0.05) {
        toast.error(`Amounts sum (₹${customSum}) doesn't match total bill (₹${totalFloat})`);
        return;
      }
      calculatedSplits = participatingMembers.map(userId => ({
        userId,
        amountOwed: parseFloat(customAmounts[userId]) || 0
      }));
    }

    setLoading(true);
    try {
      await onPostGroupExpense(selectedGroup.id, totalFloat, groupExpenseNote.trim(), calculatedSplits);
      toast.success('Group expense divided successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) {
      toast.error('Please select a friend first');
      return;
    }
    const totalAmount = parseInt(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!note.trim()) {
      toast.error('Please enter what this is for');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'request') {
        await onRequestMoney(selectedFriend.friendId, totalAmount, note.trim(), dueDate || undefined);
      } else {
        await onSendMoney(selectedFriend.friendId, totalAmount, note.trim());
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Transaction submission failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupFriend = (friendId: string) => {
    setSelectedGroupFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const toggleParticipatingMember = (userId: string) => {
    setParticipatingMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    setCustomAmounts(prev => ({
      ...prev,
      [userId]: val
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 md:px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/85 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-sm clay p-6 relative z-10 border border-foreground/10 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl bg-surface"
        id="create-zettl-modal-container"
      >
        {/* Header section with branding */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="text-[#FF6B6B]" size={14} />
              New Transaction
            </h3>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mt-0.5">Instant Splits & Ledgers</p>
          </div>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity p-1 hover:bg-foreground/5 rounded-lg">
            <XCircle size={18} className="text-foreground" />
          </button>
        </div>

        {/* Dynamic Tab Controls with Motion Transitions */}
        <div className="flex gap-1 p-1 clay-inset bg-foreground/5 rounded-xl mb-5">
          {[
            { id: 'request', label: 'Request', icon: Wallet },
            { id: 'pay', label: 'Pay Now', icon: DollarSign },
            { id: 'group', label: 'Group Divide', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedFriend(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? "clay bg-surface text-foreground shadow" 
                  : "text-foreground/45 hover:text-foreground/80"
              )}
            >
              <tab.icon size={11} className={activeTab === tab.id ? "text-[#FF6B6B]" : ""} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'group' ? (
          /* TRANSACTION FORMS: REQUEST OR PAY */
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            {/* Friends Selector with Hover states & touch targets */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Select Contact</p>
              <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                {friends.length === 0 ? (
                  <div className="w-full py-4 text-center opacity-40">
                    <p className="text-[8px] font-bold uppercase tracking-wide">No active links found. Connect with someone first!</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => setSelectedFriend(friend)}
                      className={cn(
                        "flex-shrink-0 w-16 p-2 rounded-2xl transition-all relative flex flex-col items-center gap-1 touch-manipulation min-h-[72px]",
                        selectedFriend?.id === friend.id 
                          ? "clay bg-[#FF6B6B]/10 scale-105" 
                          : "opacity-50 hover:opacity-90"
                      )}
                    >
                      <img 
                        src={friend.friendAvatar} 
                        alt="" 
                        className="w-9 h-9 rounded-xl object-cover pointer-events-none"
                      />
                      <p className="text-[7.5px] font-bold truncate w-full text-center">@{friend.friendUsername}</p>
                      {selectedFriend?.id === friend.id && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF6B6B] rounded-full border border-background" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Money Box Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black opacity-25">₹</div>
              <input 
                type="number"
                required
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount (e.g. 1500)"
                className="w-full clay-inset bg-foreground/5 p-4 pl-10 text-lg font-black italic outline-none focus:ring-1 focus:ring-[#FF6B6B]/30 rounded-2xl placeholder:text-foreground/20 text-foreground"
              />
            </div>

            {/* Purpose Input */}
            <input 
              required
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did you split? (e.g., Dinner, Uber)"
              className="w-full clay-inset bg-foreground/5 p-4 text-xs font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-30 text-foreground"
            />

            {/* Due Date Calendar Picker */}
            {activeTab === 'request' && (
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-25" size={14} />
                <input 
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full clay-inset bg-foreground/5 p-4 pl-11 text-[9px] font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl text-foreground"
                />
              </div>
            )}

            {/* CTA Execution Button */}
            <button 
              type="submit"
              disabled={loading || !selectedFriend || !amount || !note.trim()}
              className="w-full py-4 mt-2 bg-[#FF6B6B] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-30 disabled:pointer-events-none"
            >
              {loading ? <Loader2 size={16} className="animate-spin text-white" /> : activeTab === 'request' ? 'Request Money' : 'Pay Now'}
            </button>
          </form>
        ) : (
          /* GROUP SPLITS */
          <div className="space-y-4">
            {/* Circle Sub-tabs */}
            <div className="flex gap-1.5 border-b border-foreground/5 pb-2.5">
              <button
                type="button"
                onClick={() => setGroupSubMode('split_expense')}
                className={cn(
                  "flex-1 py-1 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all",
                  groupSubMode === 'split_expense' 
                    ? "text-[#FF6B6B] bg-[#FF6B6B]/5 border border-[#FF6B6B]/15" 
                    : "text-foreground/45 hover:text-foreground/75"
                )}
              >
                Split bill
              </button>
              <button
                type="button"
                onClick={() => setGroupSubMode('create_group')}
                className={cn(
                  "flex-1 py-1 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all",
                  groupSubMode === 'create_group' 
                    ? "text-[#FF6B6B] bg-[#FF6B6B]/5 border border-[#FF6B6B]/15" 
                    : "text-foreground/45 hover:text-foreground/75"
                )}
              >
                Assemble Circle
              </button>
            </div>

            {groupSubMode === 'create_group' ? (
              /* CREATE GROUP FORM */
              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                <input 
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Circle name (e.g., Roommates, Trips)"
                  className="w-full clay-inset bg-foreground/5 p-4 text-xs font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-30 text-foreground"
                />

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Link members</p>
                    <span className="text-[7.5px] font-extrabold text-[#FF6B6B] bg-[#FF6B6B]/5 px-1.5 py-0.5 rounded-full">{selectedGroupFriends.length} Picked</span>
                  </div>
                  {friends.length === 0 ? (
                    <div className="p-4 text-center opacity-40">
                      <p className="text-[8px] font-bold uppercase">No candidates available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                      {friends.map((friend) => {
                        const isAdded = selectedGroupFriends.includes(friend.friendId);
                        return (
                          <button
                            key={friend.friendId}
                            type="button"
                            onClick={() => toggleGroupFriend(friend.friendId)}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-xl transition-all text-left border touch-manipulation",
                              isAdded 
                                ? "clay border-[#FF6B6B]/30 bg-[#FF6B6B]/5 text-foreground" 
                                : "border-foreground/5 hover:bg-foreground/5 opacity-60 text-foreground"
                            )}
                          >
                            <img 
                              src={friend.friendAvatar} 
                              alt="" 
                              className="w-6 h-6 rounded-lg object-cover pointer-events-none shrink-0"
                            />
                            <p className="text-[8.5px] font-bold truncate pointer-events-none">@{friend.friendUsername}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={loading || !groupName.trim() || selectedGroupFriends.length === 0}
                  className="w-full py-4 mt-2 bg-[#FF6B6B] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-30 disabled:pointer-events-none"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Assemble Circle'}
                </button>
              </form>
            ) : (
              /* SPLIT EXPENSE FORM (EQUAL/CUSTOM SPLIT ENGINE) */
              <form onSubmit={handleGroupExpenseSubmit} className="space-y-4">
                {/* select Circle box */}
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Choose Circle</p>
                  {groups.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-foreground/10 text-center opacity-50">
                      <p className="text-[8px] font-extrabold uppercase">Create a circle sub-tab first</p>
                    </div>
                  ) : (
                    <select
                      value={selectedGroup?.id || ''}
                      onChange={e => {
                        const grp = groups.find(g => g.id === e.target.value);
                        setSelectedGroup(grp);
                      }}
                      className="w-full clay p-3.5 text-xs font-black tracking-widest rounded-xl outline-none border border-foreground/5 bg-surface text-foreground"
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedGroup && (
                  <>
                    {/* Bill specs inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black opacity-25">₹</div>
                        <input 
                          type="number"
                          required
                          value={groupExpenseAmount}
                          onChange={e => setGroupExpenseAmount(e.target.value)}
                          placeholder="Bill amount"
                          className="w-full clay-inset bg-foreground/5 p-3.5 pl-8 text-xs font-black outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl text-foreground"
                        />
                      </div>
                      <input 
                        required
                        value={groupExpenseNote}
                        onChange={e => setGroupExpenseNote(e.target.value)}
                        placeholder="Purpose / Bill tag"
                        className="w-full clay-inset bg-foreground/5 p-3.5 text-xs font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-30 text-foreground"
                      />
                    </div>

                    {/* Participating members selector */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Involved Persons</p>
                        <span className="text-[7.5px] font-extrabold text-[#FF6B6B]">{participatingMembers.length} participating</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-w-full">
                        {(selectedGroup.members || []).map((m: any) => {
                          const uid = m.user_id || m.profiles?.id;
                          if (!uid) return null;
                          const pObj = m.profiles || {};
                          const isParticipating = participatingMembers.includes(uid);
                          return (
                            <button
                              key={uid}
                              type="button"
                              onClick={() => toggleParticipatingMember(uid)}
                              className={cn(
                                "flex-shrink-0 flex items-center gap-1.5 p-1 border rounded-lg transition-all text-left shrink-0",
                                isParticipating
                                  ? "border-[#FF6B6B]/30 bg-[#FF6B6B]/5 text-foreground"
                                  : "border-transparent opacity-30 contrast-75"
                              )}
                            >
                              <img 
                                src={pObj.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${uid}`}
                                alt=""
                                className="w-5 h-5 rounded-md object-cover pointer-events-none"
                              />
                              <p className="text-[8px] font-black max-w-[50px] truncate pointer-events-none">@{pObj.username || 'user'}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Split Mode Options Toggle */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 clay-inset bg-foreground/5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSplitMode('equal')}
                        className={cn(
                          "py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1",
                          splitMode === 'equal' ? "clay bg-surface text-[#FF6B6B] shadow" : "text-foreground/45"
                        )}
                      >
                        <Scale size={10} /> Equal Splits
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode('custom')}
                        className={cn(
                          "py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1",
                          splitMode === 'custom' ? "clay bg-surface text-[#FF6B6B] shadow" : "text-foreground/45"
                        )}
                      >
                        <PieChart size={10} /> Custom Splits
                      </button>
                    </div>

                    {/* Interactive Split Feed */}
                    <div className="clay-inset p-3 bg-foreground/2 rounded-xl text-[9px] max-h-[140px] overflow-y-auto no-scrollbar space-y-2">
                      {splitMode === 'equal' ? (
                        <div className="text-center py-2 text-foreground/50 text-[10px] font-semibold flex items-center justify-center gap-1.5">
                          <Info size={12} className="text-blue-400" />
                          <span>
                            Each share is{' '}
                            <strong className="text-foreground italic">
                              ₹
                              {participatingMembers.length > 0 && groupExpenseAmount
                                ? (parseFloat(groupExpenseAmount) / participatingMembers.length).toFixed(2)
                                : '0.00'}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8.5px] border-b border-foreground/5 pb-1 opacity-60 font-black">
                            <span>MEMBER</span>
                            <span>OWES (₹)</span>
                          </div>
                          {(selectedGroup.members || [])
                            .filter((m: any) => participatingMembers.includes(m.user_id || m.profiles?.id))
                            .map((m: any) => {
                              const uid = m.user_id || m.profiles?.id;
                              const pObj = m.profiles || {};
                              return (
                                <div key={uid} className="flex justify-between items-center gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <img 
                                      src={pObj.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${uid}`}
                                      alt=""
                                      className="w-4 h-4 rounded-md pointer-events-none object-cover"
                                    />
                                    <p className="font-extrabold truncate text-foreground">@{pObj.username || 'user'}</p>
                                  </div>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={customAmounts[uid] || ''}
                                    onChange={e => handleCustomAmountChange(uid, e.target.value)}
                                    className="w-20 text-right bg-foreground/5 border border-foreground/10 px-1.5 py-0.5 rounded font-black italic select-text text-foreground placeholder:opacity-30 focus:ring-1 focus:ring-[#FF6B6B]/20 outline-none"
                                  />
                                </div>
                              );
                            })}
                          
                          {/* Live Total Tally validation indicator */}
                          <div className="flex justify-between items-center text-[8px] font-black pt-1.5 border-t border-foreground/5 mt-1">
                            <span className="opacity-45">Custom Sum:</span>
                            <span className={cn(
                              "font-black flex items-center gap-1",
                              Math.abs(getCustomTotal() - (parseFloat(groupExpenseAmount) || 0)) < 0.05
                                ? "text-emerald-500"
                                : "text-amber-500"
                            )}>
                              ₹{getCustomTotal().toFixed(2)} / ₹{parseFloat(groupExpenseAmount) || 0}
                              {Math.abs(getCustomTotal() - (parseFloat(groupExpenseAmount) || 0)) < 0.05 && (
                                <CheckCircle2 size={10} className="text-emerald-500" />
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Group splitting submit button */}
                    <button 
                      type="submit"
                      disabled={
                        loading || 
                        !groupExpenseAmount || 
                        !groupExpenseNote.trim() || 
                        participatingMembers.length === 0 ||
                        (splitMode === 'custom' && Math.abs(getCustomTotal() - (parseFloat(groupExpenseAmount) || 0)) > 0.05)
                      }
                      className="w-full py-4 mt-1 bg-[#FF6B6B] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-30 disabled:pointer-events-none"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : 'Record Bill Split'}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

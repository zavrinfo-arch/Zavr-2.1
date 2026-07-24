import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XCircle, CheckCircle2, Loader2, Wallet, Users, Calendar, Sparkles, 
  ArrowUpCircle, ArrowDownCircle, Check, Circle, RotateCw, UserPlus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';

interface CreateZettlModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends?: any[];
  onRequestMoney?: (friendId: string, amount: number, note: string, dueDate?: string) => Promise<void>;
  onSendMoney?: (friendId: string, amount: number, note: string) => Promise<void>;
  onCreateGroup?: (name: string, friendIds: string[]) => Promise<void>;
  userId?: string;
  onSuccess?: () => void;
}

export default function CreateZettlModal({
  isOpen,
  onClose,
  friends = [],
  userId,
  onSuccess
}: CreateZettlModalProps) {
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const storeDropdownFriends = useStore(state => state.friendsForDropdown);
  const refreshFriendsForDropdown = useStore(state => state.refreshFriendsForDropdown);
  
  const [activeTab, setActiveTab] = useState<'individual' | 'group'>('individual');
  const [transactionType, setTransactionType] = useState<'lent' | 'borrowed'>('lent');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [selectedGroupFriends, setSelectedGroupFriends] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(getTodayString());
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Combine friends prop with storeDropdownFriends for robust fallback
  const effectiveFriendsList = useMemo(() => {
    const map = new Map<string, any>();

    (friends || []).forEach(f => {
      const fid = f.friend_id || f.friendId || f.id;
      if (fid) map.set(fid, f);
    });

    (storeDropdownFriends || []).forEach(f => {
      const fid = f.friend_id || f.friendId || f.id;
      if (fid && !map.has(fid)) {
        map.set(fid, f);
      }
    });

    return Array.from(map.values());
  }, [friends, storeDropdownFriends]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFriendsForDropdown(true);
      toast.success('Contacts list updated');
    } catch (err) {
      console.warn('[CreateZettl] Manual refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Reset state and trigger fresh data fetch on open
  useEffect(() => {
    if (!isOpen) return;

    setSelectedFriend(null);
    setSelectedGroupFriends([]);
    setAmount('');
    setNote('');
    setDueDate(getTodayString());
    setTransactionType('lent');

    // Trigger store refresh on open
    refreshFriendsForDropdown(true).catch(() => {});

    // Listen to custom friend request accepted event
    const handleFriendAccepted = () => {
      console.log('⚡ friend-request-accepted event caught in CreateZettlModal, refreshing...');
      refreshFriendsForDropdown(true).catch(() => {});
    };

    window.addEventListener('friend-request-accepted', handleFriendAccepted);

    // Setup realtime channel for friends table
    const channel = supabase
      .channel(`modal-friends-listener-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        console.log('⚡ Realtime friends table change in CreateZettlModal');
        refreshFriendsForDropdown(true).catch(() => {});
      })
      .subscribe();

    return () => {
      window.removeEventListener('friend-request-accepted', handleFriendAccepted);
      supabase.removeChannel(channel);
    };
  }, [isOpen, refreshFriendsForDropdown]);

  if (!isOpen) return null;

  const toggleGroupFriend = (friendId: string) => {
    setSelectedGroupFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleSelectAll = () => {
    if (selectedGroupFriends.length === effectiveFriendsList.length) {
      setSelectedGroupFriends([]);
    } else {
      setSelectedGroupFriends(effectiveFriendsList.map(f => f.friendId || f.friend_id || f.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('Session not authenticated');
      return;
    }

    if (activeTab === 'individual') {
      if (!selectedFriend) {
        toast.error('Please select a contact first');
        return;
      }
    } else {
      if (selectedGroupFriends.length === 0) {
        toast.error('Please select at least one contact for Group Debt');
        return;
      }
    }

    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!note.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'individual') {
        const friendId = selectedFriend.friendId || selectedFriend.id;
        const { error } = await supabase.from('debts').insert({
          creditor_id: transactionType === 'lent' ? userId : friendId,
          user_id: transactionType === 'lent' ? friendId : userId,
          amount: totalAmount,
          purpose: note.trim(),
          status: 'pending',
          settled: false,
          due_date: dueDate || null
        });
        if (error) throw error;
        toast.success('Individual transaction recorded!');
      } else {
        const splitAmount = Math.round((totalAmount / selectedGroupFriends.length) * 100) / 100;
        const rowsToInsert = selectedGroupFriends.map(friendId => ({
          creditor_id: transactionType === 'lent' ? userId : friendId,
          user_id: transactionType === 'lent' ? friendId : userId,
          amount: splitAmount,
          purpose: note.trim(),
          status: 'pending',
          settled: false,
          due_date: dueDate || null
        }));

        const { error } = await supabase.from('debts').insert(rowsToInsert);
        if (error) throw error;
        toast.success(`Group split recorded across ${selectedGroupFriends.length} contacts!`);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  // Compute dynamic button text
  const getSubmitButtonText = () => {
    if (loading) return 'Recording...';
    
    const parsedAmount = parseFloat(amount) || 0;
    const formattedAmt = parsedAmount > 0 ? `₹${parsedAmount.toLocaleString('en-IN')}` : '';

    if (activeTab === 'individual') {
      const username = selectedFriend ? `@${selectedFriend.username || selectedFriend.friendUsername || 'friend'}` : '';
      if (transactionType === 'lent') {
        return `Lent ${formattedAmt} to ${username}`.trim();
      } else {
        return `Borrowed ${formattedAmt} from ${username}`.trim();
      }
    } else {
      const count = selectedGroupFriends.length;
      const targetText = count === 0 ? 'Circle' : `${count} Friends`;
      if (transactionType === 'lent') {
        return `Lent ${formattedAmt} to ${targetText}`.trim();
      } else {
        return `Borrowed ${formattedAmt} from ${targetText}`.trim();
      }
    }
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
        {/* Header section */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex flex-col text-left">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="text-[#FF6B6B]" size={14} />
              New Transaction
            </h3>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mt-0.5">Instant Splits & Ledgers</p>
          </div>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity p-1 hover:bg-foreground/5 rounded-lg cursor-pointer">
            <XCircle size={18} className="text-foreground" />
          </button>
        </div>

        {/* Tab Controls: Exactly Two Tab Modes */}
        <div className="flex gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('individual');
              setSelectedFriend(null);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'individual' 
                ? "clay bg-surface text-foreground shadow font-extrabold" 
                : "text-foreground/45 hover:text-foreground/85"
            )}
            id="tab-individual-debt"
          >
            <Wallet size={12} className={activeTab === 'individual' ? "text-[#FF6B6B]" : ""} />
            Individual Debt
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('group');
              setSelectedGroupFriends([]);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'group' 
                ? "clay bg-surface text-foreground shadow font-extrabold" 
                : "text-foreground/45 hover:text-foreground/85"
            )}
            id="tab-group-debt"
          >
            <Users size={12} className={activeTab === 'group' ? "text-[#FF6B6B]" : ""} />
            Group Debt
          </button>
        </div>

        {/* Unified Transaction Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Segmented Toggle for transactionType */}
          <div className="space-y-1.5 text-left">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Transaction Type</p>
            <div className="grid grid-cols-2 gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl">
              <button
                type="button"
                onClick={() => setTransactionType('lent')}
                className={cn(
                  "py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  transactionType === 'lent' 
                    ? "clay bg-surface text-emerald-500 shadow" 
                    : "text-foreground/45 hover:text-foreground/85"
                )}
                id="type-lent-btn"
              >
                <ArrowUpCircle size={12} className={transactionType === 'lent' ? "text-emerald-500 animate-pulse" : ""} />
                Lent
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('borrowed')}
                className={cn(
                  "py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  transactionType === 'borrowed' 
                    ? "clay bg-surface text-[#FF6B6B] shadow" 
                    : "text-foreground/45 hover:text-foreground/85"
                )}
                id="type-borrowed-btn"
              >
                <ArrowDownCircle size={12} className={transactionType === 'borrowed' ? "text-[#FF6B6B]" : ""} />
                Borrowed
              </button>
            </div>
          </div>

          {/* Contact selection picker (Changes based on activeTab) */}
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center px-1">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-40">
                {activeTab === 'individual' ? 'Select Contact' : 'Select Group Contacts'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1 text-[8px] font-bold uppercase text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
                  title="Refresh contacts"
                >
                  <RotateCw size={10} className={cn("transition-transform", isRefreshing && "animate-spin")} />
                  Refresh
                </button>
                {activeTab === 'group' && effectiveFriendsList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[8px] font-black uppercase text-[#FF6B6B] hover:underline cursor-pointer"
                  >
                    {selectedGroupFriends.length === effectiveFriendsList.length ? 'Clear All' : 'Select All'}
                  </button>
                )}
              </div>
            </div>

            {effectiveFriendsList.length === 0 ? (
              <div className="py-4 px-3 text-center opacity-60 border border-dashed border-foreground/10 rounded-2xl flex flex-col items-center gap-2 bg-foreground/[0.02]">
                <p className="text-[9px] font-bold uppercase tracking-wide">
                  No active links found. Connect with someone first!
                </p>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="clay bg-surface px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-[#FF6B6B] flex items-center gap-1.5 hover:scale-105 transition-transform cursor-pointer"
                >
                  <RotateCw size={11} className={isRefreshing ? "animate-spin" : ""} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Contacts'}
                </button>
              </div>
            ) : activeTab === 'individual' ? (
              /* INDIVIDUAL SINGLE-FRIEND PICKER */
              <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                {effectiveFriendsList.map((friend) => {
                  const fid = friend.friend_id || friend.friendId || friend.id;
                  const username = friend.username || friend.friendUsername || 'friend';
                  const fullName = friend.full_name || friend.friendFullName || username;
                  const avatar = friend.avatar_url || friend.friendAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`;
                  const isSelected = selectedFriend?.id === fid || selectedFriend?.friendId === fid || selectedFriend?.friend_id === fid;

                  return (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => setSelectedFriend(friend)}
                      className={cn(
                        "flex-shrink-0 w-20 p-2 rounded-2xl transition-all relative flex flex-col items-center gap-1 touch-manipulation min-h-[82px] cursor-pointer",
                        isSelected 
                          ? "clay bg-[#FF6B6B]/10 scale-105 border border-[#FF6B6B]/40" 
                          : "opacity-60 hover:opacity-100 bg-foreground/5"
                      )}
                    >
                      <img 
                        src={avatar} 
                        alt="" 
                        className="w-9 h-9 rounded-xl object-cover pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="w-full text-center min-w-0">
                        <p className="text-[8px] font-extrabold truncate w-full text-foreground/90">{fullName}</p>
                        <p className="text-[7px] font-bold opacity-50 truncate w-full">@{username}</p>
                      </div>
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-3 h-3 bg-[#FF6B6B] rounded-full border border-background flex items-center justify-center shadow-sm">
                          <Check size={8} className="text-white font-black" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* GROUP MULTI-FRIEND PICKER */
              <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1 no-scrollbar">
                {effectiveFriendsList.map((friend) => {
                  const fid = friend.friend_id || friend.friendId || friend.id;
                  const username = friend.username || friend.friendUsername || 'friend';
                  const fullName = friend.full_name || friend.friendFullName || username;
                  const avatar = friend.avatar_url || friend.friendAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`;
                  const isAdded = selectedGroupFriends.includes(fid);

                  return (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => toggleGroupFriend(fid)}
                      className={cn(
                        "flex items-center gap-2.5 p-2 rounded-xl transition-all text-left border touch-manipulation cursor-pointer",
                        isAdded 
                          ? "clay border-[#FF6B6B]/30 bg-[#FF6B6B]/5 text-foreground" 
                          : "border-foreground/5 hover:bg-foreground/5 opacity-60 text-foreground"
                      )}
                    >
                      <img 
                        src={avatar} 
                        alt="" 
                        className="w-7 h-7 rounded-lg object-cover pointer-events-none shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[8.5px] font-extrabold truncate pointer-events-none leading-tight">{fullName}</p>
                        <p className="text-[7.5px] font-medium opacity-50 truncate pointer-events-none">@{username}</p>
                      </div>
                      <div className="shrink-0">
                        {isAdded ? (
                          <CheckCircle2 size={13} className="text-[#FF6B6B]" />
                        ) : (
                          <Circle size={13} className="opacity-20 text-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount field */}
          <div className="relative text-left">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black opacity-25">₹</div>
            <input 
              type="number"
              required
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount (e.g. 1500)"
              className="w-full clay-inset bg-foreground/5 p-4 pl-10 text-lg font-black italic outline-none focus:ring-1 focus:ring-[#FF6B6B]/30 rounded-2xl placeholder:text-foreground/20 text-foreground"
              id="amount-input"
            />
          </div>

          {/* Purpose field */}
          <div className="text-left">
            <input 
              required
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did you split? (e.g., Dinner, Uber)"
              className="w-full clay-inset bg-foreground/5 p-4 text-xs font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-30 text-foreground"
              id="purpose-input"
            />
          </div>

          {/* Date Picker Component (Auto-populated with today by default) */}
          <div className="relative text-left">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1 mb-1">Due Date</p>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-25 text-foreground" size={14} />
              <input 
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full clay-inset bg-foreground/5 p-4 pl-11 text-xs font-black tracking-widest outline-none focus:ring-1 focus:ring-[#FF6B6B]/20 rounded-xl text-foreground"
                id="due-date-input"
              />
            </div>
          </div>

          {/* Submission Action Button */}
          <button 
            type="submit"
            disabled={
              loading || 
              (activeTab === 'individual' && !selectedFriend) || 
              (activeTab === 'group' && selectedGroupFriends.length === 0) || 
              !amount || 
              !note.trim()
            }
            className="w-full py-4 mt-2 bg-[#FF6B6B] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            id="record-transaction-submit-btn"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              getSubmitButtonText()
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

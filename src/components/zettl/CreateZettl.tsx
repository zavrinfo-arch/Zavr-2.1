import React, { useState } from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2, Loader2, ArrowRight, Wallet, Users, Search, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface CreateZettlModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: any[];
  onRequestMoney: (friendId: string, amount: number, note: string, dueDate?: string) => Promise<void>;
  onSendMoney: (friendId: string, amount: number, note: string) => Promise<void>;
  onCreateGroup: (name: string, friendIds: string[]) => Promise<void>;
}

export default function CreateZettlModal({
  isOpen,
  onClose,
  friends,
  onRequestMoney,
  onSendMoney,
  onCreateGroup
}: CreateZettlModalProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'pay' | 'group'>('request');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Group Creation specific states
  const [groupName, setGroupName] = useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedGroupFriends.length === 0) {
      toast.error('Please select at least 1 friend');
      return;
    }

    setLoading(true);
    try {
      await onCreateGroup(groupName, selectedGroupFriends);
      toast.success('Group initialized successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Circle creation failed');
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
    if (!note) {
      toast.error('Please enter what this is for');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'request') {
        await onRequestMoney(selectedFriend.friendId, totalAmount, note, dueDate || undefined);
      } else {
        await onSendMoney(selectedFriend.friendId, totalAmount, note);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
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
        className="w-full max-w-sm clay-card p-6 relative z-10 border-2 border-foreground/5 max-h-[90vh] overflow-y-auto no-scrollbar"
        id="create-zettl-modal-container"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex flex-col">
            <h3 className="text-lg font-black italic">New Transaction</h3>
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-0.5">Google Pay Ledger</p>
          </div>
          <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity">
            <XCircle size={24} />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl mb-5">
          {[
            { id: 'request', label: 'Request', icon: Wallet },
            { id: 'pay', label: 'Pay Now', icon: DollarSign },
            { id: 'group', label: 'Group Split', icon: Users }
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
                  ? "clay-card bg-surface text-foreground" 
                  : "text-foreground/45 hover:text-foreground/80"
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'group' ? (
          /* Transaction Forms: REQUEST or PAY */
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            {/* Friends Selector scroll view */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Select Person</p>
              <div className="flex gap-2.5 overflow-x-auto pb-2.5 custom-scrollbar no-scrollbar">
                {friends.length === 0 ? (
                  <div className="w-full p-4 text-center opacity-40">
                    <p className="text-[9px] font-bold uppercase tracking-wide">Add accepted friends to split bills!</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => setSelectedFriend(friend)}
                      className={cn(
                        "flex-shrink-0 w-16 p-2 rounded-2xl transition-all relative flex flex-col items-center",
                        selectedFriend?.id === friend.id 
                          ? "clay-card scale-105 border-2 border-[#FF6B6B]" 
                          : "opacity-45 hover:opacity-80"
                      )}
                    >
                      <img 
                        src={friend.friendAvatar} 
                        alt="" 
                        className="w-10 h-10 rounded-xl mb-1 object-cover"
                      />
                      <p className="text-[8px] font-black truncate w-full text-center">@{friend.friendUsername}</p>
                      {selectedFriend?.id === friend.id && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Money Box Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black italic opacity-25">₹</div>
              <input 
                type="number"
                required
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full clay-inset bg-foreground/5 p-4.5 pl-10 text-2xl font-black italic outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-2xl"
              />
            </div>

            {/* Purpose Input */}
            <input 
              required
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What is this split for?"
              className="w-full clay-inset bg-foreground/5 p-4 text-xs font-bold tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-50"
            />

            {/* Request specific Due Date */}
            {activeTab === 'request' && (
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-25" size={16} />
                <input 
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full clay-inset bg-foreground/5 p-4 pl-12 text-[10px] font-black tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl"
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={loading || !selectedFriend || !amount || !note}
              className="w-full py-4 mt-2 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.98] transition-all text-white uppercase tracking-widest text-xs disabled:opacity-30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : activeTab === 'request' ? 'Request Money' : 'Pay Now'}
            </button>
          </form>
        ) : (
          /* Create Circle Splitwise/GPay Group form */
          <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
            <input 
              required
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Circle name (e.g., Flatmates)"
              className="w-full clay-inset bg-foreground/5 p-4 text-xs font-bold tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-50"
            />

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Add Members</p>
              {friends.length === 0 ? (
                <div className="p-4 text-center opacity-40">
                  <p className="text-[9px] font-bold uppercase">No candidates available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1.5 custom-scrollbar">
                  {friends.map((friend) => {
                    const isAdded = selectedGroupFriends.includes(friend.friendId);
                    return (
                      <button
                        key={friend.friendlyId || friend.id}
                        type="button"
                        onClick={() => toggleGroupFriend(friend.friendId)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border transition-all text-left",
                          isAdded 
                            ? "clay-card border-coral bg-[#FF6B6B]/5 text-foreground" 
                            : "border-transparent opacity-50 hover:opacity-80"
                        )}
                      >
                        <img 
                          src={friend.friendAvatar} 
                          alt="" 
                          className="w-6 h-6 rounded-lg object-cover"
                        />
                        <p className="text-[9px] font-bold truncate">@{friend.friendUsername}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading || !groupName || selectedGroupFriends.length === 0}
              className="w-full py-4 mt-2 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.98] transition-all text-white uppercase tracking-widest text-xs disabled:opacity-30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Split Group'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

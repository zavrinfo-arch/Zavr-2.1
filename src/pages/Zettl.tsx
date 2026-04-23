import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Plus, Users, User, ArrowRight, ArrowLeft, 
  Search, Bell, Check, Clock, Shield, 
  Wallet, TrendingUp, TrendingDown, MoreVertical,
  Calendar, MessageSquare, HandCoins, Receipt,
  UserPlus, CheckCircle2, XCircle, Loader2,
  RefreshCw, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, isAfter, parseISO } from 'date-fns';

export default function Zettl() {
  const navigate = useNavigate();
  const { 
    currentUser, zettlFriends, zettlGroups, 
    personalZettls, fetchZettlData, searchZettlUsers,
    sendFriendRequest, respondToFriendRequest, createZettlGroup,
    createPersonalZettl, settleZettl, remindZettl,
    addGroupExpense
  } = useStore();

  const [activeTab, setActiveTab] = useState<'personal' | 'groups' | 'activity'>('personal');
  const [isNewZettlOpen, setIsNewZettlOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [selectedGroupForExpense, setSelectedGroupForExpense] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchZettlData();
  }, []);

  const totalOwedToMe = personalZettls
    .filter(z => !z.isSettled && z.toUserId === currentUser?.id)
    .reduce((sum, z) => sum + z.amount, 0);

  const totalIOwe = personalZettls
    .filter(z => !z.isSettled && z.fromUserId === currentUser?.id)
    .reduce((sum, z) => sum + z.amount, 0);

  const netBalance = totalOwedToMe - totalIOwe;

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchZettlUsers(val);
    setSearchResults(results);
    setIsSearching(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-foreground">ZETTL</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mt-1">Settle up with friends</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 clay-inset flex items-center justify-center text-foreground/40"
          >
            <UserPlus size={20} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-xl overflow-hidden clay-card p-0.5 border-2 border-[#FF6B6B]"
          >
            <img 
              src={currentUser?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser?.username}`} 
              alt="Profile" 
              className="w-full h-full object-cover rounded-lg"
            />
          </motion.button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B6B]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Net Balance</p>
              <h2 className={cn(
                "text-4xl font-black italic tracking-tighter",
                netBalance >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
              </h2>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              netBalance >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
              {netBalance >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-foreground/5 relative z-10">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Owed to you</p>
              <p className="text-lg font-black text-emerald-500 italic tracking-tight">{formatCurrency(totalOwedToMe)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">You owe</p>
              <p className="text-lg font-black text-red-500 italic tracking-tight">{formatCurrency(totalIOwe)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 clay-inset bg-foreground/5 rounded-2xl">
        {[
          { id: 'personal', label: 'Personal', icon: User },
          { id: 'groups', label: 'Groups', icon: Users },
          { id: 'activity', label: 'Activity', icon: RefreshCw },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab.id 
                ? "clay-card bg-surface text-foreground" 
                : "text-foreground/30 hover:text-foreground/50"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          {activeTab === 'personal' && (
            <motion.div 
              key="personal"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Your Debts</h3>
                <button 
                  onClick={() => setIsNewZettlOpen(true)}
                  className="w-8 h-8 clay-coral rounded-lg flex items-center justify-center text-white"
                >
                  <Plus size={16} />
                </button>
              </div>

              {personalZettls.length === 0 ? (
                <div className="clay-card p-12 text-center opacity-30 mt-4">
                  <HandCoins size={48} className="mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No active Zettls yet.<br/>Time to settle up!</p>
                </div>
              ) : (
                personalZettls.map(zettl => (
                  <ZettlItem key={zettl.id} zettl={zettl} currentUser={currentUser!} onSettle={() => settleZettl(zettl.id)} onRemind={() => remindZettl(zettl.id)} />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'groups' && (
            <motion.div 
              key="groups"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Your Circles</h3>
                <button 
                  onClick={() => setIsNewGroupOpen(true)}
                  className="w-8 h-8 clay-coral rounded-lg flex items-center justify-center text-white"
                >
                  <Plus size={16} />
                </button>
              </div>

              {zettlGroups.length === 0 ? (
                <div className="clay-card p-12 text-center opacity-30 mt-4">
                  <Users size={48} className="mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">Join or create a group<br/>to split house expenses!</p>
                </div>
              ) : (
                zettlGroups.map(group => (
                  <GroupItem key={group.id} group={group} onAddExpense={(g) => setSelectedGroupForExpense(g)} />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div 
              key="activity"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="clay-card p-12 text-center opacity-30 mt-4">
                <RefreshCw size={48} className="mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">Recent activity will<br/>appear here</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals will go here */}
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSearch={handleSearch}
        results={searchResults}
        loading={isSearching}
        onSendRequest={sendFriendRequest}
        friends={zettlFriends}
      />

      <NewZettlModal 
        isOpen={isNewZettlOpen}
        onClose={() => setIsNewZettlOpen(false)}
        friends={zettlFriends.filter(f => f.status === 'accepted')}
        onCreate={createPersonalZettl}
      />

      <NewGroupModal 
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        friends={zettlFriends.filter(f => f.status === 'accepted')}
        onCreate={createZettlGroup}
      />

      {selectedGroupForExpense && (
        <NewExpenseModal
          isOpen={!!selectedGroupForExpense}
          onClose={() => setSelectedGroupForExpense(null)}
          group={selectedGroupForExpense}
          onCreate={addGroupExpense}
          currentUser={currentUser!}
        />
      )}

    </div>
  );
}


interface ZettlItemProps {
  key?: any;
  zettl: any;
  currentUser: any;
  onSettle: () => void;
  onRemind: () => void;
}

function ZettlItem({ zettl, currentUser, onSettle, onRemind }: ZettlItemProps) {
  const isOwed = zettl.toUserId === currentUser.id;
  const friendName = isOwed ? zettl.fromUsername : zettl.toUsername;
  const [reminding, setReminding] = useState(false);

  const handleRemind = async () => {
    setReminding(true);
    try {
      await onRemind();
      toast.success(`Reminder sent to @${friendName}!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReminding(false);
    }
  };

  return (
    <motion.div 
      whileHover={{ scale: 0.98 }}
      className="clay-card p-4 flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 clay-inset p-0.5 rounded-xl border border-foreground/5">
          <img 
            src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${friendName}`} 
            alt="Friend" 
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black italic tracking-tight underline underline-offset-4 decoration-[#FF6B6B]/20">@{friendName}</h4>
            {zettl.isSettled && <CheckCircle2 size={12} className="text-emerald-500" />}
          </div>
          <p className="text-[10px] font-bold opacity-30 mt-0.5 uppercase tracking-widest line-clamp-1">{zettl.note || 'No note added'}</p>
          {!zettl.isSettled && zettl.dueDate && (
             <p className={cn(
               "text-[8px] font-black uppercase tracking-widest mt-1",
               isAfter(new Date(), parseISO(zettl.dueDate)) ? "text-red-500" : "opacity-40"
             )}>
               Due: {format(parseISO(zettl.dueDate), 'MMM dd, yyyy')}
             </p>
          )}
        </div>
      </div>
      
      <div className="text-right flex flex-col items-end gap-2">
        <p className={cn(
          "text-xl font-black italic tracking-tighter",
          zettl.isSettled ? "opacity-20 line-through" : (isOwed ? "text-emerald-500" : "text-red-500")
        )}>
          {formatCurrency(zettl.amount)}
        </p>
        
        {!zettl.isSettled && (
          <div className="flex gap-1">
            {isOwed && (
              <button 
                onClick={handleRemind}
                disabled={reminding}
                className="w-8 h-8 clay-inset flex items-center justify-center text-foreground hover:text-[#FF6B6B] transition-colors disabled:opacity-50"
              >
                {reminding ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              </button>
            )}
            <button 
              onClick={() => {
                if (confirm(`Mark ${formatCurrency(zettl.amount)} from @${friendName} as settled?`)) {
                  onSettle();
                }
              }}
              className="w-8 h-8 clay-inset flex items-center justify-center text-foreground hover:text-emerald-500 transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface GroupItemProps {
  key?: any;
  group: any;
  onAddExpense: (g: any) => void;
}

function GroupItem({ group, onAddExpense }: GroupItemProps) {
  return (
    <motion.div 
      whileHover={{ scale: 0.98 }}
      className="clay-card p-4 flex items-center justify-between group"
    >
      <div className="flex items-center gap-4 flex-1" onClick={() => toast.success("Opening group details soon!")}>
        <div className="w-12 h-12 clay-inset bg-foreground/5 flex items-center justify-center rounded-xl text-[#FF6B6B]">
          <Users size={24} />
        </div>
        <div>
          <h4 className="text-sm font-black italic tracking-tight underline underline-offset-4 decoration-[#FF6B6B]/20">#{group.name}</h4>
          <p className="text-[10px] font-bold opacity-30 mt-0.5 uppercase tracking-widest">{group.memberCount} members</p>
        </div>
      </div>
      <div className="text-right flex items-center gap-4">
        <div>
          <p className={cn(
            "text-base font-black italic tracking-tighter",
            (group.myBalance || 0) >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            {(group.myBalance || 0) >= 0 ? '+' : ''}{formatCurrency(group.myBalance || 0)}
          </p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onAddExpense(group); }}
          className="w-10 h-10 clay-inset rounded-xl flex items-center justify-center text-[#FF6B6B] hover:scale-110 transition-transform"
        >
          <Receipt size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function ChevronIcon({ direction }: { direction: 'right' | 'left' }) {
  return (
    <div className="opacity-20">
       <ArrowRight size={14} />
    </div>
  );
}

function SearchModal({ isOpen, onClose, onSearch, results, loading, onSendRequest, friends }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm clay-card p-6 relative z-10"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black italic">Find Friends</h3>
          <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity"><XCircle size={24} /></button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
          <input 
            autoFocus
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by username..."
            className="w-full clay-inset bg-foreground/5 p-4 pl-12 text-sm font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
          />
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center opacity-30"><Loader2 className="animate-spin mx-auto" /></div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Type to search for friends</div>
          ) : (
            results.map(user => {
              const friendStatus = friends.find((f: any) => f.friendId === user.id)?.status;
              return (
                <div key={user.id} className="clay-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 clay-inset rounded-lg overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${user.username}`} alt="" />
                    </div>
                    <div>
                      <p className="text-sm font-black italic tracking-tight underline decoration-[#FF6B6B]/20">@{user.username}</p>
                      <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.1em]">{user.full_name}</p>
                    </div>
                  </div>
                  {friendStatus === 'accepted' ? (
                     <CheckCircle2 size={20} className="text-emerald-500 opacity-50" />
                  ) : friendStatus === 'pending' ? (
                     <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Pending</p>
                  ) : (
                    <button 
                      onClick={() => onSendRequest(user.id)}
                      className="w-8 h-8 clay-coral rounded-lg flex items-center justify-center text-white"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}

function NewZettlModal({ isOpen, onClose, friends, onCreate }: any) {
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !amount) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await onCreate({
        friendId: selectedFriend.friendId,
        amount: parseInt(amount),
        note,
        dueDate: dueDate || undefined,
        direction
      });
      toast.success('Zettl created!');
      onClose();
    } catch (err) {
      toast.error('Failed to create Zettl');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm clay-card p-6 relative z-10"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black italic">New Zettl</h3>
          <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity"><XCircle size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Select Friend</p>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {friends.length === 0 ? (
                <p className="text-[9px] font-bold opacity-30 p-4">Add friends to start zettling!</p>
              ) : (
                friends.map((f: any) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFriend(f)}
                    className={cn(
                      "flex-shrink-0 w-16 p-2 rounded-xl transition-all",
                      selectedFriend?.id === f.id ? "clay-card scale-105 border-2 border-[#FF6B6B]" : "opacity-40"
                    )}
                  >
                    <img src={f.friendAvatar} alt="" className="w-10 h-10 mx-auto rounded-lg mb-1" />
                    <p className="text-[8px] font-black truncate">@{f.friendUsername}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('lent')}
              className={cn(
                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                direction === 'lent' ? "clay-card text-emerald-500 border-2 border-emerald-500/20" : "clay-inset opacity-40"
              )}
            >
              I Lent
            </button>
            <button
              type="button"
              onClick={() => setDirection('borrowed')}
              className={cn(
                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                direction === 'borrowed' ? "clay-card text-red-500 border-2 border-red-500/20" : "clay-inset opacity-40"
              )}
            >
              I Borrowed
            </button>
          </div>

          <div className="relative">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black italic opacity-20">₹</div>
             <input 
               type="number"
               value={amount}
               onChange={e => setAmount(e.target.value)}
               placeholder="Amount"
               className="w-full clay-inset bg-foreground/5 p-4 pl-10 text-xl font-black italic outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
             />
          </div>

          <input 
             value={note}
             onChange={e => setNote(e.target.value)}
             placeholder="What's this for? (e.g. Lunch, Movie)"
             className="w-full clay-inset bg-foreground/5 p-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
          />

          <div className="relative">
             <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
             <input 
               type="date"
               value={dueDate}
               onChange={e => setDueDate(e.target.value)}
               className="w-full clay-inset bg-foreground/5 p-4 pl-12 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
             />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-4 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all text-white uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Create Zettl'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NewGroupModal({ isOpen, onClose, friends, onCreate }: any) {
  const [name, setName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || selectedFriends.length === 0) {
      toast.error('Please add at least one friend');
      return;
    }
    setLoading(true);
    try {
      await onCreate(name, selectedFriends);
      toast.success('Group created!');
      onClose();
    } catch (err) {
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm clay-card p-6 relative z-10"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black italic">Create Circle</h3>
          <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity"><XCircle size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
             value={name}
             onChange={e => setName(e.target.value)}
             placeholder="Group Name (e.g. Lunch Crew)"
             className="w-full clay-inset bg-foreground/5 p-4 text-sm font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
          />

          <div className="space-y-3">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Add Members</p>
             <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {friends.map((f: any) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFriend(f.friendId)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-xl border transition-all",
                      selectedFriends.includes(f.friendId) 
                        ? "clay-card border-[#FF6B6B] bg-[#FF6B6B]/5" 
                        : "border-transparent opacity-40"
                    )}
                  >
                    <img src={f.friendAvatar} alt="" className="w-6 h-6 rounded-lg" />
                    <p className="text-[9px] font-bold truncate">@{f.friendUsername}</p>
                  </button>
                ))}
             </div>
             {friends.length === 0 && <p className="text-[9px] font-bold opacity-30 p-4">Add friends to create a circle!</p>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl text-white uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Start Circle'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NewExpenseModal({ isOpen, onClose, group, onCreate, currentUser }: any) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) {
      toast.error('Please fill all fields');
      return;
    }
    
    setLoading(true);
    try {
      const totalAmount = parseInt(amount);
      await onCreate({
        groupId: group.id,
        amount: totalAmount,
        description,
        splits: [] 
      });
      
      toast.success('Expense added to group!');
      onClose();
    } catch (err) {
      toast.error('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm clay-card p-6 relative z-10"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="text-lg font-black italic">Add Expense</h3>
            <p className="text-[10px] font-bold opacity-30 uppercase">{group.name}</p>
          </div>
          <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity"><XCircle size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black italic opacity-20">₹</div>
             <input 
               type="number"
               autoFocus
               value={amount}
               onChange={e => setAmount(e.target.value)}
               placeholder="Total Amount"
               className="w-full clay-inset bg-foreground/5 p-4 pl-10 text-2xl font-black italic outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
             />
          </div>

          <input 
             value={description}
             onChange={e => setDescription(e.target.value)}
             placeholder="Description (e.g. Pizza, Uber)"
             className="w-full clay-inset bg-foreground/5 p-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
          />

          <div className="p-4 clay-inset bg-foreground/5 rounded-2xl">
             <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Split Type</p>
                <div className="px-2 py-1 bg-[#FF6B6B]/10 text-[#FF6B6B] rounded text-[8px] font-black uppercase">Equal</div>
             </div>
             <p className="text-[10px] font-bold leading-relaxed opacity-60 italic">
               The amount will be split equally between you and {group.memberCount - 1} other members.
             </p>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-4 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl text-white uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Split Bill'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

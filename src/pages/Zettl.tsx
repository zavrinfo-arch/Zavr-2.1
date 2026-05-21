import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useZettl } from '../hooks/useZettl';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Icons
import { 
  Plus, Users, UserPlus, ArrowLeft, Search, Bell, Clock, 
  Smartphone, Share2, MoreVertical, CheckCircle2, XCircle, Loader2, RefreshCw 
} from 'lucide-react';

// Subcomponents
import ZettlDashboard from '../components/zettl/Dashboard';
import CreateZettlModal from '../components/zettl/CreateZettl';
import GroupZettl from '../components/zettl/GroupZettl';
import FriendDetail from '../components/zettl/FriendDetail';
import ActivityFeed from '../components/zettl/ActivityFeed';
import NotificationCenter from '../components/zettl/NotificationCenter';
import DashboardDebtCards from '../components/DashboardDebtCards';
import FriendSystem from '../components/FriendSystem';
import ChatDebt from '../components/ChatDebt';
import GroupDebtChat from '../components/GroupDebtChat';

export default function Zettl() {
  const navigate = useNavigate();
  const { 
    currentUser, 
    zettlFriends, 
    zettlGroups, 
    personalZettls, 
    fetchZettlData, 
    searchZettlUsers,
    sendFriendRequest, 
    respondToFriendRequest 
  } = useStore();

  const zettl = useZettl();

  // Navigation states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'groups' | 'timeline'>('dashboard');
  const [selectedFriendDetail, setSelectedFriendDetail] = useState<any>(null);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<any>(null);

  // Modal open states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Settle helper triggers
  const [settlingZettl, setSettlingZettl] = useState<string | null>(null);

  useEffect(() => {
    fetchZettlData();

    // Subscribe to friends and personal_zettls changes for real-time updates
    const channel = supabase
      .channel('zettl_realtime_full')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friends' 
      }, () => {
        console.log('[ZETTL] Friends synchronized, updating context...');
        fetchZettlData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'personal_zettls'
      }, () => {
        console.log('[ZETTL] Personal zettls table synchronized, updating context...');
        fetchZettlData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pendingIncoming = zettlFriends.filter(f => f.status === 'pending' && f.type === 'incoming');

  const handleSearchUsers = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchZettlUsers(val);
      setSearchResults(results || []);
    } catch (err) {
      console.error('Search friends error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriendAction = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      toast.success('Friend invitation dispatched!');
      handleSearchUsers(searchQuery);
    } catch (err: any) {
      toast.error(err.message || 'Invitation failed');
    }
  };

  const handleDeclineRequest = async (id: string) => {
    try {
      await respondToFriendRequest(id, 'declined');
      toast.success('Invitation declined');
      fetchZettlData();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleAcceptRequest = async (id: string) => {
    try {
      await respondToFriendRequest(id, 'accepted');
      toast.success('Invitation accepted! Linked.');
      fetchZettlData();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Brand Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-foreground text-[#FF6B6B]">ZETTL</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-35 mt-1">Settle up like Google Pay</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 clay-inset flex items-center justify-center text-foreground/42 relative"
          >
            <Bell size={18} />
            {pendingIncoming.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6B6B] rounded-full animate-ping" />
            )}
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsAddFriendOpen(true)}
            className="w-10 h-10 clay-inset flex items-center justify-center text-foreground/42"
            title="Add Friend"
          >
            <UserPlus size={18} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-xl overflow-hidden clay-card p-0.5 border-2 border-foreground/5"
          >
            <img 
              src={currentUser?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser?.username}`} 
              alt="Profile" 
              className="w-full h-full object-cover rounded-lg"
            />
          </motion.button>
        </div>
      </div>

      {/* Main Single-Screen Content router */}
      <AnimatePresence mode="wait">
        {selectedFriendDetail ? (
          /* Conversation Friend Detail View */
          <motion.div
            key="friend-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              onClick={() => setSelectedFriendDetail(null)}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded-lg text-xs font-bold uppercase cursor-pointer"
            >
              ← Back to Ledger
            </button>
            <ChatDebt friend={selectedFriendDetail} />
          </motion.div>
        ) : selectedGroupDetail ? (
          /* Group Splits and members detail view */
          <motion.div
            key="group-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              onClick={() => setSelectedGroupDetail(null)}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded-lg text-xs font-bold uppercase cursor-pointer"
            >
              ← Back to Groups
            </button>
            <GroupDebtChat group={selectedGroupDetail} />
          </motion.div>
        ) : (
          /* Tabs and main Dashboard View */
          <motion.div
            key="tabs-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Tab selection menu */}
            <div className="flex gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl">
              {[
                { id: 'dashboard', label: 'Overview' },
                { id: 'groups', label: 'Group Splits' },
                { id: 'timeline', label: 'Timeline log' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 text-center py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    activeTab === tab.id ? "clay-card bg-surface text-foreground" : "text-foreground/45 hover:text-foreground/80"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* active tab view router */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <DashboardDebtCards onSelectFriend={(f) => setSelectedFriendDetail(f)} />
                <FriendSystem />
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Your Circles</h3>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsCreateOpen(true)}
                    className="px-3 py-1.5 clay-inset hover:bg-foreground/5 rounded-xl text-[9px] font-black uppercase text-[#FF6B6B] border border-[#FF6B6B]/10"
                  >
                    + NEW GROUP
                  </motion.button>
                </div>

                {zettlGroups.length === 0 ? (
                  <div className="clay-card p-12 text-center opacity-40 border border-dashed border-foreground/10">
                    <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No joint circles logged yet.<br/>Initiate a split circle above!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {zettlGroups.map((g) => (
                      <motion.div
                        key={g.id}
                        whileHover={{ y: -2 }}
                        onClick={() => setSelectedGroupDetail(g)}
                        className="clay-card p-4 border border-foreground/5 flex justify-between items-center cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 clay-inset rounded-xl flex items-center justify-center bg-[#FF6B6B]/10 text-coral">
                            <Users size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black italic">#{g.name}</h4>
                            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-0.5">
                              {g.memberCount} active members
                            </p>
                          </div>
                        </div>
                        <MoreVertical size={16} className="opacity-25" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <ActivityFeed 
                activities={zettl.activities}
                onRefresh={() => zettl.refresh()}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal overlays and loaders */}

      {/* 1. Transaction Form Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateZettlModal 
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            friends={zettl.friendBalances}
            onRequestMoney={(friendId, amount, note, due) => zettl.requestMoney(friendId, amount, note, due)}
            onSendMoney={(friendId, amount, note) => zettl.sendMoney(friendId, amount, note)}
            onCreateGroup={(name, friends) => zettl.createGroupZettl(name, friends)}
          />
        )}
      </AnimatePresence>

      {/* 2. Notification dropover */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <NotificationCenter 
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onPayRequest={(id) => zettl.payDebt(id)}
          />
        )}
      </AnimatePresence>

      {/* 3. Add Friend Search Slideover */}
      <AnimatePresence>
        {isAddFriendOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddFriendOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm clay-card p-6 relative z-10 border-2 border-foreground/5 max-h-[80vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-black italic">Search Zavr</h3>
                <button onClick={() => { setIsAddFriendOpen(false); setSearchQuery(''); setSearchResults([]); }} className="opacity-20 hover:opacity-100">
                  <XCircle size={22} />
                </button>
              </div>

              {/* Input field */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" size={15} />
                <input 
                  value={searchQuery}
                  onChange={e => handleSearchUsers(e.target.value)}
                  placeholder="Enter username..."
                  className="w-full clay-inset bg-foreground/5 p-3.5 pl-10 text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-50"
                />
              </div>

              {/* Incoming invites checklist inside Friend modal */}
              {pendingIncoming.length > 0 && (
                <div className="mb-4 bg-[#FF6B6B]/5 p-3 rounded-2xl space-y-2 border border-[#FF6B6B]/15">
                  <p className="text-[8px] font-black uppercase text-coral text-[#FF6B6B] tracking-widest">Incoming Friend Link Requests</p>
                  <div className="space-y-1.5">
                    {pendingIncoming.map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center text-[10px] bg-background/40 p-2 rounded-xl">
                        <span className="font-bold">@{inv.friendUsername}</span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleAcceptRequest(inv.id)}
                            className="px-2 py-1 bg-emerald-500 text-white rounded-md text-[8px] font-bold"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleDeclineRequest(inv.id)}
                            className="px-2 py-1 bg-foreground/5 text-foreground/50 rounded-md text-[8px] font-bold"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search result items */}
              <div className="space-y-2.5">
                {isSearching ? (
                  <div className="py-6 text-center opacity-40">
                    <Loader2 size={18} className="animate-spin mx-auto text-[#FF6B6B]" />
                  </div>
                ) : searchResults.length === 0 && searchQuery ? (
                  <p className="text-[10px] text-center opacity-30 uppercase font-bold py-4">No matched profiles discovered</p>
                ) : (
                  searchResults.map((user) => {
                    // Check if already friends or pending
                    const linked = zettlFriends.find(f => f.friendId === user.id);
                    const isPending = linked?.status === 'pending';
                    const isAccepted = linked?.status === 'accepted';

                    return (
                      <div key={user.id} className="flex justify-between items-center p-3.5 clay-inset bg-foreground/1 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg overflow-hidden clay-inset">
                            <img src={user.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.username}`} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-xs font-black italic">@{user.username}</p>
                            <p className="text-[8px] opacity-35 font-bold uppercase">{user.full_name}</p>
                          </div>
                        </div>

                        {isAccepted ? (
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Linked ✓</span>
                        ) : isPending ? (
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Pending</span>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAddFriendAction(user.id)}
                            className="px-3 py-1.5 bg-[#FF6B6B] text-white rounded-xl text-[8.5px] font-black uppercase tracking-widest"
                          >
                            Connect
                          </motion.button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

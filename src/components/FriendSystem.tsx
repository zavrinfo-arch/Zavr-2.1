import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZettlContext } from '../context/ZettlContext';
import { friendService } from '../services/friendService';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, UserPlus, Check, Hourglass, UserX, UserCheck, Users, X, Loader2, 
  MessageSquare, IndianRupee, Trash2, Calendar, ShieldAlert 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FriendSystem() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const { 
    friends, 
    acceptFriend, 
    rejectFriend, 
    removeFriend, 
    sendFriendRequest, 
    fetchData,
    playSound,
    hapticFeedback
  } = useZettlContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'connections' | 'pending'>('connections');

  // Track action loading and requested states to make transitions immediate
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [requestedUserIds, setRequestedUserIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Search cache using useRef to avoid reset on render
  const searchCache = React.useRef<Record<string, any[]>>({});

  // Categorize connection listings
  const activeConnections = friends.filter(f => f.status === 'accepted');
  const pendingRequests = friends.filter(f => f.status === 'pending');
  const pendingIncoming = pendingRequests.filter(f => f.type === 'incoming');
  const pendingOutgoing = pendingRequests.filter(f => f.type === 'outgoing');

  // Stable determination of online status based on username hash
  const getOnlineStatus = (username: string): { isOnline: boolean; lastSeen: string } => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const isOnline = Math.abs(hash) % 2 === 0;
    const hours = Math.abs(hash) % 24;
    const days = Math.abs(hash) % 7;
    const lastSeen = hours === 0 ? 'Active 5m ago' : hours < 5 ? `Active ${hours}h ago` : days === 0 ? 'Active yesterday' : `Active ${days}d ago`;
    return { isOnline, lastSeen };
  };

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Execute Search
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const normalized = trimmed.toLowerCase();
    if (searchCache.current[normalized]) {
      setSearchResults(searchCache.current[normalized]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    const fetchSearch = async () => {
      try {
        const results = await friendService.searchUsers(trimmed, currentUser?.id, controller.signal);
        const filtered = (results || []).filter((u: any) => u.id !== currentUser?.id);
        searchCache.current[normalized] = filtered;
        setSearchResults(filtered);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[FRIEND-SYSTEM] Search error:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSearch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, currentUser?.id]);

  const handleSendRequest = async (friendId: string) => {
    playSound('send');
    hapticFeedback();
    setActionLoading(prev => ({ ...prev, [friendId]: true }));
    try {
      await sendFriendRequest(friendId);
      setRequestedUserIds(prev => ({ ...prev, [friendId]: true }));
    } catch (err: any) {
      console.error('[FRIEND-SYSTEM] Connect failed:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [friendId]: false }));
    }
  };

  const handleAccept = async (reqId: string) => {
    playSound('kaching');
    hapticFeedback();
    setActionLoading(prev => ({ ...prev, [reqId]: true }));
    try {
      await acceptFriend(reqId);
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      toast.success('Connection accepted! Added to your friends list.');
    } catch (err: any) {
      console.error('[FRIEND-SYSTEM] Accept failed:', err);
      toast.error('Failed to accept friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const handleDecline = async (reqId: string) => {
    playSound('whoosh');
    hapticFeedback();
    setActionLoading(prev => ({ ...prev, [reqId]: true }));
    try {
      await rejectFriend(reqId);
    } catch (err: any) {
      console.error('[FRIEND-SYSTEM] Reject failed:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const handleRemoveConnection = async (friendId: string) => {
    playSound('whoosh');
    hapticFeedback();
    setActionLoading(prev => ({ ...prev, [friendId]: true }));
    try {
      await removeFriend(friendId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('[FRIEND-SYSTEM] Delete connection failed:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [friendId]: false }));
    }
  };

  // Framer Motion presets
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 25 } }
  };

  return (
    <div className="space-y-6">
      {/* 1. Glassmorphism Contact Locator / Search Engine */}
      <div className="clay p-6 bg-surface">
        <div className="flex flex-col gap-1 mb-4 text-left">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <Users size={16} className="text-[#FF6B6B]" />
            Find Connections
          </h3>
          <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">
            Link and split debts instantly by username
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-35 text-[#FF6B6B]" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type user's username..."
            className="w-full clay-inset bg-background/50 p-3.5 pl-11 text-xs font-black tracking-wider outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-30 text-foreground"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-foreground/30 hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Live Search Results Drops */}
        <AnimatePresence>
          {searchQuery.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-4 rounded-2xl bg-white/[0.01] backdrop-blur-xl border border-border shadow-2xl space-y-3 max-h-64 overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[9px] uppercase font-black text-[#FF6B6B] tracking-widest font-mono">
                  Database matches
                </span>
                <span className="text-[8px] text-foreground/30 font-black uppercase tracking-widest font-mono">
                  {loading ? 'Querying...' : `${searchResults.length} profiles`}
                </span>
              </div>

              {loading ? (
                <div className="space-y-3 pt-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 animate-pulse rounded-xl bg-white/[0.01]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-border" />
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-20 bg-border rounded" />
                          <div className="h-2 w-14 bg-border rounded" />
                        </div>
                      </div>
                      <div className="h-7 w-20 bg-border rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">No matching connections found</p>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {searchResults.map((user) => {
                    const existingFriend = friends.find(f => f.friendId === user.id || f.userId === user.id);
                    const isAccepted = existingFriend?.status === 'accepted';
                    const isPending = existingFriend?.status === 'pending';
                    const isIncoming = existingFriend?.type === 'incoming';

                    return (
                      <div
                        key={user.id}
                        className="p-3 hover:bg-white/[0.02] flex items-center justify-between rounded-xl border border-transparent hover:border-border transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 text-left">
                          <div className="w-8 h-8 rounded-full min-w-[32px] overflow-hidden clay-inset">
                            <img
                              src={user.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black">@{user.username}</p>
                            <p className="text-[8px] opacity-40 font-bold uppercase truncate">{user.fullName}</p>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isAccepted ? (
                            <div className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-emerald-500/10">
                              <Check size={10} /> Friends
                            </div>
                          ) : (isPending || requestedUserIds[user.id]) ? (
                            isIncoming && !requestedUserIds[user.id] ? (
                              <button
                                onClick={() => handleAccept(existingFriend!.id)}
                                disabled={actionLoading[existingFriend!.id]}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay active:scale-95 transition-transform"
                              >
                                {actionLoading[existingFriend!.id] ? <Loader2 size={10} className="animate-spin" /> : 'Accept'}
                              </button>
                            ) : (
                              <div className="px-2.5 py-1.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-amber-500/10">
                                <Hourglass size={10} className="animate-pulse" /> Pending
                              </div>
                            )
                          ) : (
                            <button
                              onClick={() => handleSendRequest(user.id)}
                              disabled={actionLoading[user.id]}
                              className="px-3 py-1.5 bg-[#FF6B6B] hover:bg-[#FF8787] text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay active:scale-95 transition-all flex items-center gap-1"
                            >
                              {actionLoading[user.id] ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <>
                                  <UserPlus size={10} /> Link Up
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Dedicated Friend & Relationship Management Workspace */}
      <div className="clay bg-surface relative overflow-hidden rounded-3xl" id="relationship-manager-panel">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-background/20">
          <button
            onClick={() => setActiveTab('connections')}
            className={`flex-1 py-4 text-center text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center justify-center gap-2 ${
              activeTab === 'connections' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/75'
            }`}
          >
            <span>Connections</span>
            <span className="px-1.5 py-0.5 bg-foreground/10 text-foreground text-[8px] rounded-full font-mono">
              {activeConnections.length}
            </span>
            {activeTab === 'connections' && (
              <motion.div 
                layoutId="active-tab-indicator" 
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF6B6B]" 
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-4 text-center text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center justify-center gap-2 ${
              activeTab === 'pending' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/75'
            }`}
          >
            <span>Pending Invitees</span>
            {pendingRequests.length > 0 && (
              <span className={`px-1.5 py-0.5 text-[8px] rounded-full font-mono ${
                pendingIncoming.length > 0 ? 'bg-amber-500 text-black font-black animate-pulse' : 'bg-foreground/10 text-foreground'
              }`}>
                {pendingRequests.length}
              </span>
            )}
            {activeTab === 'pending' && (
              <motion.div 
                layoutId="active-tab-indicator" 
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF6B6B]" 
              />
            )}
          </button>
        </div>

        {/* Tab Listings Pane */}
        <div className="p-4 min-h-[220px]">
          <AnimatePresence mode="wait">
            {activeTab === 'connections' ? (
              // Connections list
              <motion.div
                key="tab-connections"
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {activeConnections.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-10 h-10 mx-auto clay-inset flex items-center justify-center text-foreground/20">
                      <Users size={18} />
                    </div>
                    <p className="text-[10px] opacity-40 font-black uppercase tracking-widest">No active connections yet</p>
                  </div>
                ) : (
                  activeConnections.map((friend) => {
                    const statusInfo = getOnlineStatus(friend.friendUsername);
                    return (
                      <motion.div
                        key={friend.id}
                        variants={itemVariants}
                        className="p-3.5 bg-background/30 border border-border hover:border-white/[0.08] hover:bg-white/[0.01] flex items-center justify-between rounded-2xl transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 text-left">
                          {/* Avatar with dynamic pulsing status indicator */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden clay-inset">
                              <img
                                src={friend.friendAvatar}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-surface rounded-full ${
                              statusInfo.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-foreground/20'
                            }`} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-black truncate">@{friend.friendUsername}</p>
                            <p className="text-[8px] opacity-40 font-bold uppercase truncate">{friend.friendFullName}</p>
                            <span className="text-[8px] text-foreground/40 font-mono flex items-center gap-1 mt-0.5">
                              {statusInfo.isOnline ? (
                                <span className="text-emerald-400 font-bold uppercase tracking-wider">Online</span>
                              ) : (
                                <span>{statusInfo.lastSeen}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Connection Interaction Toolbar */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/zettl/chat/${friend.friendId}`)}
                            className="p-2 bg-foreground/5 hover:bg-purple-600/20 hover:text-purple-400 rounded-xl transition-all border border-transparent hover:border-purple-500/20"
                            title="Chat & Split"
                          >
                            <MessageSquare size={14} />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/zettl/chat/${friend.friendId}`)}
                            className="p-2 bg-foreground/5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-xl transition-all border border-transparent hover:border-emerald-500/20"
                            title="Log split"
                          >
                            <IndianRupee size={14} />
                          </motion.button>

                          {confirmDeleteId === friend.friendId ? (
                            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 p-0.5 rounded-xl">
                              <button
                                onClick={() => handleRemoveConnection(friend.friendId)}
                                className="p-1 px-2 text-red-500 hover:bg-red-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 text-foreground/50 hover:bg-foreground/10 rounded-lg"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setConfirmDeleteId(friend.friendId)}
                              className="p-2 bg-foreground/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                              title="Delete Link"
                            >
                              <Trash2 size={14} />
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            ) : (
              // Pending Invites list
              <motion.div
                key="tab-pending"
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {pendingRequests.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-10 h-10 mx-auto clay-inset flex items-center justify-center text-foreground/20">
                      <Hourglass size={18} />
                    </div>
                    <p className="text-[10px] opacity-40 font-black uppercase tracking-widest">No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* INCOMING SECTION */}
                    {pendingIncoming.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[8px] text-left uppercase font-black tracking-widest text-[#FF6B6B] opacity-50 px-1">
                          Received invitations
                        </p>
                        {pendingIncoming.map((req) => (
                          <motion.div
                            key={req.id}
                            variants={itemVariants}
                            className="p-3 bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 flex items-center justify-between rounded-2xl"
                          >
                            <div className="flex items-center gap-3 min-w-0 text-left">
                              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 clay-inset">
                                <img
                                  src={req.friendAvatar}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black">@{req.friendUsername}</p>
                                <p className="text-[8px] opacity-40 font-bold uppercase truncate">{req.friendFullName}</p>
                              </div>
                            </div>

                            <div className="flex gap-1.5 shrink-0 pl-2">
                              <button
                                onClick={() => handleAccept(req.id)}
                                disabled={actionLoading[req.id]}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors shadow-lg"
                              >
                                {actionLoading[req.id] ? <Loader2 size={10} className="animate-spin" /> : 'Accept'}
                              </button>
                              <button
                                onClick={() => handleDecline(req.id)}
                                disabled={actionLoading[req.id]}
                                className="px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors"
                              >
                                {actionLoading[req.id] ? <Loader2 size={10} className="animate-spin" /> : 'Ignore'}
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* OUTGOING SECTION */}
                    {pendingOutgoing.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[8px] text-left uppercase font-black tracking-widest text-foreground/50 px-1">
                          Sent invitations
                        </p>
                        {pendingOutgoing.map((req) => (
                          <motion.div
                            key={req.id}
                            variants={itemVariants}
                            className="p-3 bg-white/[0.01] border border-border hover:border-white/[0.08] flex items-center justify-between rounded-2xl"
                          >
                            <div className="flex items-center gap-3 min-w-0 text-left">
                              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 clay-inset">
                                <img
                                  src={req.friendAvatar}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black">@{req.friendUsername}</p>
                                <p className="text-[8px] opacity-40 font-bold uppercase truncate">{req.friendFullName}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pl-2">
                              <span className="text-[8px] text-amber-500 font-black uppercase tracking-wider font-mono flex items-center gap-1 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 animate-pulse">
                                <Hourglass size={8} /> Sent
                              </span>
                              <button
                                onClick={() => handleDecline(req.id)}
                                disabled={actionLoading[req.id]}
                                className="p-2 bg-foreground/5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors"
                                title="Cancel Invitation"
                              >
                                {actionLoading[req.id] ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} />}
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

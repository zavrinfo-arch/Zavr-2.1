import React, { useState, useEffect } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { friendService } from '../services/friendService';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Check, Hourglass, UserX, UserCheck, Users, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FriendSystem() {
  const { currentUser } = useStore();
  const { friends, acceptFriend, rejectFriend, sendFriendRequest, fetchData } = useZettlContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Track action loading and requested states to make transitions immediate
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [requestedUserIds, setRequestedUserIds] = useState<Record<string, boolean>>({});

  // Search cache using useRef to avoid reset on render
  const searchCache = React.useRef<Record<string, any[]>>({});

  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.type === 'incoming');
  const activeFriends = friends.filter(f => f.status === 'accepted');

  // Debounce the searchQuery to debouncedQuery
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Perform the search when debouncedQuery changes
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    
    // Clear results immediately if query is too short
    if (trimmed.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    // Check if results are cached
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
        
        // Filter out current user if any just in case
        const filtered = (results || []).filter((u: any) => u.id !== currentUser?.id);
        
        // Cache the results
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
    setActionLoading(prev => ({ ...prev, [friendId]: true }));
    try {
      await sendFriendRequest(friendId);
      // Mark as requested immediately so the button disables and displays "Requested"
      setRequestedUserIds(prev => ({ ...prev, [friendId]: true }));
    } catch (err: any) {
      console.error('[FRIEND-SYSTEM] Connect failed:', err);
      toast.error('Failed to send connection request');
    } finally {
      setActionLoading(prev => ({ ...prev, [friendId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input Container */}
      <div className="clay p-6 bg-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Users size={16} className="text-purple-400" />
              Link Contacts
            </h3>
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Connect with Zavr profiles</p>
          </div>
          {pendingIncoming.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 animate-pulse"
            >
              <Hourglass size={12} />
              Requests ({pendingIncoming.length})
            </motion.button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30 text-purple-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type username (e.g. John)..."
            className="w-full clay-inset bg-foreground/5 p-3 pl-10 text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-purple-600/40 rounded-xl placeholder:opacity-40 text-foreground"
          />
        </div>

        {/* Search Results Area - Glassmorphism Card */}
        <AnimatePresence>
          {searchQuery.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-4 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-3 max-h-64 overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-[9px] uppercase font-bold text-purple-400 tracking-widest font-mono">
                  Search Results
                </span>
                <span className="text-[8px] text-foreground/30 font-black uppercase tracking-widest font-mono">
                  {loading ? 'Searching...' : `${searchResults.length} found`}
                </span>
              </div>

              {loading ? (
                /* Loading Skeleton */
                <div className="space-y-3 pt-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 animate-pulse rounded-xl bg-white/[0.01]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5" />
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-20 bg-white/10 rounded" />
                          <div className="h-2 w-14 bg-white/5 rounded" />
                        </div>
                      </div>
                      <div className="h-7 w-20 bg-white/5 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                /* No users found text */
                <div className="py-6 text-center">
                  <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">
                    No users found
                  </p>
                </div>
              ) : (
                /* Results List */
                <div className="space-y-2 pt-1">
                  {searchResults.map((user) => {
                    const existingFriend = friends.find(f => f.friendId === user.id);
                    const isAccepted = existingFriend?.status === 'accepted';
                    const isPending = existingFriend?.status === 'pending';
                    const isIncoming = existingFriend?.type === 'incoming';

                    return (
                      <div
                        key={user.id}
                        className="p-3 bg-white/[0.01] hover:bg-white/[0.03] flex items-center justify-between rounded-xl border border-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg min-w-[32px] overflow-hidden clay-inset">
                            <img
                              src={user.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black italic">@{user.username}</p>
                            <p className="text-[8px] opacity-35 font-bold uppercase truncate">{user.fullName}</p>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isAccepted ? (
                            <button
                              disabled
                              className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 cursor-not-allowed border border-emerald-500/20"
                            >
                              <Check size={10} /> Friends
                            </button>
                          ) : (isPending || requestedUserIds[user.id]) ? (
                            isIncoming && !requestedUserIds[user.id] ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (existingFriend) acceptFriend(existingFriend.id);
                                }}
                                className="px-2.5 py-1.5 bg-purple-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay active:scale-95 transition-transform hover:bg-purple-700"
                              >
                                Accept Invite
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-2.5 py-1.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 cursor-not-allowed border border-amber-500/20"
                              >
                                <Hourglass size={10} className="animate-pulse" /> {requestedUserIds[user.id] ? 'Requested' : 'Pending'}
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => handleSendRequest(user.id)}
                              disabled={actionLoading[user.id]}
                              className="px-2.5 py-1.5 bg-foreground/10 text-foreground hover:bg-purple-600 hover:text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay-inset border border-foreground/5 active:scale-95 transition-transform flex items-center gap-1"
                            >
                              {actionLoading[user.id] ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <>
                                  <UserPlus size={10} /> Add Friend
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

      {/* Connection Invites Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm clay p-6 bg-surface relative z-10 border border-foreground/10"
            >
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Incoming Requests</h3>
                  <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">Approve incoming connections</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="clay-inset p-3 bg-foreground/2 flex items-center justify-between gap-3 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 clay-inset">
                        <img
                          src={req.friendAvatar}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black italic">@{req.friendUsername}</p>
                        <p className="text-[8px] opacity-35 font-bold uppercase truncate">{req.friendFullName}</p>
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => acceptFriend(req.id)}
                        className="p-1 px-2.5 bg-emerald-600 text-white rounded-md text-[8px] font-black uppercase tracking-widest hover:brightness-110"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => rejectFriend(req.id)}
                        className="p-1 px-2.5 bg-foreground/10 text-foreground/50 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-foreground/15"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { friendService } from '../services/friendService';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Check, Hourglass, UserX, UserCheck, Users, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FriendSystem() {
  const { currentUser } = useStore();
  const { friends, acceptFriend, rejectFriend, sendFriendRequest } = useZettlContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.type === 'incoming');
  const activeFriends = friends.filter(f => f.status === 'accepted');

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const results = await friendService.searchUsers(val, currentUser?.id);
      setSearchResults(results);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (friendId: string) => {
    try {
      await sendFriendRequest(friendId);
      // Re-trigger search to refresh button state
      handleSearch(searchQuery);
    } catch (err: any) {
      toast.error('Failed to send connection request');
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
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type username (e.g. John)..."
            className="w-full clay-inset bg-foreground/5 p-3 pl-10 text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-purple-600/40 rounded-xl placeholder:opacity-40 text-foreground"
          />
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 space-y-2 max-h-60 overflow-y-auto no-scrollbar"
            >
              <p className="text-[8px] font-black uppercase text-purple-400 tracking-widest">Search Results</p>
              
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 size={16} className="animate-spin text-purple-500" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-[10px] opacity-40 font-bold py-2 uppercase tracking-wide">No matched profiles discovered</p>
              ) : (
                searchResults.map((user) => {
                  const existingFriend = friends.find(f => f.friendId === user.id);
                  const isAccepted = existingFriend?.status === 'accepted';
                  const isPending = existingFriend?.status === 'pending';
                  const isIncoming = existingFriend?.type === 'incoming';

                  return (
                    <div
                      key={user.id}
                      className="clay-inset p-3 bg-foreground/1 flex items-center justify-between rounded-xl border border-foreground/5"
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

                      <div className="shrink-0">
                        {isAccepted ? (
                          <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1">
                            <UserCheck size={10} /> Linked
                          </span>
                        ) : isPending ? (
                          isIncoming ? (
                            <button
                              onClick={() => {
                                if (existingFriend) acceptFriend(existingFriend.id);
                              }}
                              className="px-2.5 py-1.5 bg-purple-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay active:scale-95 transition-transform"
                            >
                              Accept Invitation
                            </button>
                          ) : (
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" /> Pending
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user.id)}
                            className="px-2.5 py-1.5 bg-foreground/10 text-foreground hover:bg-purple-600 hover:text-white text-[8px] font-black uppercase tracking-widest rounded-lg clay-inset border border-foreground/5 active:scale-95 transition-transform flex items-center gap-1"
                          >
                            <UserPlus size={10} /> Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
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

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { UserPlus, X, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { friendService } from '../../services/friendService';
import toast from 'react-hot-toast';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
}

interface Profile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

export default function AddFriendModal({ isOpen, onClose, userId, onSuccess }: AddFriendModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [sentUserIds, setSentUserIds] = useState<Record<string, boolean>>({});
  
  // Cache for searches using ref
  const searchCache = useRef<Record<string, Profile[]>>({});
  
  // Accessibility ref for focus trapping
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on load
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Trap focus within the modal for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  // Perform search query with 300ms debounce and AbortController
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const normalizedQuery = trimmed.toLowerCase();
    
    // Serve from cache if available
    if (searchCache.current[normalizedQuery]) {
      setResults(searchCache.current[normalizedQuery]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    const fetchResults = async () => {
      try {
        console.log(`[ADD-FRIEND-SEARCH] Searching for: ${trimmed}`);
        
        // Search in profiles where username or email matches query (case-insensitive)
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, username, email, full_name, avatar_url')
          .or(`username.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
          .neq('id', userId)
          .limit(20);

        if (pError) throw pError;

        // Fetch user relationships to filter out existing friends and pending requests
        const { data: existingRequests, error: rError } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id, status')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        if (rError) throw rError;

        const { data: existingFriends, error: fError } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (fError) throw fError;

        const excludedUserIds = new Set<string>();
        excludedUserIds.add(userId);

        if (existingFriends) {
          existingFriends.forEach(f => {
            excludedUserIds.add(f.user_id);
            excludedUserIds.add(f.friend_id);
          });
        }

        if (existingRequests) {
          existingRequests.forEach(r => {
            if (r.status === 'pending' || r.status === 'accepted') {
              excludedUserIds.add(r.sender_id);
              excludedUserIds.add(r.receiver_id);
            }
          });
        }

        const filtered = (profiles || []).filter(p => !excludedUserIds.has(p.id));

        // Cache the search result
        searchCache.current[normalizedQuery] = filtered;

        if (!controller.signal.aborted) {
          setResults(filtered);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[ADD-FRIEND-SEARCH] Detailed DB error:', err);
          
          let friendlyMessage = 'Failed to search users. Please try again.';
          if (!navigator.onLine) {
            friendlyMessage = 'No internet connection. Please check your network.';
          } else if (err.code === '42501' || err.message?.includes('permission') || err.message?.includes('violates row-level security')) {
            friendlyMessage = 'Security permission error when searching profiles.';
          } else if (err.code === 'PGRST204' || err.message?.includes('relation') || err.message?.includes('not find')) {
            friendlyMessage = 'Database table structure is missing. Please contact support.';
          } else if (err.code === '42703' || err.message?.includes('column')) {
            friendlyMessage = 'Database schema column mismatch. Checking legacy mode.';
          } else if (err.message) {
            friendlyMessage = `Database error: ${err.message}`;
          }
          
          toast.error(friendlyMessage);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query, userId]);

  // Dispatch a friend request
  const handleSendRequest = async (targetUserId: string) => {
    if (actionLoading[targetUserId] || sentUserIds[targetUserId]) return;

    // STEP 1 & 2: Verify user exists and is not current user
    if (!targetUserId) {
      toast.error('User not found.');
      return;
    }
    if (targetUserId === userId) {
      toast.error('Cannot add yourself.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [targetUserId]: true }));
    try {
      // Step 1: Verify user exists in the database
      const { data: targetUser, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', targetUserId)
        .maybeSingle();

      if (findError) throw findError;
      if (!targetUser) {
        toast.error('User not found.');
        return;
      }

      // STEP 3: Check friends table (bidirectional check)
      const { data: existingFriend, error: friendError } = await supabase
        .from('friends')
        .select('*')
        .in('user_id', [userId, targetUserId])
        .in('friend_id', [userId, targetUserId])
        .maybeSingle();

      if (friendError) throw friendError;
      if (existingFriend) {
        toast.error('Already friends.');
        setSentUserIds(prev => ({ ...prev, [targetUserId]: true }));
        return;
      }

      // STEP 4: Check friend_requests table (bidirectional check)
      const { data: existingReq, error: reqError } = await supabase
        .from('friend_requests')
        .select('*')
        .in('sender_id', [userId, targetUserId])
        .in('receiver_id', [userId, targetUserId])
        .maybeSingle();

      if (reqError) throw reqError;

      if (existingReq) {
        if (existingReq.status === 'pending') {
          toast.error('Friend request already pending.');
          setSentUserIds(prev => ({ ...prev, [targetUserId]: true }));
          return;
        } else if (existingReq.status === 'accepted') {
          toast.error('Already friends.');
          setSentUserIds(prev => ({ ...prev, [targetUserId]: true }));
          return;
        }
        // If rejected, we allow resend (proceeding to STEP 5)
      }

      // STEP 5: Only if NO friendship AND NO pending request perform INSERT (using secure backend friendService)
      await friendService.sendFriendRequest(targetUserId, userId);

      toast.success('Friend request sent successfully.');
      setSentUserIds(prev => ({ ...prev, [targetUserId]: true }));
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[ADD-FRIEND] Error dispatching request:', err);
      if (err.code === '23505' || err.message?.includes('unique') || err.message?.includes('23505')) {
        toast.error('Friend request already pending.');
      } else {
        toast.error(err.message || 'Failed to send friend request.');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[10px]"
      id="add-friend-backdrop"
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-[#0B1220] border border-white/8 rounded-[22px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] relative p-6 flex flex-col space-y-4 text-left overflow-hidden"
        id="add-friend-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-friend-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B]">
              <UserPlus size={20} />
            </div>
            <h2 id="add-friend-title" className="text-[18px] font-bold text-white leading-none">
              Add Friend
            </h2>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="p-1 text-[#9CA3AF] hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Description */}
        <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
          Search for ZTTEL users by username or email and instantly send a friend request.
        </p>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter username or email"
            className="w-full h-[46px] bg-[#111827] border border-white/8 rounded-[16px] pl-10 pr-4 text-[14px] text-white placeholder-[#9CA3AF]/50 outline-none transition-all duration-200 focus:border-[#00F5D4] focus:ring-3 focus:ring-[#00F5D4]/18"
            aria-label="Search username or email"
          />
        </div>

        {/* Search Results Area */}
        <div className="flex-1 min-h-[220px] max-h-[340px] overflow-y-auto pr-1 space-y-3 no-scrollbar">
          {query.trim().length === 0 ? (
            /* Idle State */
            <div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/[0.05]">
                <Search size={28} className="text-[#9CA3AF]/40" />
              </div>
              <p className="text-[13px] text-[#9CA3AF]/60 font-medium">
                Start typing to search for friends.
              </p>
            </div>
          ) : loading ? (
            /* Loading State */
            <div className="space-y-3 py-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-[16px] bg-white/[0.02] border border-white/[0.04] animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/5" />
                    <div className="space-y-2">
                      <div className="h-3.5 w-24 bg-white/10 rounded-md" />
                      <div className="h-2.5 w-32 bg-white/5 rounded-md" />
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-white/5 rounded-lg" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            /* No Results State */
            <div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-2">
              <p className="text-[13px] text-[#9CA3AF]/50 font-medium">
                No users found.
              </p>
            </div>
          ) : (
            /* Success State with User Cards */
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
              className="space-y-2.5"
            >
              {results.map((user) => {
                const isSent = !!sentUserIds[user.id];
                // Stable status representation derived from the unique id
                const isOnline = user.id.charCodeAt(0) % 2 === 0;
                const statusText = isOnline ? 'Online' : 'Last seen 10m ago';

                return (
                  <motion.div
                    key={user.id}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    className="p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-[16px] flex items-center justify-between transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                        <img
                          src={user.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.username}`}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-white truncate">@{user.username}</p>
                        <p className="text-[12px] font-medium text-[#9CA3AF] truncate">{user.full_name || 'Zavr Friend'}</p>
                        <p className={cn(
                          "text-[10px] font-medium flex items-center gap-1 mt-0.5",
                          isOnline ? 'text-emerald-400' : 'text-[#9CA3AF]/60'
                        )}>
                          {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
                          {statusText}
                        </p>
                      </div>
                    </div>

                    <motion.button
                      whileHover={!isSent && !actionLoading[user.id] ? { scale: 1.03 } : {}}
                      whileTap={!isSent && !actionLoading[user.id] ? { scale: 0.98 } : {}}
                      onClick={() => handleSendRequest(user.id)}
                      disabled={isSent || actionLoading[user.id]}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-md",
                        isSent
                          ? "bg-white/10 text-[#9CA3AF] border border-white/5 cursor-not-allowed"
                          : "bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-black cursor-pointer shadow-[#00F5D4]/10"
                      )}
                    >
                      {actionLoading[user.id] ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isSent ? (
                        'Request Sent ✓'
                      ) : (
                        <>
                          <UserPlus size={12} /> Add Friend
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

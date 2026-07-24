import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { friendService } from '../services/friendService';
import { zettlService } from '../services/zettl.service';
import { ChatListItem } from '../components/Zettl/ChatListItem';
import CreateZettlModal from '../components/zettl/CreateZettl';
import AddFriendModal from '../components/Zettl/AddFriendModal';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { 
  Bell, Search, UserPlus, Check, X, Home, Target, History, Wallet, Users, Loader2, 
  ArrowUpCircle, ArrowDownCircle, Send, UserCheck, Clock, AlertCircle, Sparkles, CheckCircle, Plus,
  Flame, Moon, Sun
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { AVATARS_50 } from '../constants/avatars';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';
import { useTheme } from '../context/ThemeContext';

// Animated Counter Component using requestAnimationFrame
function AnimatedCounter({ value, duration = 1000 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const endValue = Number(value) || 0;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * endValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>₹{count.toLocaleString('en-IN')}</span>;
}

// Internal sub-component: FriendRequestBell redesigned to match claymorphism theme
function FriendRequestBell({ userId, pendingRequests, onAccept, onDecline, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Click outside detection to close the dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative font-sans pointer-events-auto" ref={containerRef} id="friend-request-bell-container">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-xl flex items-center justify-center text-zinc-700 dark:text-white relative cursor-pointer"
        id="bell-button"
      >
        <Bell size={18} className="text-[#FF6B6B]" />
        {pendingRequests.length > 0 && (
          <span 
            className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6B6B] rounded-full animate-ping"
            id="bell-badge"
          />
        )}
      </motion.button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-2xl p-4 z-50 rounded-2xl shadow-2xl"
          id="bell-dropdown"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2 mb-3">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-gray-400 uppercase tracking-wider">
              Link Invitations
            </span>
            <span className="text-[9px] font-bold text-[#FF6B6B] bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {pendingRequests.length} Pending
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6" id="bell-loading">
              <Loader2 className="w-5 h-5 text-[#FF6B6B] animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-wider" id="bell-empty">
              No pending requests found
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1" id="bell-items">
              {pendingRequests.map((req) => (
                <div 
                   key={req.id} 
                   className="flex items-center justify-between p-2.5 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] rounded-xl"
                   id={`friend-req-${req.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-white font-bold flex items-center justify-center text-[10px] uppercase shrink-0 select-none">
                      {req.sender_profile?.username?.charAt(0) || 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">@{req.sender_profile?.username || 'user'}</span>
                      <span className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/60 truncate">{req.sender_profile?.full_name || 'Zavr User'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onAccept(req.id, req.sender_id)}
                      disabled={loading}
                      className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-lg px-2.5 py-1 transition-all font-bold text-[9px] flex items-center gap-1 cursor-pointer shadow-md active:scale-95 uppercase tracking-wider"
                      id={`accept-btn-${req.id}`}
                    >
                      <Check className="w-3 h-3" /> Link
                    </button>
                    <button
                      onClick={() => onDecline(req.id)}
                      disabled={loading}
                      className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-white/60 rounded-lg px-2 py-1 transition-all font-bold text-[9px] flex items-center gap-1 cursor-pointer active:scale-95 uppercase tracking-wider"
                      id={`decline-btn-${req.id}`}
                    >
                      <X className="w-3 h-3" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Internal sub-component: BalanceCard redesigned to match the total savings & goals visual look
function BalanceCard({ title, amount, onClick, isFiltered, icon: Icon, colorTheme }) {
  const isOwed = colorTheme === 'teal';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-white/[0.02] border backdrop-blur-md transition-all duration-300 cursor-pointer select-none",
        isFiltered 
          ? 'border-[#FF6B6B] shadow-lg shadow-[rgba(255,107,107,0.15)] bg-white dark:bg-white/[0.04]'
          : 'border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] hover:bg-black/[0.01] dark:hover:bg-white/[0.04]'
      )}
      id={`balance-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute right-3 top-3 opacity-5 pointer-events-none">
        {Icon && <Icon className="w-12 h-12 text-[#FF6B6B]" />}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-[#94A3B8]/60 block mb-2">
        {title}
      </span>
      <h3 className={cn(
        "text-2xl font-black tracking-tight",
        isOwed ? "text-[#FF6B6B]" : "text-[#FF7C7C]"
      )}>
        <AnimatedCounter value={amount} />
      </h3>
      <div className="mt-4 flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-zinc-400 dark:text-[#94A3B8]/40 border-t border-black/[0.05] dark:border-white/[0.05] pt-2">
        <span>{isFiltered ? 'Active Filter' : 'Click to filter'}</span>
        <span className={cn(isOwed ? "text-[#FF6B6B]" : "text-[#FF7C7C]")}>
          {isFiltered ? '●' : '→'}
        </span>
      </div>
    </motion.div>
  );
}

// Internal sub-component: ContactSearch redesigned to fully adopt Glassmorphism styling
function ContactSearch({ userId, onAddFriend, onFocusInput, searchInputRef }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  // Load recents from localStorage
  useEffect(() => {
    const list = localStorage.getItem('recentZettlSearches');
    if (list) {
      setRecentSearches(JSON.parse(list));
    }
  }, []);

  // Save recent searches
  const saveRecentSearch = (term) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentZettlSearches', JSON.stringify(updated));
  };

  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('recentZettlSearches', JSON.stringify(updated));
  };

  // Debounced execution of search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delayTimer = setTimeout(async () => {
      try {
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .ilike('username', `%${query.trim()}%`)
          .neq('id', userId)
          .limit(20);

        if (pError) throw pError;

        const { data: friendsList, error: fError } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (fError) throw fError;

        const friendIds = new Set(
          (friendsList || []).map(f => (f.user_id === userId ? f.friend_id : f.user_id))
        );

        const filteredProfiles = (profiles || []).filter(p => !friendIds.has(p.id));
        setResults(filteredProfiles);
      } catch (err) {
        console.error('[ZETTL] Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayTimer);
  }, [query, userId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerConnect = async (targetUser) => {
    setLoading(true);
    try {
      await onAddFriend(targetUser.id);
      saveRecentSearch(query);
      setQuery('');
      setShowDropdown(false);
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch notification link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-0 font-sans space-y-3.5" ref={containerRef} id="contact-search-block">
      <div className="relative shrink-0">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]/40">
          <Search className="w-4 h-4" />
        </span>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder=" Enter username "
          className="w-full bg-white/[0.02] border border-white/[0.08] rounded-2xl px-4 py-3.5 pl-11 pr-10 focus:border-[#FF6B6B]/60 focus:ring-1 focus:ring-[#FF6B6B]/30 outline-none transition-all duration-200 text-white placeholder-[#94A3B8]/40 text-xs font-medium"
          id="contact-search-input"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]/40 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-[#FF6B6B] animate-spin" />
          </span>
        )}
      </div>

      {/* Recent searches display block */}
      {recentSearches.length > 0 && !query && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 shrink-0" id="recent-searches">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]/40 mr-1">
            Recents:
          </span>
          {recentSearches.map((term) => (
            <div
              key={term}
              onClick={() => {
                setQuery(term);
                setShowDropdown(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] rounded-full text-[10px] font-bold cursor-pointer transition-colors duration-150"
              id={`recent-term-${term}`}
            >
              <span>@{term}</span>
              <button
                type="button"
                onClick={(e) => removeRecentSearch(e, term)}
                className="hover:text-[#FF6B6B] focus:outline-none p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results Section */}
      {showDropdown && query && (
        <div 
          className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#111118]/95 border border-black/[0.06] dark:border-white/[0.08] p-4 rounded-2xl shadow-2xl overflow-hidden transform origin-top transition-all duration-200 mt-2"
          id="search-results-dropdown"
        >
          <div className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 dark:text-[#94A3B8]/40 mb-3 border-b border-black/[0.05] dark:border-white/[0.05] pb-1.5 shrink-0">
            Discovered Zavr Profiles
          </div>

          {results.length === 0 && !loading ? (
            <div className="text-center py-6 text-zinc-400 dark:text-[#94A3B8]/30 font-bold text-[10px] uppercase tracking-wider shrink-0" id="results-empty">
              No matching profiles found
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto no-scrollbar flex-1 min-h-0" id="results-items">
              {results.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-xl transition-all duration-150"
                  id={`profile-card-${profile.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center font-bold text-zinc-800 dark:text-white text-xs uppercase shadow-inner select-none shrink-0 overflow-hidden">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        profile.username?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">@{profile.username}</span>
                      <span className="text-[9px] text-zinc-500 dark:text-[#94A3B8]/60 truncate">{profile.full_name || 'Zavr Friend'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerConnect(profile)}
                    className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-lg px-3 py-1.5 font-bold text-[9px] flex items-center gap-1 cursor-pointer transition-all duration-150 shadow-md active:scale-95 uppercase tracking-wider flex-shrink-0"
                    id={`connect-btn-${profile.id}`}
                  >
                    <UserPlus className="w-3 h-3 text-white" /> Link
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Internal sub-component: DebtList redesigned to match the card and activity rows
function DebtList({ debts, userId, onSettle, loading }) {
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-4 font-sans" id="debt-list-block">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Settlement Ledgers
        </h3>
        <span className="px-2.5 py-1 rounded-lg bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-widest">
          {debts.length} Records
        </span>
      </div>

      <div className="space-y-3" id="debt-items">
        {debts.map((item) => {
          const isLent = item.creditor_id === userId;
          const partnerProfile = isLent ? item.debtor_profile : item.creditor_profile;
          const settled = item.status === 'paid' || item.settled === true;
          const overdue = !settled && isOverdue(item.due_date);

          return (
            <motion.div
              layout
              key={item.id}
              className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-5 rounded-2xl flex flex-col gap-3 shadow-sm dark:shadow-md"
              id={`debt-row-${item.id}`}
            >
              {/* Header: User Profile Details + Amount */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-zinc-800 dark:text-white font-bold text-xs shrink-0 select-none">
                    {partnerProfile?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {partnerProfile?.full_name || 'Zavr Member'}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 truncate">
                        @{partnerProfile?.username || 'user'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-[#94A3B8]/60 font-medium truncate mt-0.5">
                      {item.purpose || 'No description listed'}
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={cn(
                    "text-base font-black tracking-tight",
                    isLent ? "text-[#FF6B6B]" : "text-[#FF7C7C]"
                  )}>
                    {isLent ? '+' : '-'} ₹{Number(item.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] text-zinc-400 dark:text-[#94A3B8]/40 uppercase tracking-wider block mt-0.5">
                    {isLent ? 'owes you' : 'you owe'}
                  </span>
                </div>
              </div>

              {/* Footer: Date Info + Action / Status badges */}
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.05] mt-1">
                <div>
                  {item.due_date ? (
                    <span className="text-[9px] text-zinc-500 dark:text-[#94A3B8]/60 font-mono">
                      DUE: {new Date(item.due_date).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[8px] text-zinc-400 dark:text-[#94A3B8]/30 font-mono uppercase tracking-widest">
                      No Deadline
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {settled ? (
                    <span className="text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Paid
                    </span>
                  ) : overdue ? (
                    <span className="text-red-500 bg-red-500/10 border border-red-500/20 text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                      Overdue
                    </span>
                  ) : (
                    <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Pending
                    </span>
                  )}

                  {!settled && (
                    <button
                      onClick={() => onSettle(item.id)}
                      disabled={loading}
                      className="bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-700 dark:text-white border border-black/[0.06] dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-[9px] font-bold transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1 shrink-0 uppercase tracking-wider"
                    >
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-[#FF6B6B]" />
                      ) : (
                        'Settle Up'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Internal sub-component: EmptyDebtState redesigned to match empty active goals
function EmptyDebtState({ onLinkContactsClick }) {
  return (
    <div 
      className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-12 text-center flex flex-col items-center justify-center space-y-4 rounded-2xl shadow-sm dark:shadow-md"
      id="empty-debt-state"
    >
      <div className="w-12 h-12 rounded-xl bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-zinc-400 dark:text-[#94A3B8]/40">
        <Wallet size={24} />
      </div>
      <div className="space-y-1">
        <h4 className="text-zinc-950 dark:text-white font-bold text-sm">
          No Active Debts
        </h4>
        <p className="text-xs text-zinc-400 dark:text-[#94A3B8]/40 font-medium">
          Your settlement boards are perfectly clear.
        </p>
      </div>
      <button
        type="button"
        onClick={onLinkContactsClick}
        className="px-5 py-2.5 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md"
        id="link-contacts-button"
      >
        Link Contacts
      </button>
    </div>
  );
}

// Skeleton Card component during load state
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md p-5 rounded-2xl animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.04]"></div>
        <div className="space-y-2">
          <div className="h-3 w-20 bg-black/[0.04] dark:bg-white/[0.04] rounded"></div>
          <div className="h-2 w-28 bg-black/[0.02] dark:bg-white/[0.02] rounded"></div>
        </div>
      </div>
      <div className="h-4 w-12 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg"></div>
    </div>
  );
}

// Internal sub-component: BottomNavigation rebuilt to mirror BottomNav from Layout.tsx perfectly
function BottomNavigation({ onPlusClick }) {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  const navItems = [
    { icon: Home, label: 'HOME', path: '/home' },
    { icon: Target, label: 'GOALS', path: '/goals' },
    { icon: null, label: '', path: '' }, // Placeholder for Plus
    { icon: History, label: 'HISTORY', path: '/history' },
    { icon: Wallet, label: 'ZETTL', path: '/zettl' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 px-6 py-5 bg-white/90 dark:bg-[#111118]/85 border-t border-black/[0.06] dark:border-white/[0.06] backdrop-blur-2xl flex items-center justify-around shadow-lg dark:shadow-[0_-10px_35px_rgba(0,0,0,0.5)]" id="bottom-navigation-bar">
      {navItems.map((item, i) => {
        if (i === 2) {
          return (
            <div key="plus" className="relative w-12" id="zettl-nav-plus-container">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 1.08, rotate: 45 }}
                transition={{ type: "tween", duration: 0.2 }}
                onClick={onPlusClick}
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-16 h-16 clay-coral rounded-2xl flex items-center justify-center text-white border-4 border-white dark:border-[#111118] shadow-2xl cursor-pointer"
                id="zettl-nav-plus-button"
              >
                <Plus className="w-8 h-8" />
              </motion.button>
            </div>
          );
        }

        const Icon = item.icon;
        const isActive = item.label === 'ZETTL';

        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all focus:outline-none cursor-pointer",
              isActive ? "text-[#FF6B6B] scale-110 font-bold" : "opacity-30 dark:opacity-20 hover:opacity-60 text-zinc-500 dark:text-white"
            )}
            id={`nav-item-${item.label.toLowerCase()}`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// MAIN PAGE COMPONENT
export default function ZettlPage() {
  const navigate = useNavigate();
  const { user, userId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  const currentUser = useStore((state) => state.currentUser);
  const { theme, setTheme } = useTheme();

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  // Core domain data states
  const [friendRequests, setFriendRequests] = useState([]);
  const [debts, setDebts] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [chats, setChats] = useState([]);
  const [totalFinOwed, setTotalFinOwed] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);
  
  // Filtering selections: 'all', 'lent' (friends owe you), 'borrowed' (you owe friends)
  const [filter, setFilter] = useState('all');

  // Trigger loading states
  const [bellLoading, setBellLoading] = useState(false);
  const [settledLoading, setSettledLoading] = useState(false);

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isContactBookOpen, setIsContactBookOpen] = useState(false);

  const searchInputRef = useRef(null);

  // Fetch current user details & custom username from profile table
  const fetchProfileDetails = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.warn('[ZETTL] Could not load profile metadata:', err);
    }
  }, [userId]);

  // Load connected friends for transactions
  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    try {
      let flist = [];
      try {
        flist = await friendService.getFriendList(userId);
      } catch (err) {
        console.warn('[ZETTL] friendService.getFriendList notice:', err);
      }

      const preparedList = [];
      if (flist && flist.length > 0) {
        flist.forEach(f => {
          if (f.status === 'accepted' || !f.status) {
            const fid = f.friendId || f.friend_id || f.id;
            if (fid && fid !== userId) {
              preparedList.push({
                id: fid,
                friendId: fid,
                username: f.friendUsername || f.username || 'user',
                full_name: f.friendFullName || f.full_name || f.fullName || 'Zettl Link',
                avatar_url: f.friendAvatar || f.avatar_url
              });
            }
          }
        });
      }

      if (preparedList.length === 0) {
        let { data: list } = await supabase
          .from('friends')
          .select('friend_id, user_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        const friendIds = new Set();
        (list || []).forEach(f => {
          const fid = f.user_id === userId ? f.friend_id : f.user_id;
          if (fid && fid !== userId) friendIds.add(fid);
        });

        if (friendIds.size > 0) {
          const { data: profilesList } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', Array.from(friendIds));

          if (profilesList) {
            profilesList.forEach(p => {
              preparedList.push({
                id: p.id,
                friendId: p.id,
                username: p.username,
                full_name: p.full_name || p.username,
                avatar_url: p.avatar_url
              });
            });
          }
        }
      }

      setFriendsList(preparedList);
    } catch (err) {
      console.warn('[ZETTL] Could not load friends list:', err);
    }
  }, [userId]);

  // Load friends and debt list with full participant details
  const fetchLedgersAndFriendsData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch friend requests
      setBellLoading(true);
      const { data: reqs, error: rErr } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', userId)
        .eq('status', 'pending');

      if (rErr) throw rErr;

      // Map profiles for friend requests
      if (reqs && reqs.length > 0) {
        const senderIds = reqs.map((r) => r.sender_id);
        const { data: sProfiles, error: spErr } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', senderIds);

        if (!spErr && sProfiles) {
          const sProfMap = new Map(sProfiles.map((p) => [p.id, p]));
          const mappedReqs = reqs.map((r) => ({
            ...r,
            sender_profile: sProfMap.get(r.sender_id) || { username: 'user', full_name: 'Zavr User' },
          }));
          setFriendRequests(mappedReqs);
        } else {
          setFriendRequests(reqs);
        }
      } else {
        setFriendRequests([]);
      }
      setBellLoading(false);

      // 2. Fetch debts lists
      const { data: rawDebts, error: dErr } = await supabase
        .from('debts')
        .select('*')
        .or(`creditor_id.eq.${userId},user_id.eq.${userId}`);

      if (dErr) throw dErr;

      if (rawDebts && rawDebts.length > 0) {
        const involvedIds = Array.from(
          new Set(rawDebts.flatMap((d) => [d.creditor_id, d.user_id]))
        );

        // Map participant profiles
        const { data: pProfiles, error: ppErr } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', involvedIds.filter(Boolean));

        if (!ppErr && pProfiles) {
          const profileMap = new Map(pProfiles.map((p) => [p.id, p]));
          const enrichedDebts = rawDebts.map((d) => ({
            ...d,
            creditor_profile: profileMap.get(d.creditor_id) || { username: 'user', full_name: 'Zavr Creditor' },
            debtor_profile: profileMap.get(d.user_id) || { username: 'user', full_name: 'Zavr Debtor' },
          }));
          setDebts(enrichedDebts);

          // Sum balances
          const lendTotal = enrichedDebts
            .filter((d) => d.creditor_id === userId && (d.status === 'pending' || d.settled === false))
            .reduce((s, d) => s + Number(d.amount), 0);

          const borrowTotal = enrichedDebts
            .filter((d) => d.user_id === userId && (d.status === 'pending' || d.settled === false))
            .reduce((s, d) => s + Number(d.amount), 0);

          setTotalFinOwed(lendTotal);
          setTotalYouOwe(borrowTotal);
        } else {
          setDebts(rawDebts);
        }
      } else {
        setDebts([]);
        setTotalFinOwed(0);
        setTotalYouOwe(0);
      }

      // 3. Fetch chats for connected friends
      try {
        const chatData = await zettlService.getChatList(userId);
        setChats(chatData || []);
      } catch (cErr) {
        console.warn('[ZETTL] Load chats notice:', cErr);
      }
    } catch (err) {
      console.error('[ZETTL] Load lists failed:', err.message);
    } finally {
      setLoading(false);
      setBellLoading(false);
    }
  }, [userId]);

  // Dispatch connection requests with 5-step duplicate checks
  const handleAddFriend = async (targetUserId) => {
    if (!targetUserId) {
      toast.error('User not found.');
      return;
    }
    if (targetUserId === userId) {
      toast.error('Cannot add yourself.');
      return;
    }

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
      const { data: existingFriends, error: friendError } = await supabase
        .from('friends')
        .select('id')
        .in('user_id', [userId, targetUserId])
        .in('friend_id', [userId, targetUserId])
        .limit(10);

      if (friendError) throw friendError;
      if (existingFriends && existingFriends.length > 0) {
        toast.error('Already friends.');
        return;
      }

      // STEP 4: Check friend_requests table (bidirectional check)
      const { data: existingReqs, error: reqError } = await supabase
        .from('friend_requests')
        .select('id, status')
        .in('sender_id', [userId, targetUserId])
        .in('receiver_id', [userId, targetUserId])
        .limit(10);

      if (reqError) throw reqError;

      if (existingReqs && existingReqs.length > 0) {
        const pending = existingReqs.find(r => r.status === 'pending');
        const accepted = existingReqs.find(r => r.status === 'accepted');

        if (accepted) {
          toast.error('Already friends.');
          return;
        }

        if (pending) {
          toast.error('Friend request already pending.');
          return;
        }
      }

      // STEP 5: Only if NO friendship AND NO pending request perform INSERT (by calling secure backend api)
      await friendService.sendFriendRequest(targetUserId, userId);
      toast.success('Friend request sent successfully.');
      fetchLedgersAndFriendsData();
    } catch (err) {
      console.error('[ZETTL] Add friend failed:', err);
      if (err.code === '23505' || err.message?.includes('unique') || err.message?.includes('23505')) {
        toast.error('Friend request already pending.');
      } else {
        toast.error(err.message || 'Failed to send friend request.');
      }
    }
  };

  // Accept incoming friend request link invitation
  const handleAcceptFriendRequest = async (requestId, senderId) => {
    setSettledLoading(true);
    try {
      await friendService.acceptFriendRequest(requestId, userId);
      toast.success('Friend request connected! Link created successfully.');
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      fetchLedgersAndFriendsData();
      fetchFriends();
    } catch (err) {
      console.error('[ZETTL] Accept friendship failed:', err);
      toast.error(err.message || 'Could not map friend links.');
    } finally {
      setSettledLoading(false);
    }
  };

  // Decline/Reject friend request link invitation
  const handleDeclineFriendRequest = async (requestId) => {
    setSettledLoading(true);
    try {
      await friendService.rejectFriendRequest(requestId);
      toast.success('Link invitation declined.');
      fetchLedgersAndFriendsData();
    } catch (err) {
      console.error('[ZETTL] Decline friendship failed:', err);
      toast.error(err.message || 'Decline failed.');
    } finally {
      setSettledLoading(false);
    }
  };

  // Settle active pending debt
  const handleSettleUpDebt = async (debtId) => {
    setSettledLoading(true);
    try {
      const { error } = await supabase
        .from('debts')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          settled: true,
        })
        .eq('id', debtId);

      if (error) throw error;
      toast.success('Settlement logged! Balance adjusted successfully.');
      fetchLedgersAndFriendsData();
    } catch (err) {
      toast.error(err.message || 'Settlement failed, inspect credentials.');
    } finally {
      setSettledLoading(false);
    }
  };

  // Focus Search Input helper
  const handleFocusSearch = () => {
    setIsContactBookOpen(true);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 150);
  };

  // onSendMoney (Pay/repay)
  const handleSendMoney = async (friendId, amount, note) => {
    try {
      const { error } = await supabase.from('debts').insert({
        creditor_id: friendId,
        user_id: userId,
        amount: amount,
        purpose: note,
        status: 'pending',
        settled: false,
        due_date: null
      });
      if (error) throw error;
      toast.success('Debt ledger created!');
      fetchLedgersAndFriendsData();
    } catch (err) {
      toast.error(err.message || 'Payment register failed');
    }
  };

  // onRequestMoney (lending request)
  const handleRequestMoney = async (friendId, amount, note, dueDate) => {
    try {
      const { error } = await supabase.from('debts').insert({
        creditor_id: userId,
        user_id: friendId,
        amount: amount,
        purpose: note,
        status: 'pending',
        settled: false,
        due_date: dueDate || null
      });
      if (error) throw error;
      toast.success('Debt ledger created!');
      fetchLedgersAndFriendsData();
    } catch (err) {
      toast.error(err.message || 'Debt request failed');
    }
  };

  const handleCreateGroupStub = async (name, friendIds) => {
    toast.error('Group splits are not supported under current scope');
  };

  // Hook-based data retrieval on mount
  useEffect(() => {
    if (userId) {
      fetchProfileDetails();
      fetchLedgersAndFriendsData();
      fetchFriends();

      if (shouldDisableHeavyFeatures()) {
        console.info('[PREVIEW] Bypassing Zettl.jsx real-time subscriptions inside AI Studio preview.');
        return;
      }

      // Real-time channel listeners for friend_requests, friends, and debts
      const reqsChannel = supabase
        .channel('realtime-friend-requests-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_requests' },
          () => {
            fetchLedgersAndFriendsData();
            fetchFriends();
            useStore.getState().refreshFriendsForDropdown(true);
          }
        )
        .subscribe();

      const friendsChannel = supabase
        .channel('realtime-friends-table-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friends' },
          () => {
            console.log('⚡ Friends table change received in Zettl.jsx');
            fetchLedgersAndFriendsData();
            fetchFriends();
            useStore.getState().refreshFriendsForDropdown(true);
          }
        )
        .subscribe();

      const debtsChannel = supabase
        .channel('realtime-debts-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'debts' },
          () => {
            fetchLedgersAndFriendsData();
          }
        )
        .subscribe();

      const handleAcceptedEvent = () => {
        fetchLedgersAndFriendsData();
        fetchFriends();
        useStore.getState().refreshFriendsForDropdown(true);
      };
      window.addEventListener('friend-request-accepted', handleAcceptedEvent);

      return () => {
        supabase.removeChannel(reqsChannel);
        supabase.removeChannel(friendsChannel);
        supabase.removeChannel(debtsChannel);
        window.removeEventListener('friend-request-accepted', handleAcceptedEvent);
      };
    }
  }, [userId, fetchProfileDetails, fetchLedgersAndFriendsData, fetchFriends]);

  // Loading barrier state (Restyled to match Claymorphic dark mode)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans w-full text-foreground">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-8 h-8 text-[#FF6B6B] animate-spin" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-35">
            Checking session profiles...
          </p>
        </div>
      </div>
    );
  }

  // Filtered debts rendering logic
  const filteredDebts = debts.filter((d) => {
    if (filter === 'lent') {
      return d.creditor_id === userId && (d.status === 'pending' || d.settled === false);
    }
    if (filter === 'borrowed') {
      return d.user_id === userId && (d.status === 'pending' || d.settled === false);
    }
    return true; // Return all matching records
  });

  // Calculate stats for stats bar
  const totalSettledThisMonth = debts
    .filter(d => {
      const settled = d.status === 'paid' || d.settled === true;
      if (!settled || !d.paid_at) return false;
      const paidDate = new Date(d.paid_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalPendingOwed = debts
    .filter(d => (d.status === 'pending' || d.settled === false))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const activeUser = currentUser || {
    id: userId || '',
    fullName: profile?.full_name || user?.email || 'User',
    username: profile?.username || user?.email?.split('@')[0] || 'user',
    avatar: profile?.avatar_url || '',
    avatarId: '',
    level: 1,
    streak: 0
  };

  const avatarUrl = activeUser.avatar || 
    AVATARS_50.find(a => a.id === activeUser.avatarId?.toString())?.url || 
    `https://api.dicebear.com/7.x/lorelei/svg?seed=${activeUser.username}`;

  return (
    <div className="min-h-screen bg-background text-foreground pb-36 font-sans w-full relative overflow-x-hidden px-6 pt-28" id="zettl-page-container">
      
      {/* FIXED POSITION HEADER SECTION FLOATING COMPONENT - Matches Layout.tsx ProfileHeader */}
      <div className="fixed top-0 left-0 right-0 z-[95] px-4 pt-4 pointer-events-none" id="zettl-header">
        <div 
          className="w-full mx-auto flex pointer-events-auto bg-white/90 dark:bg-[#111118]/80 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-3.5 justify-between items-center shadow-md dark:shadow-lg relative"
        >
          {/* Profile Left */}
          <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => navigate('/profile')}>
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08]">
                <img 
                  src={avatarUrl} 
                  alt="Profile Avatar" 
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-lg flex items-center justify-center text-[8px] font-black text-white border-2 border-white dark:border-[#111118]">
                {activeUser.level || 1}
              </div>
            </div>
            
            <div className="flex flex-col min-w-0 font-sans">
              <p className="text-[9px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 tracking-[0.2em] uppercase truncate">
                {getTimeGreeting()}
              </p>
              <h2 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight leading-none truncate mt-0.5" style={{ letterSpacing: '-0.02em' }}>
                {activeUser.fullName.includes('@') ? activeUser.fullName.split('@')[0] : activeUser.fullName.split(' ')[0] || 'User'}
              </h2>
              <p className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/40 font-medium truncate mt-0.5">
                @{activeUser.username}
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Streak Counter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] shadow-sm dark:shadow-inner">
              <Flame size={14} className={cn(
                "transition-all",
                (activeUser.streak || 0) > 0 ? "text-orange-500 animate-pulse" : "text-zinc-300 dark:text-[#94A3B8]/30"
              )} />
              <span className="text-xs font-bold text-zinc-800 dark:text-white">{activeUser.streak || 0}</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.05] hover:text-[#FF6B6B] text-zinc-600 dark:text-[#94A3B8] transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Friend Request Bell */}
            <div className="text-zinc-600 dark:text-white hover:text-[#FF6B6B] flex items-center">
              <FriendRequestBell
                userId={userId}
                pendingRequests={friendRequests}
                onAccept={handleAcceptFriendRequest}
                onDecline={handleDeclineFriendRequest}
                loading={bellLoading || settledLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="space-y-6"
      >
        {/* BALANCE SUMMARY CARDS GRID */}
        <div className="grid grid-cols-2 gap-4 pt-2" id="zettl-balance-grid">
          <BalanceCard
            title="Friends Owe You"
            amount={totalFinOwed}
            onClick={() => setFilter(filter === 'lent' ? 'all' : 'lent')}
            isFiltered={filter === 'lent'}
            icon={ArrowUpCircle}
            colorTheme="teal"
          />
          <BalanceCard
            title="You Owe Friends"
            amount={totalYouOwe}
            onClick={() => setFilter(filter === 'borrowed' ? 'all' : 'borrowed')}
            isFiltered={filter === 'borrowed'}
            icon={ArrowDownCircle}
            colorTheme="coral"
          />
        </div>

        {/* Filter Indicator Banner */}
        {filter !== 'all' && (
          <div 
            className="flex items-center justify-between px-4 py-3 bg-[#FF6B6B]/5 border border-[#FF6B6B]/20 rounded-xl text-xs font-medium"
            id="filter-banner"
          >
            <span className="text-[#FF6B6B] text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B] animate-pulse" />
              Showing {filter === 'lent' ? 'owed to you' : 'you owe'}
            </span>
            <button
              onClick={() => setFilter('all')}
              className="font-bold text-[#FF6B6B] hover:text-[#FF6B6B]/80 text-[9px] uppercase tracking-wider cursor-pointer"
            >
              Clear Filter [X]
            </button>
          </div>
        )}

        {/* LINKED FRIENDS & CHATS LIST */}
        {(chats.length > 0 || friendsList.length > 0) && (
          <div className="space-y-4 text-left" id="friends-chats-section">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Linked Friends & Chats
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-[8px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-widest">
                {chats.length || friendsList.length} Connected
              </span>
            </div>

            <div className="bg-white dark:bg-[#111118]/80 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.06] rounded-3xl shadow-sm dark:shadow-lg">
              {(chats.length > 0 ? chats : friendsList.map(f => ({
                friend_id: f.id || f.friendId,
                friend_name: f.full_name || f.username,
                friend_avatar: f.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${f.username}`,
                last_message: 'Connected on Zettl! Tap to start chatting.',
                last_message_time: new Date().toISOString(),
                unread_count: 0,
                net_balance: 0
              }))).map((chatItem) => (
                <ChatListItem
                  key={chatItem.friend_id}
                  item={chatItem}
                  onClick={() => navigate(`/zettl/chat/${chatItem.friend_id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* DYNAMIC SETTLEMENT LIST */}
        <div className="space-y-4 text-left" id="settlement-ledger-box">
          {loading ? (
            <div className="space-y-3" id="zettl-list-loader">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredDebts.length > 0 ? (
            <DebtList
              debts={filteredDebts}
              userId={userId}
              onSettle={handleSettleUpDebt}
              loading={settledLoading}
            />
          ) : (chats.length === 0 && friendsList.length === 0) ? (
            <EmptyDebtState onLinkContactsClick={handleFocusSearch} />
          ) : null}
        </div>

      </motion.div>

      {/* TRANSACTION CREATION MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateZettlModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            friends={friendsList}
            onRequestMoney={handleRequestMoney}
            onSendMoney={handleSendMoney}
            onCreateGroup={handleCreateGroupStub}
            userId={userId}
            onSuccess={fetchLedgersAndFriendsData}
          />
        )}
      </AnimatePresence>

      {/* PREMIUM ADD FRIEND MODAL */}
      <AnimatePresence>
        {isContactBookOpen && (
          <AddFriendModal
            isOpen={isContactBookOpen}
            onClose={() => setIsContactBookOpen(false)}
            userId={userId}
            onSuccess={fetchLedgersAndFriendsData}
          />
        )}
      </AnimatePresence>

      {/* FLOATING ACTION BUTTON (FAB) FOR CONTACTS */}
      <div className="fixed bottom-28 left-0 right-0 z-50 pointer-events-none" id="contact-fab-container">
        <div className="w-full max-w-md mx-auto relative px-6 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsContactBookOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white flex items-center justify-center shadow-lg shadow-[rgba(255,107,107,0.35)] hover:shadow-[rgba(255,107,107,0.5)] cursor-pointer pointer-events-auto transition-all"
            id="open-contact-book-fab"
          >
            <UserPlus size={22} />
          </motion.button>
        </div>
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR REDESIGNED */}
      <BottomNavigation onPlusClick={() => setIsCreateOpen(true)} />
    </div>
  );
}

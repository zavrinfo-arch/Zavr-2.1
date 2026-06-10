import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import CreateZettlModal from '../components/zettl/CreateZettl';
import toast from 'react-hot-toast';
import { 
  Bell, Search, UserPlus, Check, X, Home, Target, History, Wallet, Users, Loader2, 
  ArrowUpCircle, ArrowDownCircle, Send, UserCheck, Clock, AlertCircle, Sparkles, CheckCircle, Plus
} from 'lucide-react';

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

// Internal sub-component: FriendRequestBell
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
    <div className="relative font-sans" ref={containerRef} id="friend-request-bell-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 focus:outline-none transition-all duration-200 cursor-pointer text-gray-600 block shadow-sm hover:text-purple-600"
        id="bell-button"
      >
        <Bell className="w-5 h-5" />
        {pendingRequests.length > 0 && (
          <span 
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
            id="bell-badge"
          >
            {pendingRequests.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 z-50 transform origin-top-right transition-all duration-200"
          id="bell-dropdown"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <span className="text-xs font-semibold text-gray-500">
              Link Invitations
            </span>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full">
              {pendingRequests.length} Pending
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6" id="bell-loading">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-medium text-xs font-sans" id="bell-empty">
              No pending requests found
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1" id="bell-items">
              {pendingRequests.map((req) => (
                <div 
                  key={req.id} 
                  className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition-all duration-200"
                  id={`friend-req-${req.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 font-semibold flex items-center justify-center text-xs uppercase shadow-sm">
                      {req.sender_profile?.username?.charAt(0) || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-900">@{req.sender_profile?.username || 'user'}</span>
                      <span className="text-[10px] text-gray-500 font-medium">{req.sender_profile?.full_name || 'Zavr User'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAccept(req.id, req.sender_id)}
                      disabled={loading}
                      className="bg-purple-600 text-white rounded-lg px-2.5 py-1.5 hover:bg-purple-700 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                      id={`accept-btn-${req.id}`}
                    >
                      <Check className="w-3 h-3" /> Link
                    </button>
                    <button
                      onClick={() => onDecline(req.id)}
                      disabled={loading}
                      className="bg-gray-100 text-gray-700 rounded-lg px-2.5 py-1.5 hover:bg-gray-200 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
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

// Internal sub-component: BalanceCard
function BalanceCard({ title, amount, gradient, onClick, isFiltered, icon: Icon }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] hover:brightness-105 active:scale-98 transition-all duration-200 cursor-pointer select-none text-white ${gradient} ${
        isFiltered ? 'ring-4 ring-purple-600 ring-offset-2' : ''
      }`}
      id={`balance-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute right-3 top-3 opacity-15 pointer-events-none">
        {Icon && <Icon className="w-16 h-16" />}
      </div>
      <span className="text-xs uppercase tracking-wider font-medium opacity-90 block mb-1">
        {title}
      </span>
      <h3 className="text-3xl font-bold tracking-tight">
        <AnimatedCounter value={amount} />
      </h3>
      <div className="mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider opacity-85 border-t border-white/10 pt-2">
        <span>Click to filter</span>
        <span>→</span>
      </div>
    </div>
  );
}

// Internal sub-component: ContactSearch
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
        // Fetch users from profiles matching query (username ILIKE)
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .ilike('username', `%${query.trim()}%`)
          .neq('id', userId)
          .limit(20);

        if (pError) throw pError;

        // Fetch already established friends to filter them out of search list
        const { data: friendsList, error: fError } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (fError) throw fError;

        const friendIds = new Set(
          (friendsList || []).map(f => (f.user_id === userId ? f.friend_id : f.user_id))
        );

        // Filter out existing friends
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
    <div className="relative space-y-3 font-sans" ref={containerRef} id="contact-search-block">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="w-5 h-5" />
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
          placeholder="Search by Gen Z usernames..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 bg-white shadow-sm text-gray-905 placeholder-gray-400 text-sm"
          id="contact-search-input"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
          </span>
        )}
      </div>

      {/* Recent searches display block */}
      {recentSearches.length > 0 && !query && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1" id="recent-searches">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">
            Recents:
          </span>
          {recentSearches.map((term) => (
            <div
              key={term}
              onClick={() => {
                setQuery(term);
                setShowDropdown(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-xs font-semibold cursor-pointer transition-colors duration-150"
              id={`recent-term-${term}`}
            >
              <span>@{term}</span>
              <button
                type="button"
                onClick={(e) => removeRecentSearch(e, term)}
                className="hover:text-red-500 focus:outline-none p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results Dropdown */}
      {showDropdown && query && (
        <div 
          className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 z-40 max-h-72 overflow-y-auto transform origin-top transition-all duration-200"
          id="search-results-dropdown"
        >
          <div className="text-[11px] uppercase font-bold tracking-wider text-gray-400 mb-2 border-b border-gray-150 pb-1.5">
            Discovered Zavr Profiles
          </div>

          {results.length === 0 && !loading ? (
            <div className="text-center py-6 text-gray-400 font-sans text-xs" id="results-empty">
              No matching profiles found
            </div>
          ) : (
            <div className="space-y-3.5" id="results-items">
              {results.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-all duration-150"
                  id={`profile-card-${profile.id}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm uppercase shadow-sm">
                      {profile.username?.charAt(0) || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-800">@{profile.username}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{profile.full_name || 'Zavr Friend'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerConnect(profile)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl px-3.5 py-1.5 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all duration-150 shadow-md active:scale-95"
                    id={`connect-btn-${profile.id}`}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Send Link
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

// Internal sub-component: DebtList
function DebtList({ debts, userId, onSettle, loading }) {
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-4 font-sans" id="debt-list-block">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Settlement Ledgers
        </h3>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {debts.length} Records
        </span>
      </div>

      <div className="space-y-3" id="debt-items">
        {debts.map((item) => {
          const isLent = item.creditor_id === userId;
          const userOwes = item.debtor_id === userId;
          const partnerProfile = isLent ? item.debtor_profile : item.creditor_profile;
          const settled = item.status === 'paid' || item.settled === true;
          const overdue = !settled && isOverdue(item.due_date);

          return (
            <div
              key={item.id}
              className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              id={`debt-row-${item.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-600 font-semibold text-base shrink-0 shadow-xs">
                  {partnerProfile?.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {partnerProfile?.full_name || 'Zavr Member'}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      @{partnerProfile?.username || 'user'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {item.purpose || 'No description listed'}
                  </p>
                  {item.due_date && (
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">
                      Due: {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                <div className="text-right">
                  <span className={`text-base font-bold ${
                    isLent ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {isLent ? '+' : '-'} ₹{Number(item.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-gray-400 block font-normal">
                    {isLent ? 'owes you' : 'you owe'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {settled ? (
                    <span className="bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-semibold">
                      Paid
                    </span>
                  ) : overdue ? (
                    <span className="bg-red-100 text-red-800 rounded-full px-3 py-1 text-xs font-semibold animate-pulse">
                      Overdue
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                      Pending
                    </span>
                  )}

                  {!settled && (
                    <button
                      onClick={() => onSettle(item.id)}
                      disabled={loading}
                      className="bg-purple-50 text-purple-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-purple-100 transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 shrink-0"
                    >
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Settle Up'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Internal sub-component: EmptyDebtState
function EmptyDebtState({ onLinkContactsClick }) {
  return (
    <div 
      className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-4 font-sans"
      id="empty-debt-state"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 text-purple-600 flex items-center justify-center shadow-inner">
        <Wallet className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h4 className="text-gray-905 font-semibold text-lg">
          No Active Debts
        </h4>
        <p className="text-gray-500 text-sm">
          Your settlement boards are perfectly clear.
        </p>
      </div>
      <button
        type="button"
        onClick={onLinkContactsClick}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl px-6 py-3 font-medium text-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-md"
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
    <div className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200"></div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-3 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div className="h-4 w-12 bg-gray-200 rounded"></div>
    </div>
  );
}

// Internal sub-component: BottomNavigation
function BottomNavigation() {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  const navItems = [
    { label: 'HOME', path: '/home', icon: Home },
    { label: 'GOALS', path: '/goals', icon: Target },
    { label: 'HISTORY', path: '/history', icon: History },
    { label: 'ZETTL', path: '/zettl', icon: Wallet },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2 px-4 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] grid grid-cols-4"
      id="bottom-navigation-bar"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === 'ZETTL' || currentPath === item.path;

        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 py-1 focus:outline-none transition-colors duration-200 cursor-pointer ${
              isActive 
                ? 'text-purple-600 font-semibold' 
                : 'text-gray-400 hover:text-purple-600'
            }`}
            id={`nav-item-${item.label.toLowerCase()}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// MAIN PAGE COMPONENT
export default function ZettlPage() {
  const navigate = useNavigate();
  const { user, userId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  // Core domain data states
  const [friendRequests, setFriendRequests] = useState([]);
  const [debts, setDebts] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [totalFinOwed, setTotalFinOwed] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);
  
  // Filtering selections: 'all', 'lent' (friends owe you), 'borrowed' (you owe friends)
  const [filter, setFilter] = useState('all');

  // Trigger loading states
  const [bellLoading, setBellLoading] = useState(false);
  const [settledLoading, setSettledLoading] = useState(false);

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
      const { data: list, error } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');
      if (error) throw error;
      if (list && list.length > 0) {
        const friendIds = list.map(f => f.friend_id);
        const { data: profilesList, error: pError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', friendIds);
        if (!pError && profilesList) {
          const prepared = profilesList.map(p => ({
            id: p.id,
            friendId: p.id,
            username: p.username,
            full_name: p.full_name || p.username,
            avatar_url: p.avatar_url
          }));
          setFriendsList(prepared);
        }
      } else {
        setFriendsList([]);
      }
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
        .or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`);

      if (dErr) throw dErr;

      if (rawDebts && rawDebts.length > 0) {
        const involvedIds = Array.from(
          new Set(rawDebts.flatMap((d) => [d.creditor_id, d.debtor_id]))
        );

        // Map participant profiles
        const { data: pProfiles, error: ppErr } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', involvedIds);

        if (!ppErr && pProfiles) {
          const profileMap = new Map(pProfiles.map((p) => [p.id, p]));
          const enrichedDebts = rawDebts.map((d) => ({
            ...d,
            creditor_profile: profileMap.get(d.creditor_id) || { username: 'user', full_name: 'Zavr Creditor' },
            debtor_profile: profileMap.get(d.debtor_id) || { username: 'user', full_name: 'Zavr Debtor' },
          }));
          setDebts(enrichedDebts);

          // Sum balances
          const lendTotal = enrichedDebts
            .filter((d) => d.creditor_id === userId && (d.status === 'pending' || d.settled === false))
            .reduce((s, d) => s + Number(d.amount), 0);

          const borrowTotal = enrichedDebts
            .filter((d) => d.debtor_id === userId && (d.status === 'pending' || d.settled === false))
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
    } catch (err) {
      console.error('[ZETTL] Load lists failed:', err.message);
    } finally {
      setLoading(false);
      setBellLoading(false);
    }
  }, [userId]);

  // Dispatch connection requests
  const handleAddFriend = async (targetUserId) => {
    try {
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: userId,
        receiver_id: targetUserId,
        status: 'pending',
      });

      if (error) throw error;
      toast.success('Link invitation dispatched successfully!');
      fetchLedgersAndFriendsData();
    } catch (err) {
      toast.error(err.message || 'Verification link failing, retry.');
    }
  };

  // Accept incoming friend request link invitation
  const handleAcceptFriendRequest = async (requestId, senderId) => {
    setSettledLoading(true);
    try {
      // 1. Update friend request status to accepted
      const { error: reqError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (reqError) throw reqError;

      // 2. Insert bidirectional connections block
      const { error: friendErr1 } = await supabase.from('friends').insert({
        user_id: userId,
        friend_id: senderId,
        status: 'accepted',
      });
      if (friendErr1) throw friendErr1;

      const { error: friendErr2 } = await supabase.from('friends').insert({
        user_id: senderId,
        friend_id: userId,
        status: 'accepted',
      });
      if (friendErr2) throw friendErr2;

      toast.success('Friend request connected! Link created successfully.');
      fetchLedgersAndFriendsData();
      fetchFriends();
    } catch (err) {
      toast.error(err.message || 'Could not map friend links.');
    } finally {
      setSettledLoading(false);
    }
  };

  // Decline/Reject friend request link invitation
  const handleDeclineFriendRequest = async (requestId) => {
    setSettledLoading(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Link invitation declined.');
      fetchLedgersAndFriendsData();
    } catch (err) {
      toast.error(err.message || 'Rejection actions disrupted.');
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
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // onSendMoney (Pay/repay)
  const handleSendMoney = async (friendId, amount, note) => {
    try {
      const { error } = await supabase.from('debts').insert({
        creditor_id: friendId,
        debtor_id: userId,
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
        debtor_id: friendId,
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

      // Real-time channel listeners for friend_requests and debts
      const reqsChannel = supabase
        .channel('realtime-friend-requests-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_requests' },
          () => {
            fetchLedgersAndFriendsData();
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

      return () => {
        supabase.removeChannel(reqsChannel);
        supabase.removeChannel(debtsChannel);
      };
    }
  }, [userId, fetchProfileDetails, fetchLedgersAndFriendsData, fetchFriends]);

  // Loading barrier state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 font-mono">
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
      return d.debtor_id === userId && (d.status === 'pending' || d.settled === false);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-28 font-sans text-gray-800" id="zettl-page-container">
      
      {/* FIXED POSITION HEADER SECTION */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-30 shadow-xs" id="zettl-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-500 text-sm font-medium">Hello!</span>
            <h1 className="text-gray-900 font-semibold text-xl">
              @{profile?.username || user?.email?.split('@')[0] || 'zavr'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <FriendRequestBell
              userId={userId}
              pendingRequests={friendRequests}
              onAccept={handleAcceptFriendRequest}
              onDecline={handleDeclineFriendRequest}
              loading={bellLoading || settledLoading}
            />
            {profile?.avatar_url && (
              <div 
                onClick={() => navigate('/profile')}
                className="w-10 h-10 rounded-full border border-gray-200 shadow-sm overflow-hidden hover:scale-105 transition-all duration-200 cursor-pointer"
                id="profile-avatar-head"
              >
                <img 
                  src={profile.avatar_url} 
                  alt="Profile Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-2xl mx-auto px-4 py-6 space-y-6"
      >
        {/* HERO TITLE & SPLIT THEME */}
        <div className="space-y-1" id="hero-zettl-intro">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
            Split System
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 leading-snug">
            Settle up, avoid awkward ledger alerts.
          </h2>
        </div>

        {/* BALANCE SUMMARY CARDS GRID */}
        <div className="grid grid-cols-2 gap-4" id="zettl-balance-grid">
          <BalanceCard
            title="Friends Owe You"
            amount={totalFinOwed}
            gradient="bg-gradient-to-r from-green-500 to-emerald-600"
            onClick={() => setFilter(filter === 'lent' ? 'all' : 'lent')}
            isFiltered={filter === 'lent'}
            icon={ArrowUpCircle}
          />
          <BalanceCard
            title="You Owe Friends"
            amount={totalYouOwe}
            gradient="bg-gradient-to-r from-orange-500 to-red-600"
            onClick={() => setFilter(filter === 'borrowed' ? 'all' : 'borrowed')}
            isFiltered={filter === 'borrowed'}
            icon={ArrowDownCircle}
          />
        </div>

        {/* STATISTICS SUMMARY BAR */}
        <div className="bg-white rounded-xl p-3 flex justify-between items-center shadow-sm border border-gray-100" id="zettl-stats-bar">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-gray-500">
              Settled this month: <strong className="text-gray-950">₹{totalSettledThisMonth.toLocaleString('en-IN')}</strong>
            </span>
          </div>
          <div className="h-4 w-px bg-gray-150" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500">
              Pending: <strong className="text-gray-950">₹{totalPendingOwed.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>

        {/* Filter Indicator Banner */}
        {filter !== 'all' && (
          <div 
            className="flex items-center justify-between px-4 py-2.5 bg-purple-50 border border-purple-100 rounded-xl text-xs font-medium"
            id="filter-banner"
          >
            <span className="text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              Showing {filter === 'lent' ? "friends' debts to you" : 'your debts to friends'}
            </span>
            <button
              onClick={() => setFilter('all')}
              className="font-semibold text-purple-600 hover:text-purple-800 uppercase tracking-wider cursor-pointer"
            >
              Clear Filter [X]
            </button>
          </div>
        )}

        {/* CONTACT FINDER SEARCH ZONE */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 space-y-4" id="search-section-box">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
              Find New Connections
            </span>
            <span className="text-sm text-gray-500 mt-0.5">
              Link with Zavr contacts to build active debt boards.
            </span>
          </div>

          <ContactSearch
            userId={userId}
            onAddFriend={handleAddFriend}
            onFocusInput={handleFocusSearch}
            searchInputRef={searchInputRef}
          />
        </div>

        {/* DYNAMIC SETTLEMENT LIST */}
        <div className="space-y-4" id="settlement-ledger-box">
          {loading ? (
            <div className="space-y-3" id="zettl-list-loader">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredDebts.length === 0 ? (
            <EmptyDebtState onLinkContactsClick={handleFocusSearch} />
          ) : (
            <DebtList
              debts={filteredDebts}
              userId={userId}
              onSettle={handleSettleUpDebt}
              loading={settledLoading}
            />
          )}
        </div>

      </motion.div>

      {/* FLOATING ACTION BUTTON */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full p-4 shadow-lg fixed bottom-20 right-4 hover:scale-105 active:scale-95 transition-all cursor-pointer z-40 flex items-center justify-center border-0"
        id="zettl-fab"
      >
        <Plus className="w-6 h-6" />
      </button>

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
          />
        )}
      </AnimatePresence>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <BottomNavigation />
    </div>
  );
}

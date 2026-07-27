import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Bell, Flame, Check, Trash2, Sparkles, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import NotificationBell from './NotificationBell';
import RefreshButton from './RefreshButton';
import { useTheme } from '../context/ThemeContext';

import { AVATARS_50, getAvatarUrl } from '../constants/avatars';

export default function ProfileHeader() {
  const { 
    currentUser, isAuthLoading, session, notifications, 
    markNotificationRead, markAllNotificationsRead, clearNotifications,
    updateQuestProgress 
  } = useStore();
  const { theme, toggleTheme } = useTheme();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Do not render top header on chat routes
  if (location.pathname.includes('/zettl/chat/')) return null;

  // 4. Handle pending profile query states with a custom Skeleton Loader
  if (isAuthLoading) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[95] px-4 pt-4 pointer-events-none">
        <div className="w-full mx-auto flex pointer-events-auto bg-white/90 dark:bg-[#111118]/80 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-4 justify-between items-center shadow-lg relative">
          {/* Skeleton Profile Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0 animate-pulse">
              <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.05]">
                <div className="w-full h-full bg-black/[0.01] dark:bg-white/[0.02] rounded-full" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/[0.03] dark:bg-white/[0.04] rounded-lg border-2 border-white dark:border-[#111118]" />
            </div>
            
            <div className="flex flex-col min-w-0 font-sans gap-1 animate-pulse" style={{ zIndex: 10 }}>
              <div className="h-2 w-16 bg-black/[0.04] dark:bg-white/[0.04] rounded" />
              <div className="h-3 w-24 bg-black/[0.08] dark:bg-white/[0.08] rounded mt-0.5" />
              <div className="h-2 w-20 bg-black/[0.04] dark:bg-white/[0.04] rounded mt-0.5" />
            </div>
          </div>

          {/* Skeleton Right Side Controls */}
          <div className="flex items-center gap-2 flex-shrink-0 animate-pulse">
            <div className="w-12 h-8 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05] flex items-center justify-center" />
            <div className="w-9 h-9 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05]" />
            <div className="w-9 h-9 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05]" />
          </div>
        </div>
      </div>
    );
  }

  // If loading is complete but no active session, do not render profile header
  if (!session) return null;

  // 5. If profile query failed/missing, fallback gracefully to auth.user.email and fallback values
  const activeUser = currentUser || {
    id: session?.user?.id || '',
    fullName: session?.user?.user_metadata?.full_name || session?.user?.email || 'User',
    username: session?.user?.email?.split('@')[0] || 'user',
    avatar: session?.user?.user_metadata?.avatar_url || '',
    avatarId: session?.user?.user_metadata?.avatar_id || '',
    level: 1,
    streak: 0,
    xp: 0
  };

  const headerFullName = activeUser.fullName?.trim() || session?.user?.email?.split('@')[0] || 'User';
  const headerUsername = activeUser.username?.trim() || session?.user?.email?.split('@')[0] || 'user';

  const toggleDarkMode = () => {
    toggleTheme();
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const xpProgress = (activeUser.xp % 500) / 5;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    updateQuestProgress('d2', 1);
    updateQuestProgress('w2', 1);
  };

  // Find Avatar using getAvatarUrl helper for GitHub Raw avatar assets
  const avatarUrl = getAvatarUrl(activeUser.avatar || activeUser.avatarId, activeUser.username || activeUser.id);

  return (
    <div className="fixed top-0 left-0 right-0 z-[95] px-4 pt-4 pointer-events-none">
      <div className="w-full mx-auto flex pointer-events-auto bg-white/90 dark:bg-[#111118]/80 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-3.5 justify-between items-center shadow-md dark:shadow-lg relative">
        {/* Left Section: Profile Info (Avatar, Text/Greeting, Username) */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/profile')}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08]">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-lg flex items-center justify-center text-[8px] font-black text-white border-2 border-white dark:border-[#111118]">
              {activeUser.level}
            </div>
          </div>
          
          <div className="flex flex-col min-w-0 font-sans" style={{ zIndex: 10 }}>
            <p className="text-[9px] font-bold text-zinc-500 dark:text-[#94A3B8] tracking-[0.2em] uppercase truncate" style={{ zIndex: 10 }}>
              {getTimeGreeting()}
            </p>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight leading-none truncate" style={{ zIndex: 10, letterSpacing: '-0.02em' }}>
              {headerFullName.includes('@') ? headerFullName.split('@')[0] : headerFullName.split(' ')[0]}
            </h2>
            <p className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/60 font-medium truncate mt-0.5" style={{ zIndex: 10 }}>
              @{headerUsername}
            </p>
          </div>
        </div>

        {/* Right Section: Interactive Controls (Streak, Theme, Notification) */}
        <div className="flex items-center gap-2 flex-shrink-0" ref={dropdownRef}>
          {/* Streak Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.05] shadow-sm dark:shadow-inner">
            <Flame size={14} className={cn(
              "transition-all",
              (activeUser.streak || 0) > 0 ? "text-orange-500 animate-pulse" : "text-zinc-300 dark:text-white/20"
            )} />
            <span className="text-xs font-bold text-zinc-800 dark:text-white">{activeUser.streak || 0}</span>
          </div>

          {/* Refresh / Sync Button */}
          <RefreshButton showLabel={false} />

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.05] hover:border-[#FF8A8A]/40 dark:hover:border-[#FF8A8A]/40 text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Real-time Zettl Notification Bell */}
          <div className="text-zinc-600 dark:text-white hover:text-[#FF6B6B] dark:hover:text-[#FF6B6B] flex items-center transition-colors">
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}

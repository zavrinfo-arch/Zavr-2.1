import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Bell, Flame, Check, Trash2, Sparkles, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import NotificationBell from './NotificationBell';

import { AVATARS_50 } from '../constants/avatars';

export default function ProfileHeader() {
  const { 
    currentUser, isAuthLoading, session, theme, setTheme, notifications, 
    markNotificationRead, markAllNotificationsRead, clearNotifications,
    updateQuestProgress 
  } = useStore();
  
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
        <div className="w-full max-w-md mx-auto flex pointer-events-auto clay relative p-4 justify-between items-center">
          {/* Skeleton Profile Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0 animate-pulse">
              <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-surface-light border border-border">
                <div className="w-full h-full bg-surface rounded-full" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface rounded-lg border-2 border-surface" />
            </div>
            
            <div className="flex flex-col min-w-0 font-sans gap-1 animate-pulse" style={{ zIndex: 10 }}>
              <div className="h-2 w-16 bg-surface-light rounded" />
              <div className="h-3 w-24 bg-zinc-400 rounded mt-0.5" />
              <div className="h-2 w-20 bg-surface-light rounded mt-0.5" />
            </div>
          </div>

          {/* Skeleton Right Side Controls */}
          <div className="flex items-center gap-2 flex-shrink-0 animate-pulse">
            <div className="w-12 h-8 rounded-xl bg-surface-light border border-border flex items-center justify-center" />
            <div className="w-9 h-9 rounded-xl bg-surface-light border border-border" />
            <div className="w-9 h-9 rounded-xl bg-surface-light border border-border" />
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
    setTheme(theme === 'dark' ? 'light' : 'dark');
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

  // 1 & 5. Find Avatar with high priority on avatar_url, then fallback to finding by ID, then DiceBear placeholder
  const avatarUrl = activeUser.avatar || 
    AVATARS_50.find(a => a.id === activeUser.avatarId?.toString())?.url || 
    `https://api.dicebear.com/7.x/lorelei/svg?seed=${activeUser.username}`;

  return (
    <div className="fixed top-0 left-0 right-0 z-[95] px-4 pt-4 pointer-events-none">
      <div className="w-full max-w-md mx-auto flex pointer-events-auto clay relative p-4 justify-between items-center">
        {/* Left Section: Profile Info (Avatar, Text/Greeting, Username) */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/profile')}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-surface-light border border-border">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 clay-coral rounded-lg flex items-center justify-center text-[8px] font-black text-white border-2 border-surface">
              {activeUser.level}
            </div>
          </div>
          
          <div className="flex flex-col min-w-0 font-sans" style={{ zIndex: 10 }}>
            <p className="text-[9px] font-black text-[#8E8E93] tracking-[0.2em] uppercase truncate" style={{ zIndex: 10 }}>
              {getTimeGreeting()}
            </p>
            <h2 className="text-sm font-black text-foreground tracking-tight leading-none truncate" style={{ zIndex: 10, letterSpacing: '-0.02em' }}>
              {headerFullName.includes('@') ? headerFullName.split('@')[0] : headerFullName.split(' ')[0]}
            </h2>
            <p className="text-[9px] text-[#8E8E93] font-medium truncate mt-0.5" style={{ zIndex: 10 }}>
              @{headerUsername}
            </p>
          </div>
        </div>

        {/* Right Section: Interactive Controls (Streak, Theme, Notification) */}
        <div className="flex items-center gap-2 flex-shrink-0" ref={dropdownRef}>
          {/* Streak Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-light border border-border shadow-inner">
            <Flame size={14} className={cn(
              "transition-all",
              (activeUser.streak || 0) > 0 ? "text-orange-500 animate-pulse" : "text-foreground/20"
            )} />
            <span className="text-xs font-black text-foreground">{activeUser.streak || 0}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-surface-light hover:bg-surface border border-border hover:text-[#FF6B6B] text-foreground/70 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Real-time Zettl Notification Bell */}
          <div className="text-foreground hover:text-[#FF6B6B] flex items-center">
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}

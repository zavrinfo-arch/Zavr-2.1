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
        <div 
          className="w-full max-w-md mx-auto flex pointer-events-auto shadow-2xl relative"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: '#1E1E1E',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            boxShadow: 'inset 2px 2px 5px rgba(255, 255, 255, 0.06), inset -3px -3px 6px rgba(0, 0, 0, 0.7), 0px 12px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Skeleton Profile Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0 animate-pulse">
              <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-zinc-850" style={{ boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.05)' }}>
                <div className="w-full h-full bg-zinc-800 rounded-full" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-800 rounded-lg border-2 border-[#1E1E1E]" />
            </div>
            
            <div className="flex flex-col min-w-0 font-sans gap-1 animate-pulse" style={{ zIndex: 10 }}>
              <div className="h-2 w-16 bg-zinc-800 rounded" />
              <div className="h-3 w-24 bg-zinc-800 rounded mt-0.5" />
              <div className="h-2 w-20 bg-zinc-800 rounded mt-0.5" />
            </div>
          </div>

          {/* Skeleton Right Side Controls */}
          <div className="flex items-center gap-2 flex-shrink-0 animate-pulse">
            <div className="w-12 h-8 rounded-xl bg-zinc-850 border border-white/5 flex items-center justify-center" />
            <div className="w-9 h-9 rounded-xl bg-zinc-850 border border-white/5" />
            <div className="w-9 h-9 rounded-xl bg-zinc-850 border border-white/5" />
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
      <div 
        className="w-full max-w-md mx-auto flex pointer-events-auto shadow-2xl relative"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: '#1E1E1E',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: 'inset 2px 2px 5px rgba(255, 255, 255, 0.06), inset -3px -3px 6px rgba(0, 0, 0, 0.7), 0px 12px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Left Section: Profile Info (Avatar, Text/Greeting, Username) */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/profile')}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full p-0.5 flex items-center justify-center overflow-hidden bg-zinc-800" style={{ boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.1)' }}>
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 clay-coral rounded-lg flex items-center justify-center text-[8px] font-black text-white border-2 border-[#1E1E1E]">
              {activeUser.level}
            </div>
          </div>
          
          <div className="flex flex-col min-w-0 font-sans" style={{ zIndex: 10 }}>
            <p className="text-[9px] font-black text-[#8E8E93] tracking-[0.2em] uppercase truncate" style={{ zIndex: 10 }}>
              {getTimeGreeting()}
            </p>
            <h2 className="text-sm font-black text-white tracking-tight leading-none truncate" style={{ zIndex: 10, letterSpacing: '-0.02em' }}>
              {(activeUser.fullName || '').split(' ')[0] || 'User'}
            </h2>
            <p className="text-[9px] text-[#8E8E93] font-medium truncate mt-0.5" style={{ zIndex: 10 }}>
              @{activeUser.username}
            </p>
          </div>
        </div>

        {/* Right Section: Interactive Controls (Streak, Theme, Notification) */}
        <div className="flex items-center gap-2 flex-shrink-0" ref={dropdownRef}>
          {/* Streak Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-white/5 shadow-inner">
            <Flame size={14} className={cn(
              "transition-all",
              (activeUser.streak || 0) > 0 ? "text-orange-500 animate-pulse" : "text-white/20"
            )} />
            <span className="text-xs font-black text-white">{activeUser.streak || 0}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:text-[#FF6B6B] text-white/70 transition-all active:scale-95 cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Real-time Zettl Notification Bell */}
          <div className="text-white hover:text-[#FF6B6B] flex items-center">
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}

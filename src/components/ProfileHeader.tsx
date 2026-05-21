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
    currentUser, theme, setTheme, notifications, 
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

  if (!currentUser) return null;
  if (location.pathname.includes('/zettl/chat/')) return null;

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const xpProgress = (currentUser.xp % 500) / 5;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    updateQuestProgress('d2', 1);
    updateQuestProgress('w2', 1);
  };

  const avatarUrl = AVATARS_50.find(a => a.id === currentUser.avatarId?.toString())?.url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser.username}`;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] px-6 py-6 flex items-center justify-between bg-gradient-to-b from-background to-transparent pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto" onClick={() => navigate('/profile')}>
        <div className="relative">
          <div className="w-14 h-14 rounded-full clay-card bg-surface p-1 flex items-center justify-center overflow-hidden">
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover p-1" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 clay-coral rounded-lg flex items-center justify-center text-[10px] font-black text-white border-2 border-background">
            {currentUser.level}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-[9px] font-black opacity-30 tracking-[0.2em]">{getTimeGreeting()}</p>
          <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight serif-heading">{(currentUser.fullName || '').split(' ')[0]}</h2>
          <div className="w-24 h-1 clay-inset mt-1 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              className="h-full bg-[#4ECDC4]"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pointer-events-auto relative" ref={dropdownRef}>
        {/* Streak Counter */}
        <div className="flex items-center gap-1.5 px-3 py-2 clay-card bg-surface/50">
          <Flame size={16} className={cn(
            "transition-all",
            (currentUser.streak || 0) > 0 ? "text-orange-500 animate-pulse" : "text-foreground/20"
          )} />
          <span className="text-xs font-black">{currentUser.streak || 0}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-2xl clay-card opacity-20 hover:opacity-100 transition-all active:scale-90"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Real-time Zettl Notification Bell */}
        <NotificationBell />
      </div>
    </div>
  );
}

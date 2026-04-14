import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Bell, Flame, Check, Trash2, Sparkles, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

import { AVATARS } from '../constants';

export default function ProfileHeader() {
  const { 
    currentUser, theme, setTheme, notifications, 
    markAllNotificationsRead, clearNotifications,
    updateQuestProgress 
  } = useStore();
  const navigate = useNavigate();
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

  const avatarUrl = AVATARS.find(a => a.id === currentUser.avatarId)?.url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser.username}`;

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
          <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight serif-heading">{currentUser.fullName.split(' ')[0]}</h2>
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

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            className={cn(
              "p-3 rounded-2xl clay-card transition-all active:scale-90 relative",
              unreadCount > 0 ? "opacity-100" : "opacity-20 hover:opacity-100"
            )}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6B6B] rounded-full border-2 border-background" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-4 w-80 clay bg-surface p-4 shadow-2xl pointer-events-auto"
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-sm font-black uppercase tracking-widest">Notifications</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={markAllNotificationsRead}
                      className="p-1.5 rounded-lg hover:bg-foreground/5 text-emerald-500"
                      title="Mark all as read"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={clearNotifications}
                      className="p-1.5 rounded-lg hover:bg-foreground/5 text-red-500"
                      title="Clear all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto hide-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto clay-inset flex items-center justify-center opacity-20">
                        <Bell size={24} />
                      </div>
                      <p className="text-xs opacity-30 font-medium">All caught up!</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id}
                        className={cn(
                          "p-4 rounded-2xl transition-all border",
                          n.read ? "bg-foreground/5 border-transparent opacity-60" : "clay-card border-foreground/5"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                            n.type === 'achievement' ? "bg-amber-500/10 text-amber-500" :
                            n.type === 'streak' ? "bg-orange-500/10 text-orange-500" :
                            "bg-blue-500/10 text-blue-500"
                          )}>
                            {n.type === 'achievement' ? <Trophy size={16} /> :
                             n.type === 'streak' ? <Flame size={16} /> :
                             <Sparkles size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                            <p className="text-[10px] opacity-40 leading-relaxed mt-0.5">{n.message}</p>
                            <p className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-2">
                              {formatDistanceToNow(parseISO(n.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Bell } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ProfileHeader() {
  const { currentUser, theme, setTheme } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!currentUser) return null;

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const xpProgress = (currentUser.xp % 1000) / 10;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] px-6 py-6 flex items-center justify-between bg-gradient-to-b from-background to-transparent pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto" onClick={() => navigate('/profile')}>
        <div className="relative">
          <div className="w-14 h-14 rounded-full clay-card bg-surface p-1 flex items-center justify-center overflow-hidden">
            <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" alt="" />
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

      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-2xl clay-card opacity-20 hover:opacity-100 transition-all active:scale-90"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notification Bell */}
        <button
          className="p-3 rounded-2xl clay-card opacity-20 hover:opacity-100 transition-all active:scale-90 relative"
        >
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6B6B] rounded-full border-2 border-background" />
        </button>
      </div>
    </div>
  );
}

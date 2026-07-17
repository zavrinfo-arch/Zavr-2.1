/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Target, Plus, History,
  Bell, X, CheckCircle2, Flame, Trophy, Users, Info,
  HandCoins
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

import ProfileHeader from './ProfileHeader';

export function BottomNav({ onPlusClick }: { onPlusClick: () => void }) {
  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Target, label: 'Goals', path: '/goals' },
    { icon: null, label: '', path: '' }, // Placeholder for Plus
    { icon: History, label: 'History', path: '/history' },
    { icon: HandCoins, label: 'Zettl', path: '/zettl' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-6 py-5 bg-white/90 dark:bg-[#111118]/85 border-t border-black/[0.06] dark:border-white/[0.06] backdrop-blur-2xl flex items-center justify-around shadow-lg dark:shadow-[0_-10px_35px_rgba(0,0,0,0.5)]">
      {navItems.map((item, i) => {
        if (i === 2) {
          return (
            <div key="plus" className="relative w-12">
              <motion.button
                whileHover={{ scale: 1.1, translateY: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "tween", duration: 0.2 }}
                onClick={onPlusClick}
                className="absolute -top-14 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-2xl flex items-center justify-center text-white border-4 border-zinc-50 dark:border-[#0a0a0f] shadow-[0_8px_25px_rgba(255,107,107,0.35)] cursor-pointer"
              >
                <Plus className="w-8 h-8" />
              </motion.button>
            </div>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300",
              isActive ? "text-[#FF6B6B] scale-105" : "text-zinc-500 dark:text-[#94A3B8] opacity-50 hover:opacity-90 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-[0.2em]">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Layout({ children, onPlusClick }: { children: React.ReactNode, onPlusClick: () => void }) {
  const location = useLocation();
  const hasProfileHeader = !location.pathname.includes('/zettl/chat/');

  return (
    <div className={cn(
      "min-h-screen pb-24 max-w-md mx-auto relative overflow-x-hidden bg-zinc-50 dark:bg-[#0a0a0f] text-zinc-900 dark:text-white font-sans antialiased",
      hasProfileHeader ? "pt-28" : "pt-4"
    )}>
      <ProfileHeader />
      <main key={location.pathname} className="px-5 page-transition">
        {children}
      </main>
      <BottomNav onPlusClick={onPlusClick} />
    </div>
  );
}

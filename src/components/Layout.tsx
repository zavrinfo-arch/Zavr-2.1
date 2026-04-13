/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Target, Plus, History, User, 
  Bell, X, CheckCircle2, Flame, Trophy, Users, Info
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

import ProfileHeader from './ProfileHeader';
import ZavrChat from './ZavrChat';

export function BottomNav({ onPlusClick }: { onPlusClick: () => void }) {
  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Target, label: 'Goals', path: '/goals' },
    { icon: null, label: '', path: '' }, // Placeholder for Plus
    { icon: History, label: 'History', path: '/history' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-6 py-6 bg-surface/85 backdrop-blur-2xl flex items-center justify-around border-t border-foreground/5">
      {navItems.map((item, i) => {
        if (i === 2) {
          return (
            <div key="plus" className="relative w-12">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onPlusClick}
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-16 h-16 clay-coral rounded-2xl flex items-center justify-center text-white border-4 border-background shadow-2xl"
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
              "flex flex-col items-center gap-1.5 transition-all",
              isActive ? "text-[#FF6B6B] scale-110" : "opacity-20 hover:opacity-40"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Layout({ children, onPlusClick }: { children: React.ReactNode, onPlusClick: () => void }) {
  return (
    <div className="min-h-screen pb-24 pt-20 max-w-md mx-auto relative overflow-x-hidden">
      <ProfileHeader />
      <ZavrChat />
      <main className="px-6">
        {children}
      </main>
      <BottomNav onPlusClick={onPlusClick} />
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { currentUser, session, isAuthLoading } = useStore();

  useEffect(() => {
    // We only navigate once auth loading is definitely finished
    if (isAuthLoading) return;

    const timer = setTimeout(() => {
      // 1. Check if we even have a session
      if (!session) {
        console.log('[SPLASH] No session, navigating to auth');
        navigate('/auth');
        return;
      }

      // 2. We have a session, go straight to home
      console.log('[SPLASH] Session exists, navigating to home');
      navigate('/home');
    }, 1700); // 1.7s allows the premium animations to breathe beautifully

    return () => clearTimeout(timer);
  }, [currentUser, session, isAuthLoading, navigate]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden z-50">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-x-0 top-1/4 -translate-y-1/2 flex justify-center gap-24 pointer-events-none opacity-20">
        <div className="w-80 h-80 bg-cyan-500 rounded-full blur-[120px] animate-pulse" />
        <div className="w-80 h-80 bg-pink-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <motion.div className="flex flex-col items-center z-10">
        {/* Floating Logo Container with Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ 
            opacity: 1, 
            y: [0, -8, 0],
            scale: 1
          }}
          transition={{
            opacity: { duration: 0.8, ease: "easeOut" },
            scale: { duration: 0.8, ease: "easeOut" },
            y: {
              repeat: Infinity,
              duration: 4,
              ease: "easeInOut",
              delay: 0.4
            }
          }}
          className="relative inline-block backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 rounded-[32px] p-6 shadow-2xl shadow-cyan-500/10"
        >
          {/* Subtle Pink + Cyan Glow Loop */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-pink-500/20 blur-xl opacity-60 rounded-[32px] animate-pulse pointer-events-none" />
          
          <img
            src="https://raw.githubusercontent.com/zavrinfo-arch/zavr-privacy-policy/main/zavr_logo.png"
            alt="Zavr Logo"
            className="w-24 h-24 object-contain rounded-3xl relative z-10 hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Brand Text */}
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-6 text-5xl font-black tracking-tight text-foreground"
        >
          Zavr
        </motion.h1>

        {/* Pulse glowing brand accent line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className="mt-4 w-20 h-1 rounded-full bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 origin-center shadow-lg shadow-cyan-400/50"
        />
      </motion.div>

      {/* Subtle loader footer */}
      <div className="absolute bottom-16 left-0 right-0 px-16 max-w-sm mx-auto">
        <div className="h-[2px] w-full bg-foreground/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-cyan-400 to-pink-400"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { currentUser, session, isAuthLoading } = useStore();
  const [isExiting, setIsExiting] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparing your experience...");

  useEffect(() => {
    // Rotating elegant loading messages to provide immediate high-end feedback
    const messages = [
      { delay: 0, text: "Initializing secure connection..." },
      { delay: 400, text: "Preparing your premium dashboard..." },
      { delay: 850, text: "Syncing personal ledgers..." },
      { delay: 1250, text: "Welcome to Zavr!" }
    ];

    const timers = messages.map(msg => 
      setTimeout(() => setLoadingText(msg.text), msg.delay)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // We only transition once the auth loading sequence has finalized
    if (isAuthLoading) return;

    // Start a smooth exit fade-out transition before navigating
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1350);

    // Navigate to the correct destination after the exit transition completes
    const navTimer = setTimeout(() => {
      if (!session) {
        console.log('[SPLASH] No session, navigating to auth');
        navigate('/auth');
      } else {
        console.log('[SPLASH] Session exists, navigating to home');
        navigate('/home');
      }
    }, 1750);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
    };
  }, [currentUser, session, isAuthLoading, navigate]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0f] overflow-hidden z-50 font-sans"
      id="splash-screen-container"
    >
      {/* Premium Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" id="splash-glow">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-gradient-to-tr from-[#FF6B6B]/5 dark:from-[#FF6B6B]/10 to-[#FF7C7C]/2 dark:to-[#FF7C7C]/5 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* Centered Glassmorphism Card Wrapper */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-xs p-8 rounded-[28px] bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-2xl flex flex-col items-center shadow-xl dark:shadow-2xl relative z-10 text-center"
        id="splash-card"
      >
        {/* Subtle radial logo highlight */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#FF6B6B]/20 rounded-full blur-xl pointer-events-none" />

        {/* Floating / Breathing Logo Container */}
        <motion.div
          animate={{ 
            y: [0, -6, 0]
          }}
          transition={{
            repeat: Infinity,
            duration: 3.5,
            ease: "easeInOut"
          }}
          className="relative w-24 h-24 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.1] backdrop-blur-md p-1.5 flex items-center justify-center shadow-md dark:shadow-xl mb-6 overflow-hidden"
          id="splash-logo-container"
        >
          {/* Subtle logo background mesh */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#FF7C7C]/10 to-[#FF6B6B]/10 opacity-30 rounded-xl" />
          
          <img
            src="https://raw.githubusercontent.com/zavrinfo-arch/zavr-privacy-policy/main/zavr_logo.png"
            alt="Zavr Logo"
            className="w-full h-full object-contain rounded-xl relative z-10 select-none"
            referrerPolicy="no-referrer"
            id="splash-logo"
          />
        </motion.div>

        {/* Display Brand Heading */}
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none" id="splash-brand-title">
          Z<span className="text-[#FF6B6B]">a</span>vr
        </h1>
        <p className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/40 font-bold uppercase tracking-[0.25em] mt-2 font-mono" id="splash-brand-subtitle">
          Finance Playground
        </p>

        {/* Just ONE Premium Progress Bar with Glow Effect */}
        <div className="w-full h-1.5 bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] rounded-full overflow-hidden mt-8 relative shadow-inner" id="splash-progress-track">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.3, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] shadow-[0_0_12px_rgba(255,107,107,0.55)] rounded-full"
            id="splash-progress-bar"
          />
        </div>

        {/* Loading Message Footer with smooth change animation */}
        <div className="h-4 mt-4.5 flex items-center justify-center" id="splash-message-container">
          <AnimatePresence mode="wait">
            <motion.p 
              key={loadingText}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[10px] font-bold text-zinc-500 dark:text-[#94A3B8]/60 uppercase tracking-wider"
              id="splash-loading-text"
            >
              {loadingText}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Humble credit label matching the onboarding design elements */}
      <div className="absolute bottom-6 w-full text-center text-[9px] font-bold tracking-[0.25em] text-zinc-300 dark:text-[#94A3B8]/20 uppercase font-mono" id="splash-footer-label">
        Secured in Zavr Sandbox Core
      </div>
    </motion.div>
  );
}

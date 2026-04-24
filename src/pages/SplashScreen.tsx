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

      // 2. We have a session, now check the profile
      if (!currentUser) {
        console.log('[SPLASH] Session exists but no profile, navigating to onboarding');
        navigate('/onboarding');
      } else if (!currentUser.onboardingCompleted) {
        console.log('[SPLASH] Profile exists but onboarding incomplete, navigating to onboarding');
        navigate('/onboarding');
      } else {
        console.log('[SPLASH] Profile complete, navigating to home');
        navigate('/home');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentUser, isAuthLoading, navigate]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <motion.div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-24 h-24 mx-auto mb-8 clay-card bg-surface p-4 flex items-center justify-center relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#FF6B6B]/20 to-[#4ECDC4]/20 blur-2xl rounded-full animate-pulse" />
          <img src="/logo.svg" className="w-full h-full relative z-10" alt="Zavr Logo" />
        </motion.div>

        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          className="text-5xl font-black tracking-tighter text-foreground"
        >
          Zavr
        </motion.h1>
        
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="h-px w-32 bg-gradient-to-r from-transparent via-[#4ECDC4] to-transparent mx-auto mt-6"
        />
      </motion.div>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="mt-10 opacity-20 font-black uppercase tracking-[0.3em] text-[10px] px-12 text-center max-w-xs leading-relaxed"
      >
        "From intention to achievement"
      </motion.p>

      {/* Subtle loading indicator at bottom */}
      <div className="absolute bottom-16 left-0 right-0 px-16">
        <div className="h-1 w-full clay-inset bg-foreground/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1, ease: "linear" }}
            className="h-full bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4]"
          />
        </div>
      </div>
    </div>
  );
}

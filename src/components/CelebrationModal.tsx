/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Flame, Star, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'streak' | 'goal';
  value?: string | number;
}

export default function CelebrationModal({ isOpen, onClose, title, message, type, value }: CelebrationModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/90 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm clay bg-surface p-10 text-center space-y-8 overflow-hidden"
          >
            <div className="relative">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="w-28 h-28 mx-auto rounded-[2rem] clay-coral flex items-center justify-center text-white shadow-2xl"
              >
                {type === 'streak' ? <Flame size={56} /> : <Trophy size={56} />}
              </motion.div>
              
              {value && (
                <motion.div 
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                  className="absolute -bottom-2 -right-2 w-14 h-14 clay bg-foreground text-background rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl"
                >
                  {value}
                </motion.div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl font-bold text-foreground tracking-tight">{title}</h2>
              <p className="opacity-30 text-xs font-bold uppercase tracking-[0.2em] leading-relaxed">{message}</p>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <button 
                onClick={onClose}
                className="w-full py-5 clay-coral text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm active:scale-95 transition-all shadow-2xl"
              >
                Awesome!
              </button>
              <button 
                onClick={onClose}
                className="w-full py-4 clay-card opacity-20 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all hover:opacity-40"
              >
                Share Achievement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

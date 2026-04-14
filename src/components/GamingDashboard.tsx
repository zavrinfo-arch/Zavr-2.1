/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Target, Zap, Clock, Play, Pause, 
  RotateCcw, Sparkles, Flame, Snowflake, ChevronRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export default function GamingDashboard() {
  const { 
    dailyQuests, weeklyQuests, focusSessions, 
    startFocusSession, completeFocusSession,
    currentUser, buyStreakFreeze, updateQuestProgress
  } = useStore();

  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerType, setTimerType] = useState<'study' | 'break'>('study');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleTimerComplete = () => {
    setTimerActive(false);
    if (currentSessionId) {
      completeFocusSession(currentSessionId);
    }
    if (timerType === 'study') {
      setTimerType('break');
      setTimeLeft(5 * 60);
    } else {
      setTimerType('study');
      setTimeLeft(25 * 60);
    }
    setCurrentSessionId(null);
  };

  const startTimer = () => {
    if (!timerActive) {
      const id = Math.random().toString(36).substr(2, 9);
      setCurrentSessionId(id);
      startFocusSession(timerType, timerType === 'study' ? 25 : 5);
      setTimerActive(true);
    } else {
      setTimerActive(false);
    }
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimeLeft(timerType === 'study' ? 25 * 60 : 5 * 60);
    setCurrentSessionId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBuyFreeze = () => {
    const res = buyStreakFreeze();
    if (res.success) {
      // Success toast is handled by store notification or we can add one here
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Streak Freeze Banner */}
      <div className="clay p-6 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 clay-card flex items-center justify-center text-blue-500">
            <Snowflake size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Streak Freeze</h3>
            <p className="text-[10px] opacity-40">Protect your streak for 500 XP</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-black">{currentUser?.streakFreezeCount || 0}</p>
            <p className="text-[8px] opacity-30 uppercase font-bold">Owned</p>
          </div>
          <button 
            onClick={handleBuyFreeze}
            className="px-4 py-2 clay-card bg-surface text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/10 transition-all"
          >
            Buy
          </button>
        </div>
      </div>

      {/* Focus Timer */}
      <div className="clay p-8 text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-foreground/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(timeLeft / (timerType === 'study' ? 25 * 60 : 5 * 60)) * 100}%` }}
            className={cn(
              "h-full transition-all",
              timerType === 'study' ? "bg-[#FF6B6B]" : "bg-[#4ECDC4]"
            )}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">
            {timerType === 'study' ? 'Deep Focus Mode' : 'Take a Break'}
          </p>
          <h2 className="text-6xl font-black tracking-tighter tabular-nums">
            {formatTime(timeLeft)}
          </h2>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={startTimer}
            className={cn(
              "w-16 h-16 rounded-full clay flex items-center justify-center transition-all active:scale-90",
              timerActive ? "text-[#FF6B6B]" : "text-[#4ECDC4]"
            )}
          >
            {timerActive ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>
          <button 
            onClick={resetTimer}
            className="w-16 h-16 rounded-full clay flex items-center justify-center opacity-40 hover:opacity-100 transition-all active:scale-90"
          >
            <RotateCcw size={24} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] font-bold opacity-30 uppercase tracking-widest">
          <Zap size={12} />
          Earn +10 XP per session
        </div>
      </div>

      {/* Quests Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-[#E2B05E]" />
            <h2 className="text-lg font-black uppercase tracking-widest">Active Quests</h2>
          </div>
          <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Reset in 12h</span>
        </div>

        <div className="space-y-3">
          {dailyQuests.map((quest) => (
            <div 
              key={quest.id}
              className={cn(
                "clay-card p-5 flex items-center justify-between group transition-all",
                quest.completed ? "opacity-50 grayscale" : "hover:border-foreground/20"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl clay-inset flex items-center justify-center",
                  quest.completed ? "text-emerald-500" : "text-foreground/20"
                )}>
                  {quest.completed ? <Check size={20} /> : <Target size={20} />}
                </div>
                <div>
                  <h4 className="text-sm font-bold">{quest.title}</h4>
                  <p className="text-[10px] opacity-40">{quest.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-[#FF6B6B]">+{quest.rewardXP} XP</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-16 h-1 clay-inset overflow-hidden">
                    <div 
                      className="h-full bg-[#FF6B6B]" 
                      style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-black opacity-30">{quest.progress}/{quest.target}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <div className="flex items-center gap-2 px-2 mb-4">
            <Sparkles size={18} className="text-purple-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">Weekly Challenges</h2>
          </div>
          <div className="space-y-3">
            {weeklyQuests.map((quest) => (
              <div 
                key={quest.id}
                className={cn(
                  "clay-card p-5 flex items-center justify-between bg-gradient-to-br from-purple-500/5 to-transparent",
                  quest.completed ? "opacity-50" : ""
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center text-purple-500">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{quest.title}</h4>
                    <p className="text-[10px] opacity-40">{quest.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-purple-500">+{quest.rewardXP} XP</p>
                  <button className="mt-2 text-[8px] font-black uppercase tracking-widest opacity-20 group-hover:opacity-100 transition-all flex items-center gap-1">
                    Details <ChevronRight size={8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

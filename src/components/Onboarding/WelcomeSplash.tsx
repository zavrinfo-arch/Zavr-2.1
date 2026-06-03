import React from 'react';
import { Target, Zap, UserCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface WelcomeSplashProps {
  fullName: string;
  avatarUrl: string;
  hasGoalSet: boolean;
  goalName?: string;
}

/**
 * WelcomeSplash
 * Renders the high-end premium summary showcase step with staggered enter motion effects.
 */
export default function WelcomeSplash({ fullName, avatarUrl, hasGoalSet, goalName }: WelcomeSplashProps) {
  const shortName = fullName.split(' ')[0] || 'User';

  return (
    <div className="space-y-6 max-w-xl mx-auto text-center animate-fadeIn duration-500">
      
      {/* Immersive Profile Orb Display */}
      <div className="relative w-28 h-28 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent animate-pulse" />
        <div className="w-full h-full rounded-full bg-white/[0.02] border border-white/[0.08] p-3 flex items-center justify-center relative overflow-hidden backdrop-blur-md">
          <img 
            src={avatarUrl} 
            alt="Profile Avatar" 
            className="w-20 h-20 object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]" 
          />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-2xl ring-4 ring-[#050505]">
          <Sparkles size={14} className="animate-spin-slow" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Welcome, {shortName}!</h2>
        <p className="text-xs text-[#8E8E93] uppercase tracking-[0.15em] max-w-sm mx-auto">
          Your Neo-Luxury Social Saving journey begins now
        </p>
      </div>

      {/* Structured outline of core financial disciplines/gameplay */}
      <div className="grid gap-3.5 max-w-md mx-auto pt-4 text-left">
        {hasGoalSet && goalName && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-4 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
              <Target size={22} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-[11px] uppercase tracking-widest text-[#8E8E93]">First Saving Goal Established</h4>
              <p className="text-sm font-medium text-white mt-1">"{goalName}"</p>
            </div>
          </motion.div>
        )}

        {[
          { 
            icon: Target, 
            title: 'Social & Collaborative Goals', 
            desc: 'Save seamlessly with friends, set targets, or create independent emergency reserves' 
          },
          { 
            icon: Zap, 
            title: 'Daily Streak Milestones', 
            desc: 'Nurture high-discipline habits to build XP, level up, and unlock rare badges' 
          },
          { 
            icon: UserCircle, 
            title: 'Financial Splitting Circles', 
            desc: 'Divide shared balances with classmates or mates with glassmorphic accuracy' 
          },
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + (hasGoalSet ? 1 : 0)) * 0.1 }}
            className="flex gap-4 p-5 rounded-3xl bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center shrink-0 text-[#E5E5EA]">
              <item.icon size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-[10px] uppercase tracking-widest text-white">{item.title}</h4>
              <p className="text-[11px] text-[#8E8E93] mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

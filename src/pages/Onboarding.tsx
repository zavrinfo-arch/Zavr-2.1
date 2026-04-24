/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { 
  Check, ArrowRight, ArrowLeft, Target, 
  Sparkles, Bell, ShieldCheck, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

import { AVATARS_50 } from '../constants/avatars';

const CATEGORIES = [
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'emergency', label: 'Emergency', icon: '🚨' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'investment', label: 'Investment', icon: '📈' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, updateUser, resetWeeklyChallenge } = useStore();

  React.useEffect(() => {
    if (currentUser?.onboardingCompleted) {
      console.log('[Onboarding] Already completed, redirecting home...');
      navigate('/home', { replace: true });
    }
  }, [currentUser, navigate]);

  const [data, setData] = useState({
    avatar: AVATARS_50[0],
    interests: [] as string[],
  });

  const handleNext = () => {
    if (step === 2 && data.interests.length < 2) {
      toast.error('Select at least 2 interests');
      return;
    }
    if (step < 3) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    console.log('[Onboarding] Finishing onboarding flow...');
    
    try {
      // 1. Prepare data
      const updates = {
        avatar: data.avatar.url,
        avatarId: (data.avatar.id as any),
        interests: data.interests,
        onboardingCompleted: true,
      };

      console.log('[Onboarding] Calling updateUser with:', updates);

      // 2. Update local store AND DB (Await both for consistency)
      await updateUser(updates);

      // 3. Double check the store flag
      const freshUser = useStore.getState().currentUser;
      console.log('[Onboarding] Store updated. onboardingCompleted:', freshUser?.onboardingCompleted);

      resetWeeklyChallenge();
      toast.success('Welcome to Zavr!', { icon: '✨' });
      
      // 4. Artificial delay to ensure DB propagation and state sync matches the redirect
      console.log('[Onboarding] Navigating in 800ms...');
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 800);
    } catch (err) {
      console.error('[Onboarding] Error during finish:', err);
      toast.error('Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    setData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : prev.interests.length < 5 
          ? [...prev.interests, id]
          : prev.interests
    }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-8 overflow-hidden">
      <div className="flex gap-2 mb-12">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              s <= step ? "bg-[#FF6B6B]" : "bg-foreground/5"
            )}
          />
        ))}
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">Choose your avatar</h2>
                <p className="opacity-40">Pick a character that represents you</p>
              </div>
              <div id="avatar-grid" className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-6 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar pb-24 p-6 clay-inset rounded-3xl bg-foreground/5">
                {AVATARS_50.map((avatar) => (
                  <motion.button
                    id={`avatar-${avatar.id}`}
                    key={avatar.id}
                    whileHover={{ scale: 1.1, zIndex: 10 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setData({ ...data, avatar });
                      console.log('[Onboarding] Avatar selected:', avatar.id);
                    }}
                    className={cn(
                      "relative aspect-square rounded-[1.5rem] transition-all flex items-center justify-center p-2",
                      data.avatar.id === avatar.id 
                        ? "clay-card bg-surface ring-4 ring-[#FF6B6B] shadow-2xl scale-110 z-10" 
                        : "opacity-40 hover:opacity-100"
                    )}
                  >
                    <img 
                      src={avatar.url} 
                      alt={avatar.id} 
                      className="w-full h-full object-contain drop-shadow-xl" 
                      referrerPolicy="no-referrer" 
                    />
                    {data.avatar.id === avatar.id && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#FF6B6B] flex items-center justify-center shadow-lg border-2 border-white z-20"
                      >
                        <Check className="text-white" size={12} strokeWidth={4} />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">What are you saving for?</h2>
                <p className="opacity-40">Select 2-5 categories that interest you</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleInterest(cat.id)}
                    className={cn(
                      "p-4 rounded-2xl clay-card border-2 transition-all flex items-center gap-3",
                      data.interests.includes(cat.id) ? "border-[#4ECDC4] bg-[#4ECDC4]/5" : "border-transparent"
                    )}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="font-bold text-sm opacity-80">{cat.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">Welcome to Zavr</h2>
                <p className="opacity-40">Here's what you can do</p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: Target, title: 'Set Goals', desc: 'Create solo or group goals with friends', color: '#FF6B6B' },
                  { icon: Zap, title: 'Build Streaks', desc: 'Save daily to maintain your streak and earn badges', color: '#4ECDC4' },
                  { icon: Sparkles, title: 'Weekly Challenges', desc: 'Complete challenges to earn XP and rewards', color: '#E2B05E' },
                  { icon: Bell, title: 'Stay Updated', desc: 'Get notified about goal progress and reminders', color: '#667eea' },
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 p-4 clay-card"
                  >
                    <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0" style={{ color: item.color }}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                      <p className="text-xs opacity-40 mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  if ('Notification' in window) {
                    Notification.requestPermission();
                  }
                }}
                className="w-full py-4 clay-card flex items-center justify-center gap-3 text-sm font-bold opacity-60 hover:opacity-100 transition-colors"
              >
                <Bell size={20} />
                Enable Push Notifications
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-4">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="w-16 h-16 clay-card flex items-center justify-center opacity-40 hover:opacity-100 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <button 
          onClick={handleNext}
          className="flex-1 h-16 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg text-white"
        >
          {step === 3 ? 'Get Started' : 'Continue'}
          <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
}

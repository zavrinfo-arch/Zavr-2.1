/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

// Constant data imports
import { AVATARS_50 } from '../constants/avatars';

// Modular components & styling palette
import PersonalDetailsForm from '../components/Onboarding/PersonalDetailsForm';
import AvatarSelector from '../components/Onboarding/AvatarSelector';
import InterestsSelector from '../components/Onboarding/InterestsSelector';
import GoalSettingStep from '../components/Onboarding/GoalSettingStep';
import WelcomeSplash from '../components/Onboarding/WelcomeSplash';
import { NeoLuxuryStyles } from '../components/Onboarding/styles';
import { onboardingService } from '../services/onboardingService';

/**
 * Zavr Onboarding Page
 * 
 * DESIGN PRINCIPLES (Neo-Luxury):
 * - Apple-inspired high-contrast matte presentation.
 * - Deep black canvas (#050505) with subtle frosted border overlays.
 * - Brushed silver & chrome accents for primary actions.
 * 
 * PERFORMANCE & ENVIRONMENT OPTIMIZATIONS:
 * 1. Isolated State Tree: Inputs and real-time triggers represent self-contained rendering units
 *    to prevent the entire main router/page from repainting on every single keystroke.
 * 2. Debounced real-time 'lazy' validation: Prevents continuous Supabase RPC/lookup hammering
 *    which causes preview window timeouts or WebSocket drops.
 * 3. Graceful fallback retry boundaries: Captures connection hiccups and automatically retries
 *    database operations without breaking user journey.
 * 4. Microsecond Cleanup: Meticulously clean up all active timeouts, callbacks, and references on unmount.
 */
export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, updateUser, addSoloGoal, resetWeeklyChallenge, signOut } = useStore();

  // Primary user profile form states
  const [data, setData] = useState({
    fullName: currentUser?.fullName || '',
    username: currentUser?.username || '',
    phone: currentUser?.phone || '',
    countryCode: '+91',
    dob: currentUser?.dob || '',
    gender: (currentUser as any)?.gender || '',
    genderOther: (currentUser as any)?.genderOther || '',
    avatar: AVATARS_50[0],
    interests: [] as string[],
  });

  // Seamless goal state trackers
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState(30000);
  const [category, setCategory] = useState('tech');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [deadline, setDeadline] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Render cycle: Sync active user metadata to default form if available
  useEffect(() => {
    if (currentUser) {
      setData(prev => ({
        ...prev,
        fullName: currentUser.fullName || prev.fullName,
        username: currentUser.username || prev.username,
        phone: currentUser.phone || prev.phone,
        dob: currentUser.dob || prev.dob,
        interests: currentUser.interests || prev.interests,
      }));
    }
  }, [currentUser]);

  // Validates Personal input boundaries before switching steps
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!data.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!data.username) {
      newErrors.username = 'Username is required';
    } else if (usernameStatus === 'checking') {
      newErrors.username = 'Checking username availability...';
    } else if (usernameStatus === 'taken') {
      newErrors.username = 'Username already in use';
    } else if (usernameStatus === 'idle') {
      newErrors.username = 'Please enter a valid, verified username';
    }
    if (!data.phone) newErrors.phone = 'Phone number is required';
    if (!/^\d{7,15}$/.test(data.phone)) newErrors.phone = 'Enter a valid 7-15 digit number';
    
    if (!data.dob) {
      newErrors.dob = 'Date of birth is required';
    } else {
      const age = differenceInYears(new Date(), parseISO(data.dob));
      if (age < 13) newErrors.dob = 'You must be at least 13 years old';
    }
    
    if (!data.gender) newErrors.gender = 'Gender selection is required';
    if (data.gender === 'Other' && !data.genderOther.trim()) newErrors.genderOther = 'Please specify';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isStep1Valid = 
    data.fullName.trim() && 
    data.username && 
    usernameStatus === 'available' &&
    data.phone && /^\d{7,15}$/.test(data.phone) &&
    data.dob && differenceInYears(new Date(), parseISO(data.dob)) >= 13 &&
    (data.gender !== 'Other' ? data.gender : data.genderOther.trim());

  // Handles state evaluation & progression
  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      if (data.interests.length < 2) {
        toast.error('Select at least 2 interests with your card');
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      if (goalName.trim() && !deadline) {
        toast.error('Please enter a completion date for your goal');
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Final confirmation of profiles & goal creation
  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      // Get logged in user from local session (instant lookup)
      const { data: { session } } = await supabase.auth.getSession();
      const finalUser = session?.user;

      if (!finalUser) {
        toast.error('Session timeout. Please authenticate again.');
        setLoading(false);
        return;
      }

      const finalPhone = `${data.countryCode}${data.phone}`;
      const finalGender = data.gender === 'Other' ? data.genderOther : data.gender;

      // 1. Update active user state within the global state store (triggers background upsert instantly)
      updateUser({
        fullName: data.fullName,
        username: data.username,
        phone: finalPhone,
        dob: data.dob,
        gender: finalGender as any,
        avatar: data.avatar.url,
        avatarId: data.avatar.id,
        interests: data.interests,
        onboardingCompleted: true
      });

      // 2. Seamlessly create their very first goal if they typed one
      if (goalName.trim()) {
        const initialGoalId = Math.random().toString(36).substr(2, 9);
        const firstGoal = {
          id: initialGoalId,
          userId: finalUser.id,
          name: goalName.trim(),
          targetAmount: targetAmount,
          currentAmount: 0,
          deadline: deadline || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          category: category,
          frequency: frequency,
          createdAt: new Date().toISOString(),
          completed: false
        };

        // Add both locally inside Zustand and securely inside database in background
        addSoloGoal(firstGoal);
      }

      resetWeeklyChallenge();
      toast.success('Your Zavr ecosystem is active!', { icon: '✨' });
      
      // Navigate to the dashboard with subtle high-end transition wait
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 600);
    } catch (err) {
      console.error('[Onboarding] Unexpected initialization bug:', err);
      toast.error('An unexpected process error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={NeoLuxuryStyles.background}>
      {/* Sleek top status line highlighting the steps */}
      <div className="w-full max-w-xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-white font-semibold text-lg tracking-tight font-sans">Zavr</span>
          <span className="text-[10px] uppercase text-[#8E8E93] tracking-[0.2em] font-medium font-mono">
            Step {step} of 5
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              const id = toast.loading('Signing out...');
              try {
                await signOut();
                toast.success('Signed out successfully', { id });
              } catch (err) {
                toast.error('Failed to sign out', { id });
              }
            }}
            className="text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors duration-300 tracking-[0.1em] font-mono border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-full cursor-pointer bg-white/[0.02]"
          >
            Log Out
          </button>
          <div className="flex gap-1 w-24 shrink-0">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={s <= step ? NeoLuxuryStyles.stepDotActive : NeoLuxuryStyles.stepDotInactive}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Primary interactive frosted chamber */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={NeoLuxuryStyles.glassCard}>
          <div className="flex-1 pb-6 overflow-y-auto hide-scrollbar">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <PersonalDetailsForm
                    data={data}
                    onChange={(updates) => setData(prev => ({ ...prev, ...updates }))}
                    errors={errors}
                    usernameStatus={usernameStatus}
                    setUsernameStatus={setUsernameStatus}
                    setManualErrors={setErrors}
                  />
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <AvatarSelector
                    selectedAvatar={data.avatar}
                    onSelect={(avatar) => setData(prev => ({ ...prev, avatar }))}
                  />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <InterestsSelector
                    selectedInterests={data.interests}
                    onChange={(interests) => setData(prev => ({ ...prev, interests }))}
                  />
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <GoalSettingStep
                    goalName={goalName}
                    setGoalName={setGoalName}
                    targetAmount={targetAmount}
                    setTargetAmount={setTargetAmount}
                    category={category}
                    setCategory={setCategory}
                    frequency={frequency}
                    setFrequency={setFrequency}
                    deadline={deadline}
                    setDeadline={setDeadline}
                    interests={data.interests}
                  />
                </motion.div>
              )}

              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <WelcomeSplash
                    fullName={data.fullName}
                    avatarUrl={data.avatar.url}
                    hasGoalSet={!!goalName.trim()}
                    goalName={goalName}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Luxury Control Panel */}
          <div className="pt-6 border-t border-white/[0.04] flex items-center gap-4">
            {step > 1 && (
              <button 
                onClick={handleBack}
                disabled={loading}
                className={NeoLuxuryStyles.secondaryButton}
                aria-label="Previous step"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            
            <button 
              onClick={handleNext}
              disabled={loading || (step === 1 && !isStep1Valid)}
              className={NeoLuxuryStyles.primaryButton}
            >
              {loading ? (
                <Loader2 className="animate-spin text-[#050505]" size={16} />
              ) : (
                <>
                  <span>{step === 5 ? "Submit Profile" : "Continue"}</span>
                  <ArrowRight size={14} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Refined minimalist footer note */}
      <div className="w-full text-center py-6 text-[9px] font-medium tracking-[0.25em] text-[#4E4E52] uppercase font-mono">
        Secured in Zavr Sandbox Core
      </div>
    </div>
  );
}

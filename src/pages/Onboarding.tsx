/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { 
  ArrowRight, ArrowLeft, Loader2, Plane, Laptop, Home, 
  GraduationCap, Heart, ShieldAlert, ShoppingBag, TrendingUp, 
  Check, Calendar, Phone, User, CheckCircle2, Sparkles, 
  Trophy, Users, Landmark, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

// Constant data imports
import { AVATARS_50, getAvatarUrl } from '../constants/avatars';
import { NeoLuxuryStyles } from '../components/Onboarding/styles';

const SAVING_CATEGORIES_LIST = [
  { id: 'Travel', label: 'Travel', icon: Plane, description: 'Flights, hotels, and adventures' },
  { id: 'Tech', label: 'Tech', icon: Laptop, description: 'Gadgets, setups, and future gear' },
  { id: 'Home', label: 'Home', icon: Home, description: 'Rent, furniture, and cozy design' },
  { id: 'Education', label: 'Education', icon: GraduationCap, description: 'Courses, books, and career leaps' },
  { id: 'Health', label: 'Health', icon: Heart, description: 'Medical, fitness, and wellness care' },
  { id: 'Emergency', label: 'Emergency', icon: ShieldAlert, description: 'Rainy day funds and safety nets' },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, description: 'Fashion, lifestyle, and gifts' },
  { id: 'Investment', label: 'Investment', icon: TrendingUp, description: 'Stocks, crypto, and compounding wealth' },
];

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', description: 'Identify as male' },
  { id: 'female', label: 'Female', description: 'Identify as female' },
  { id: 'non_binary', label: 'Non-Binary', description: 'Identify as non-binary' },
  { id: 'prefer_not_to_say', label: 'Prefer Not To Say', description: 'Keep selection private' },
  { id: 'other', label: 'Other', description: 'Other gender identifier' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, updateUser, signOut } = useStore();

  const getSanitizedGender = (rawGender: string | undefined): string => {
    if (!rawGender) return 'prefer_not_to_say';
    const clean = rawGender.toLowerCase().trim().replace(/[- ]/g, '_');
    const isValid = GENDER_OPTIONS.some(opt => opt.id === clean);
    return isValid ? clean : 'prefer_not_to_say';
  };

  // Step 1: Personal Details State
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [dob, setDob] = useState(currentUser?.dob || '');
  const [gender, setGender] = useState(() => getSanitizedGender(currentUser?.gender));

  // Username validation state
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string>('');

  // Step 2: Avatar Selection State
  const [selectedAvatar, setSelectedAvatar] = useState(
    AVATARS_50.find(a => a.id === currentUser?.avatarId || a.image === currentUser?.avatar || a.url === currentUser?.avatar) || AVATARS_50[0]
  );

  // Step 3: Saving Categories State
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    (currentUser as any)?.savingCategories || []
  );

  // Sync initial user details if loaded late
  useEffect(() => {
    if (currentUser) {
      if (!fullName) setFullName(currentUser.fullName || '');
      if (!username) setUsername(currentUser.username || '');
      if (!phone) setPhone(currentUser.phone || '');
      if (!dob) setDob(currentUser.dob || '');
      if (!gender || gender === 'prefer_not_to_say') {
        const synced = getSanitizedGender(currentUser.gender);
        setGender(synced);
      }
      if (!selectedAvatar && currentUser.avatar) {
        setSelectedAvatar(AVATARS_50.find(a => a.url === currentUser.avatar) || null);
      }
      if (selectedCategories.length === 0 && (currentUser as any)?.savingCategories?.length) {
        setSelectedCategories((currentUser as any).savingCategories);
      }
    }
  }, [currentUser]);

  // Real-time username debounce check
  useEffect(() => {
    if (!username) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    
    if (cleanUsername.length < 4) {
      setUsernameAvailable(false);
      setUsernameError('Username must be at least 4 characters');
      return;
    }
    
    if (cleanUsername.length > 20) {
      setUsernameAvailable(false);
      setUsernameError('Username must not exceed 20 characters');
      return;
    }

    const validRegex = /^[a-z0-9_]+$/;
    if (!validRegex.test(cleanUsername)) {
      setUsernameAvailable(false);
      setUsernameError('Letters, numbers, and underscores only');
      return;
    }

    // If username is unchanged from their current one, it is instantly available
    if (currentUser?.username && cleanUsername === currentUser.username.toLowerCase()) {
      setUsernameAvailable(true);
      setUsernameError('');
      return;
    }

    setUsernameError('');
    setUsernameCheckLoading(true);

    const timeoutId = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('username', cleanUsername);

        const exists = data && data.length > 0 && data[0].id !== currentUser?.id;
        
        if (exists) {
          setUsernameAvailable(false);
          setUsernameError('Username is already taken');
        } else {
          setUsernameAvailable(true);
          setUsernameError('');
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setUsernameCheckLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [username, currentUser]);

  // Handle flow transitions with validation
  const handleNext = () => {
    if (step === 1) {
      if (!fullName || fullName.trim().length < 3) {
        toast.error('Preferred display name must be at least 3 characters');
        return;
      }
      if (!username || username.trim().length < 4) {
        toast.error('Username must be at least 4 characters');
        return;
      }
      if (usernameAvailable === false) {
        toast.error(usernameError || 'Please choose an available username');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedAvatar) {
        toast.error('Choose an identity avatar to continue');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (selectedCategories.length < 2) {
        toast.error('Select at least 2 saving categories');
        return;
      }
      if (selectedCategories.length > 5) {
        toast.error('Select at most 5 saving categories');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      handleFinish();
    }
  };

  const handleGenderKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % GENDER_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + GENDER_OPTIONS.length) % GENDER_OPTIONS.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setGender(GENDER_OPTIONS[index].id);
      return;
    } else {
      return;
    }

    const nextBtn = document.getElementById(`gender-opt-${GENDER_OPTIONS[nextIndex].id}`);
    if (nextBtn) {
      (nextBtn as HTMLElement).focus();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Toggle saving categories selection
  const handleToggleCategory = (catId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) {
        return prev.filter(c => c !== catId);
      } else {
        if (prev.length >= 5) {
          toast.error('You can select a maximum of 5 categories');
          return prev;
        }
        return [...prev, catId];
      }
    });
  };

  // Final confirmation to database
  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const finalUser = session?.user;

      if (!finalUser) {
        toast.error('Session timeout. Please sign in again.');
        setLoading(false);
        return;
      }

      const updatesBlob = {
        fullName: fullName.trim(),
        username: username.toLowerCase().trim(),
        phone: phone.trim() || '',
        dob: dob || '',
        gender: gender || '',
        avatar: selectedAvatar?.url || '',
        avatarId: selectedAvatar?.id || '1',
        savingCategories: selectedCategories,
        onboardingCompleted: true
      };

      console.log('[ONBOARDING] Saving full details payload:', updatesBlob);
      
      await updateUser(updatesBlob as any);
      
      toast.success('Your account is set up!', { icon: '✨' });

      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 500);

    } catch (err) {
      console.error('[Onboarding] Unexpected initialization exception:', err);
      toast.error('Failed to save your profile settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Validate step completion state to enable/disable navigation buttons
  const isContinueDisabled = () => {
    if (step === 1) {
      return (
        !fullName || 
        fullName.trim().length < 3 || 
        !username || 
        username.trim().length < 4 || 
        usernameAvailable !== true || 
        usernameCheckLoading
      );
    }
    if (step === 2) {
      return !selectedAvatar;
    }
    if (step === 3) {
      return selectedCategories.length < 2 || selectedCategories.length > 5;
    }
    return false;
  };

  return (
    <div className={NeoLuxuryStyles.background}>
      {/* Top Header Row detailing step and system logs */}
      <div className="w-full max-w-xl mx-auto px-6 pt-8 pb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-zinc-900 dark:text-white font-bold text-lg tracking-tight font-sans">ZAVR</span>
          <span className="text-[10px] uppercase text-zinc-500 dark:text-[#8E8E93] tracking-[0.2em] font-medium font-mono">
            STEP {step} OF 4
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              const id = toast.loading('Logging out...');
              try {
                await signOut();
                toast.success('Logged out successfully', { id });
              } catch (err) {
                toast.error('Failed to log out', { id });
              }
            }}
            className="text-[10px] uppercase font-bold text-zinc-500 dark:text-white/40 hover:text-zinc-800 dark:hover:text-white transition-colors duration-300 tracking-[0.1em] font-mono border border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/20 px-3 py-1.5 rounded-full cursor-pointer bg-black/[0.01] dark:bg-white/[0.02]"
          >
            Log Out
          </button>
          <div className="flex gap-1 w-20 shrink-0">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={s <= step ? NeoLuxuryStyles.stepDotActive : NeoLuxuryStyles.stepDotInactive}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main glass interactive card center */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={NeoLuxuryStyles.glassCard}>
          <div className="flex-1 pb-4 overflow-y-auto hide-scrollbar max-h-[58vh] md:max-h-[62vh] pr-1">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-left mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">Personal Details</h1>
                    <p className="text-xs text-zinc-500 dark:text-[#94A3B8] mt-1">Let us customize your financial environment.</p>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1.5 text-left">
                    <label className={NeoLuxuryStyles.label}>Full Name</label>
                    <div className={NeoLuxuryStyles.inputContainer}>
                      <User className="text-[#94A3B8] w-4 h-4 mr-3 shrink-0 transition-colors group-focus-within:text-[#FF6B6B]" />
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={NeoLuxuryStyles.input}
                      />
                    </div>
                    {fullName && fullName.trim().length < 3 && (
                      <p className="text-[10px] text-[#FF6B6B] ml-2">Must be at least 3 characters</p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="space-y-1.5 text-left">
                    <label className={NeoLuxuryStyles.label}>Unique Username</label>
                    <div className={cn(
                      NeoLuxuryStyles.inputContainer,
                      usernameAvailable === true && "border-emerald-500/40 focus-within:border-emerald-500/60",
                      usernameAvailable === false && "border-[#FF8A8A]/40 focus-within:border-[#FF6B6B]/60"
                    )}>
                      <span className="text-[#94A3B8] text-sm mr-1 select-none font-mono">@</span>
                      <input
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className={NeoLuxuryStyles.input}
                      />
                      {usernameCheckLoading && (
                        <Loader2 className="w-4 h-4 text-zinc-400 dark:text-white/50 animate-spin ml-2 shrink-0" />
                      )}
                      {usernameAvailable === true && !usernameCheckLoading && (
                        <Check className="w-4 h-4 text-emerald-400 ml-2 shrink-0" />
                      )}
                      {usernameAvailable === false && !usernameCheckLoading && (
                        <AlertCircle className="w-4 h-4 text-[#FF6B6B] ml-2 shrink-0" />
                      )}
                    </div>
                    {usernameError ? (
                      <p className="text-[10px] text-[#FF6B6B] ml-2">{usernameError}</p>
                    ) : usernameAvailable === true ? (
                      <p className="text-[10px] text-emerald-400 ml-2">Username is available</p>
                    ) : null}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5 text-left">
                    <label className={NeoLuxuryStyles.label}>Phone Number (Optional)</label>
                    <div className={NeoLuxuryStyles.inputContainer}>
                      <Phone className="text-[#94A3B8] w-4 h-4 mr-3 shrink-0" />
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={NeoLuxuryStyles.input}
                      />
                    </div>
                  </div>

                  {/* Date of Birth - Full width premium integration */}
                  <div className="space-y-1.5 text-left">
                    <label className={NeoLuxuryStyles.label}>Date of Birth</label>
                    <div className={NeoLuxuryStyles.inputContainer}>
                      <Calendar className="text-[#94A3B8] w-4 h-4 mr-3 shrink-0" />
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className={cn(NeoLuxuryStyles.input, "text-zinc-800 dark:text-white dark:[color-scheme:dark]")}
                      />
                    </div>
                  </div>

                  {/* Premium Gender Selection Card Grid */}
                  <div className="space-y-2.5 text-left">
                    <label className={NeoLuxuryStyles.label}>Gender Identity</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Gender Identity selection">
                      {GENDER_OPTIONS.map((opt, idx) => {
                        const isSelected = gender === opt.id;
                        return (
                          <motion.button
                             key={opt.id}
                             id={`gender-opt-${opt.id}`}
                             type="button"
                             role="radio"
                             aria-checked={isSelected}
                             tabIndex={0}
                             onClick={() => setGender(opt.id)}
                             onKeyDown={(e) => handleGenderKeyDown(e, idx)}
                             whileHover={{ scale: 1.01 }}
                             whileTap={{ scale: 0.98 }}
                             className={cn(
                               "flex flex-col text-left p-4 rounded-2xl border transition-all duration-300 relative select-none cursor-pointer group outline-none min-h-[48px] justify-center focus-visible:ring-2 focus-visible:ring-[#FF6B6B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
                               isSelected 
                                 ? "bg-[#FF6B6B]/5 dark:bg-gradient-to-r dark:from-[#FF6B6B]/15 dark:to-[#FF7C7C]/5 border-[#FF6B6B] text-zinc-900 dark:text-white shadow-sm dark:shadow-[rgba(255,107,107,0.15)]" 
                                 : "bg-white dark:bg-white/[0.01] border-black/[0.08] dark:border-white/[0.04] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.02] hover:dark:bg-white/[0.03] hover:border-black/[0.12] hover:dark:border-white/[0.12]"
                             )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-xs font-bold uppercase tracking-wider transition-colors duration-200",
                                  isSelected ? "text-zinc-950 dark:text-white" : "text-zinc-500 dark:text-[#94A3B8] group-hover:text-zinc-800 dark:group-hover:text-white"
                                )}>
                                  {opt.label}
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-[#64748B] leading-snug mt-0.5 group-hover:text-zinc-600 dark:group-hover:text-[#94A3B8] transition-colors duration-200">
                                  {opt.description}
                                </span>
                              </div>
                              <div className={cn(
                                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200",
                                isSelected 
                                  ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] border-[#FF6B6B] text-white shadow-[0_0_10px_rgba(255,107,107,0.5)]" 
                                  : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-[#111118] text-transparent group-hover:border-black/20 dark:group-hover:border-white/30"
                              )}>
                                {isSelected && <Check size={10} strokeWidth={3.5} />}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-left mb-4">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">Choose your avatar</h1>
                    <p className="text-xs text-zinc-500 dark:text-[#94A3B8] mt-1">Select an identity character that speaks to you.</p>
                  </div>

                  <div className="grid grid-cols-5 gap-3 max-h-[44vh] overflow-y-auto pr-1 hide-scrollbar">
                    {AVATARS_50.map((avatar) => {
                      const isSelected = selectedAvatar?.id === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar)}
                          className={cn(
                            "aspect-square rounded-2xl overflow-hidden border bg-black/[0.02] dark:bg-[#111118] border-black/[0.08] dark:border-white/[0.08] transition-all duration-300 relative group flex items-center justify-center p-1",
                            isSelected 
                              ? "border-[#FF6B6B] scale-105 shadow-[0_0_15px_rgba(255,107,107,0.4)]" 
                              : "border-black/[0.08] dark:border-white/[0.08] hover:border-[#FF8A8A]/40 hover:scale-102"
                          )}
                        >
                          <img 
                            src={avatar.image || avatar.url} 
                            alt={`Avatar ${avatar.id}`} 
                            className="w-full h-full object-contain rounded-full"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute inset-x-0 bottom-0 top-0 bg-black/20 flex items-center justify-center">
                              <div className="bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white p-1 rounded-full shadow-lg">
                                <Check size={10} strokeWidth={4} />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-left mb-4">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">What are you saving for?</h1>
                    <p className="text-xs text-zinc-500 dark:text-[#94A3B8] mt-1">Select 2 to 5 savings categories to build your core visual goals.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-[44vh] overflow-y-auto pr-1 hide-scrollbar">
                    {SAVING_CATEGORIES_LIST.map((cat) => {
                      const IconComponent = cat.icon;
                      const isSelected = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleToggleCategory(cat.id)}
                          className={cn(
                            "flex flex-col text-left p-4 rounded-2xl border transition-all duration-300 relative select-none cursor-pointer group outline-none",
                            isSelected 
                              ? "bg-[#FF6B6B]/5 dark:bg-gradient-to-r dark:from-[#FF6B6B]/15 dark:to-[#FF7C7C]/5 border-[#FF6B6B] text-zinc-900 dark:text-white shadow-sm dark:shadow-[rgba(255,107,107,0.15)]" 
                              : "bg-white dark:bg-white/[0.01] border-black/[0.08] dark:border-white/[0.04] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.02] hover:dark:bg-white/[0.03] hover:border-black/[0.12] hover:dark:border-white/[0.12]"
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-3">
                            <div className={cn(
                              "p-2.5 rounded-xl transition-all duration-300",
                              isSelected 
                                ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-[0_0_10px_rgba(255,107,107,0.3)]" 
                                : "bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-white/60 group-hover:bg-black/[0.08] dark:group-hover:bg-white/10"
                            )}>
                              <IconComponent size={14} />
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white flex items-center justify-center shadow-[0_0_8px_rgba(255,107,107,0.4)]">
                                <Check size={10} strokeWidth={3.5} />
                              </div>
                            )}
                          </div>
                          
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white mb-0.5">{cat.label}</span>
                          <span className="text-[10px] text-zinc-500 dark:text-[#94A3B8] leading-snug">{cat.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center justify-between px-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold text-[#FF6B6B] tracking-widest font-mono shadow-[0_0_8px_rgba(255,107,107,0.2)]">
                      Selected: {selectedCategories.length} / 5
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-[#64748B] uppercase font-bold tracking-widest font-mono">
                      Min 2 Required
                    </span>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 text-center"
                >
                  <div className="flex flex-col items-center justify-center my-4 relative">
                    <div className="absolute inset-0 bg-[#FF6B6B]/10 blur-2xl rounded-full scale-130 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full border-2 border-[#FF8A8A]/40 p-1 bg-black/[0.02] dark:bg-[#111118] shadow-[0_10px_35px_rgba(255,107,107,0.2)] overflow-hidden">
                      <img 
                        src={getAvatarUrl(selectedAvatar?.image || selectedAvatar?.url || selectedAvatar?.id, username || fullName || '1')}
                        alt="Selected Avatar" 
                        className="w-full h-full object-contain rounded-full"
                      />
                    </div>
                    <div className="mt-4">
                      <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
                        Welcome, {fullName}!
                      </h1>
                      <p className="text-xs text-[#FF6B6B] font-bold mt-1 font-mono">@ {username}</p>
                    </div>
                  </div>

                  {/* Feature Cards Showcase */}
                  <div className="space-y-3.5 text-left">
                    {/* Social Goal Card */}
                    <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.04] hover:border-[#FF8A8A]/20 transition-colors duration-300">
                      <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl shrink-0 mt-0.5">
                        <Users size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Social & Collaborative Goals</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8] mt-0.5 leading-relaxed">Save up with friends seamlessly. Launch split accounts, set targets, and support group quests with total ledger tracking.</p>
                      </div>
                    </div>

                    {/* Streak Milestones Card */}
                    <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.04] hover:border-[#FF8A8A]/20 transition-colors duration-300">
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl shrink-0 mt-0.5">
                        <Trophy size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Daily Streak Milestones</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8] mt-0.5 leading-relaxed">Consistently deposit to protect and grow saving streaks. Collect ultra-rare visual accomplishment badges as milestones.</p>
                      </div>
                    </div>

                    {/* Financial Splitting Card */}
                    <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.04] hover:border-[#FF8A8A]/20 transition-colors duration-300">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                        <Landmark size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Financial Splitting Circles</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8] mt-0.5 leading-relaxed">Ditch the awkward calculations. Instantly share dinner bills, rent splits or subscription micro-savings in secure circles.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Core Interactive Control Actions footer panel */}
          <div className="pt-5 border-t border-black/[0.06] dark:border-white/[0.04] flex items-center gap-4">
            {step > 1 && (
              <button 
                onClick={handleBack}
                disabled={loading}
                className={NeoLuxuryStyles.secondaryButton}
                aria-label="Navigate backwards"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            
            <button 
              onClick={handleNext}
              disabled={isContinueDisabled() || loading}
              className={cn(
                NeoLuxuryStyles.primaryButton,
                isContinueDisabled() && "opacity-30 cursor-not-allowed scale-100"
              )}
            >
              {loading ? (
                <Loader2 className="animate-spin text-[#050505]" size={16} />
              ) : (
                <>
                  <span>{step === 4 ? "Submit Profile" : "Continue"}</span>
                  <ArrowRight size={14} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer lock label */}
      <div className="w-full text-center py-4 text-[9px] font-medium tracking-[0.25em] text-[#4E4E52] uppercase font-mono">
        Secured in Zavr Sandbox Core
      </div>
    </div>
  );
}

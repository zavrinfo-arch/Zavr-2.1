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
  Check, ArrowRight, ArrowLeft, Target, 
  Sparkles, Bell, ShieldCheck, Zap, User as UserIcon,
  Smartphone, Calendar as CalendarIcon, UserCircle, AlertCircle, Loader2
} from 'lucide-react';
import { format, differenceInYears, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

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

const TAKEN_USERNAMES = ["admin", "user", "john_doe", "test123"];

const COUNTRY_CODES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'USA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, updateUser, resetWeeklyChallenge } = useStore();

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

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Username check logic
  useEffect(() => {
    if (!data.username) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
      setUsernameStatus('idle');
      setErrors(prev => ({ ...prev, username: 'Only letters, numbers and underscores allowed' }));
      return;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.username;
      return newErrors;
    });

    const timeout = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const { data: existing, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', data.username.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error('[Onboarding] Username check error:', error);
          // Fallback to mock logic if DB fails? Or just set available
          setUsernameStatus('available');
          return;
        }

        if (existing) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      } catch (err) {
        console.error('[Onboarding] Username check exception:', err);
        setUsernameStatus('available');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [data.username]);

  // General Validation
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!data.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!data.username) newErrors.username = 'Username is required';
    if (usernameStatus === 'taken') newErrors.username = 'Username already taken';
    if (!data.phone) newErrors.phone = 'Phone Number is required';
    if (!/^\d{7,15}$/.test(data.phone)) newErrors.phone = 'Enter a valid 7-15 digit number';
    
    if (!data.dob) {
      newErrors.dob = 'Date of Birth is required';
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

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (step === 2) {
      // Avatar is always selected by default
      setStep(3);
      return;
    }
    if (step === 3 && data.interests.length < 2) {
      toast.error('Select at least 2 interests');
      return;
    }
    if (step < 4) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      const updates = {
        fullName: data.fullName,
        username: data.username,
        phone: `${data.countryCode}${data.phone}`,
        dob: data.dob,
        gender: data.gender as any,
        genderOther: data.genderOther,
        avatar: data.avatar.url,
        avatarId: (data.avatar.id as any),
        interests: data.interests,
        onboardingCompleted: true,
      };

      await updateUser(updates);
      resetWeeklyChallenge();
      toast.success('Profile completed!', { icon: '✨' });
      
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 800);
    } catch (err) {
      console.error('[Onboarding] Error during finish:', err);
      toast.error('Failed to complete onboarding.');
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
    <div className="min-h-screen bg-background flex flex-col p-6 sm:p-8 overflow-hidden">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-12">
        {[1, 2, 3, 4].map((s) => (
          <div 
            key={s} 
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-700 ease-in-out",
              s <= step ? "bg-[#FF6B6B]" : "bg-foreground/5"
            )}
          />
        ))}
      </div>

      <div className="flex-1 relative overflow-y-auto hide-scrollbar px-1">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="space-y-8 max-w-xl mx-auto"
            >
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2">Personal Details</h2>
                <p className="opacity-40 text-sm">Tell us a bit about yourself to get started</p>
              </div>

              <div className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Full Name</label>
                  <div className={cn(
                    "flex items-center clay-inset px-5 py-4 transition-all duration-300",
                    errors.fullName && "ring-2 ring-[#FF6B6B]/30"
                  )}>
                    <UserIcon size={18} className="opacity-20 mr-4" />
                    <input 
                      placeholder="e.g. John Wilson" 
                      className="bg-transparent outline-none flex-1 text-sm font-medium"
                      value={data.fullName}
                      onChange={e => setData({ ...data, fullName: e.target.value })}
                    />
                  </div>
                  {errors.fullName && <p className="text-[10px] text-[#FF6B6B] font-bold ml-4">{errors.fullName}</p>}
                </div>

                {/* Username with real-time feedback */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4 text-left block">Username</label>
                  <div className={cn(
                    "flex items-center clay-inset px-5 py-4 transition-all duration-300",
                    usernameStatus === 'taken' && "ring-2 ring-[#FF6B6B]/30",
                    usernameStatus === 'available' && "ring-2 ring-[#4ECDC4]/30"
                  )}>
                    <span className="text-sm opacity-20 font-bold mr-1">@</span>
                    <input 
                      placeholder="unique_username" 
                      className="bg-transparent outline-none flex-1 text-sm font-medium"
                      value={data.username}
                      onChange={e => setData({ ...data, username: e.target.value.toLowerCase().trim() })}
                    />
                    {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin opacity-40" />}
                    {usernameStatus === 'available' && <Check size={16} className="text-[#4ECDC4]" />}
                    {usernameStatus === 'taken' && <AlertCircle size={16} className="text-[#FF6B6B]" />}
                  </div>
                  <div className="flex justify-between px-4">
                    {errors.username && <p className="text-[10px] text-[#FF6B6B] font-bold">{errors.username}</p>}
                    {usernameStatus === 'available' && <p className="text-[10px] text-[#4ECDC4] font-bold">Username available</p>}
                    {usernameStatus === 'taken' && <p className="text-[10px] text-[#FF6B6B] font-bold">Already taken</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Phone Number */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Phone Number</label>
                    <div className="flex gap-2">
                      <select 
                        className="clay-inset p-3 text-xs font-bold outline-none bg-surface"
                        value={data.countryCode}
                        onChange={e => setData({ ...data, countryCode: e.target.value })}
                      >
                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                      </select>
                      <div className="flex-1 flex items-center clay-inset px-5 py-3">
                        <Smartphone size={16} className="opacity-20 mr-3" />
                        <input 
                          type="tel"
                          placeholder="Phone number" 
                          className="bg-transparent outline-none flex-1 text-sm font-medium"
                          value={data.phone}
                          onChange={e => setData({ ...data, phone: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                    </div>
                    {errors.phone && <p className="text-[10px] text-[#FF6B6B] font-bold ml-4">{errors.phone}</p>}
                  </div>

                  {/* DOB */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Date of Birth</label>
                    <div className="flex items-center clay-inset px-5 py-4">
                      <CalendarIcon size={18} className="opacity-20 mr-4" />
                      <input 
                        type="date"
                        className="bg-transparent outline-none flex-1 text-sm font-medium"
                        value={data.dob}
                        onChange={e => setData({ ...data, dob: e.target.value })}
                      />
                    </div>
                    {errors.dob && <p className="text-[10px] text-[#FF6B6B] font-bold ml-4">{errors.dob}</p>}
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Gender</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'].map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setData({ ...data, gender: g as any })}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[11px] font-bold transition-all duration-300",
                          data.gender === g ? "clay-coral text-white scale-105" : "clay-card opacity-60 hover:opacity-100"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {data.gender === 'Other' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <input 
                        placeholder="Please specify..." 
                        className="clay-inset w-full px-5 py-4 text-sm font-medium outline-none"
                        value={data.genderOther}
                        onChange={e => setData({ ...data, genderOther: e.target.value })}
                      />
                      {errors.genderOther && <p className="text-[10px] text-[#FF6B6B] font-bold ml-4">{errors.genderOther}</p>}
                    </motion.div>
                  )}
                  {errors.gender && <p className="text-[10px] text-[#FF6B6B] font-bold ml-4">{errors.gender}</p>}
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
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-black mb-2">Choose your avatar</h2>
                <p className="opacity-40">Pick a character that represents you</p>
              </div>
              <div id="avatar-grid" className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar pb-12">
                {AVATARS_50.map((avatar) => (
                  <motion.button
                    key={avatar.id}
                    whileHover={{ scale: 1.1, zIndex: 10 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setData({ ...data, avatar })}
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
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#FF6B6B] flex items-center justify-center shadow-lg border-2 border-white">
                        <Check className="text-white" size={10} strokeWidth={4} />
                      </div>
                    )}
                  </motion.button>
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
                <h2 className="text-3xl font-black mb-2">What are you saving for?</h2>
                <p className="opacity-40">Select 2-5 categories that interest you</p>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleInterest(cat.id)}
                    className={cn(
                      "p-6 rounded-3xl clay-card transition-all flex flex-col items-center justify-center gap-4 text-center",
                      data.interests.includes(cat.id) ? "ring-4 ring-[#4ECDC4] bg-[#4ECDC4]/5" : "grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                    )}
                  >
                    <span className="text-4xl transform scale-125 transition-transform group-hover:scale-150">{cat.icon}</span>
                    <span className="font-black text-xs uppercase tracking-widest">{cat.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                 <div className="w-24 h-24 mx-auto clay-card p-4 relative mb-6">
                    <img src={data.avatar.url} alt="Profile" className="w-full h-full object-contain" />
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full clay-teal text-white flex items-center justify-center shadow-lg ring-4 ring-background">
                       <Sparkles size={16} />
                    </div>
                 </div>
                <h2 className="text-3xl font-black mb-2">Welcome, {data.fullName.split(' ')[0]}!</h2>
                <p className="opacity-40">Your Zavr journey begins here</p>
              </div>
              <div className="grid gap-4 max-w-md mx-auto">
                {[
                  { icon: Target, title: 'Set Goals', desc: 'Create solo or group goals with friends', color: '#FF6B6B' },
                  { icon: Zap, title: 'Build Streaks', desc: 'Save daily to earn rewards', color: '#4ECDC4' },
                  { icon: UserCircle, title: 'Connect', desc: 'Save together with your circle', color: '#667eea' },
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 p-5 clay-card"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center shrink-0" style={{ color: item.color }}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-foreground">{item.title}</h4>
                      <p className="text-[11px] opacity-40 mt-1">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="mt-8 flex gap-4 max-w-xl mx-auto w-full">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            disabled={loading}
            className="w-16 h-16 clay-card flex items-center justify-center group"
          >
            <ArrowLeft size={24} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <button 
          onClick={handleNext}
          disabled={loading || (step === 1 && !isStep1Valid)}
          className={cn(
            "flex-1 h-16 rounded-[2rem] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95",
            (step === 1 && !isStep1Valid) || loading 
              ? "bg-foreground/10 opacity-30 cursor-not-allowed" 
              : "clay-coral text-white"
          )}
        >
          {loading ? <Loader2 className="animate-spin" /> : step === 4 ? 'Let\'s Go' : 'Continue'}
          {!loading && <ArrowRight size={24} />}
        </button>
      </div>
    </div>
  );
}

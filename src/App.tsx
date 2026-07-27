/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  X, Target, Users, UserPlus, 
  Calendar, CreditCard, ArrowRight, 
  ChevronRight, Lock, Hash, Clock,
  MinusCircle, ShieldAlert, MessageCircle, Bot, Loader2, Send
} from 'lucide-react';

import { useStore } from './store/useStore';
import { AuthProvider } from './context/AuthContext';
import { supabase, isConfigured } from './lib/supabaseClient';
import { Layout } from './components/Layout';
import { NetworkHealthMonitor } from './components/NetworkHealthMonitor';
import SplashScreen from './pages/SplashScreen';
import Auth from './pages/Auth';

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Home = lazy(() => import('./pages/Home'));
const Goals = lazy(() => import('./pages/Goals'));
const History = lazy(() => import('./pages/History'));
const Profile = lazy(() => import('./pages/Profile'));
const ZettlPage = lazy(() => import('./pages/Zettl'));
const ZettlChatList = lazy(() => import('./pages/ZettlChatList'));
const ZettlChatRoom = lazy(() => import('./pages/ZettlChatRoom'));
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeed'));
const AvatarSelection = lazy(() => import('./pages/AvatarSelection'));

import { ZettlProvider } from './context/ZettlContext';
import { formatCurrency, cn, formatDateSafely } from './lib/utils';
import toast from 'react-hot-toast';
import CelebrationModal from './components/CelebrationModal';
import { isAfter, startOfWeek, addDays, parseISO, differenceInDays, format } from 'date-fns';
import { MotionConfig } from 'motion/react';
import { isAIStudioPreview, shouldDisableHeavyFeatures, startKeepAliveHeartbeat, stopKeepAliveHeartbeat } from './utils/previewFix';
import PreviewBanner from './components/PreviewBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { initSilentSafeLogger } from './utils/debug';
import { useTheme } from './context/ThemeContext';
import { ConnectionStatus } from './components/ConnectionStatus';
import { supabaseRealtimeService } from './services/supabaseRealtime';
import { MobileViewportWrapper } from './components/MobileViewportWrapper';

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useStore((state) => state.currentUser);
  const session = useStore((state) => state.session);
  const isAuthLoading = useStore((state) => state.isAuthLoading);
  const location = useLocation();
  
  useEffect(() => {
    if (!isAuthLoading) {
      console.log('[GUARD] Route State:', {
        path: location.pathname,
        hasSession: !!session,
        hasUser: !!currentUser,
        onboardingCompleted: currentUser?.onboardingCompleted
      });
    }
  }, [location.pathname, isAuthLoading, session, currentUser]);
  
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 bg-coral/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-coral animate-spin relative z-10" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Loading Session...</p>
          </div>
        </div>
      </div>
    );
  }

  // 1. No session? Go to auth
  if (!session) {
    if (location.pathname === '/auth') return <>{children}</>;
    console.log('[GUARD] No session, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  if (location.pathname === '/auth') {
    if (currentUser && !currentUser.onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  // 2. Auth exists: check onboarding completion status
  if (currentUser) {
    const isCompleted = currentUser.onboardingCompleted;
    if (!isCompleted && location.pathname !== '/onboarding') {
      console.log('[GUARD] Onboarding not completed. Redirecting to /onboarding');
      return <Navigate to="/onboarding" replace />;
    }
    if (isCompleted && location.pathname === '/onboarding') {
      console.log('[GUARD] Onboarding already completed. Redirecting to /home');
      return <Navigate to="/home" replace />;
    }
  }

  return <>{children}</>;
}

function ConfigWarning() {
  if (isConfigured) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
      <ShieldAlert className="w-4 h-4" />
      <span>Supabase is not configured. Some features may not work. Please set your environment variables.</span>
    </div>
  );
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const storeTheme = useStore((state) => state.theme);
  const setStoreTheme = useStore((state) => state.setTheme);
  
  // Keep Zustand store and our context theme in sync
  useEffect(() => {
    if (theme !== storeTheme) {
      setStoreTheme(theme);
    }
  }, [theme, storeTheme, setStoreTheme]);

  const currentStreak = useStore((state) => state.streakData.currentStreak);
  const checkStreak = useStore((state) => state.checkStreak);
  const checkReminders = useStore((state) => state.checkReminders);
  const triggerMotivation = useStore((state) => state.triggerMotivation);
  const initializeAuth = useStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
    // Connect Supabase Realtime Service
    supabaseRealtimeService.connect();
    // Run preview safety optimizations
    initSilentSafeLogger();
    startKeepAliveHeartbeat();
    return () => {
      stopKeepAliveHeartbeat();
    };
  }, []);
  
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [plusAction, setPlusAction] = useState<'main' | 'solo' | 'group-create' | 'group-join' | 'contribute' | 'withdraw'>('main');
  const [selectedGoal, setSelectedGoal] = useState<{ id: string, type: 'solo' | 'group' | 'emergency' } | null>(null);
  const [initialAmount, setInitialAmount] = useState<string>('');
  
  const [celebration, setCelebration] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'streak' | 'goal';
    value?: string | number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'goal'
  });

  // Check streak and weekly challenge on load
  useEffect(() => {
    checkStreak();
    checkReminders();
    
    if (Math.random() < 0.2) {
      triggerMotivation();
    }
    
    // Global escape hatch for developers
    (window as any).forceOnboarding = () => {
      console.warn('[MANUAL] Forcing onboarding completion state...');
      useStore.getState().updateUser({ onboardingCompleted: true });
      window.location.href = '/home';
    };

    const interval = setInterval(() => {
      checkReminders();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Monitor for 100-day streak
  useEffect(() => {
    if (currentStreak === 100) {
      setCelebration({
        isOpen: true,
        title: 'Legendary Streak!',
        message: 'You have reached a 100-day saving streak! You are officially a Zavr Master.',
        type: 'streak',
        value: 100
      });
    }
  }, [currentStreak]);

  const handleAddMoney = (goalId: string, type: 'solo' | 'group' | 'emergency', amount?: number) => {
    setSelectedGoal({ id: goalId, type });
    setPlusAction('contribute');
    setInitialAmount(amount ? amount.toString() : '');
    setIsPlusModalOpen(true);
  };

  const handleWithdraw = (goalId: string, type: 'solo' | 'group' | 'emergency') => {
    setSelectedGoal({ id: goalId, type });
    setPlusAction('withdraw');
    setInitialAmount('');
    setIsPlusModalOpen(true);
  };

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion={shouldDisableHeavyFeatures() ? "always" : "user"}>
        <AuthProvider>
          <BrowserRouter>
            <MobileViewportWrapper>
              <PreviewBanner />
              <ZettlProvider>
                <NetworkHealthMonitor />
                <ConfigWarning />
                <ConnectionStatus className="max-w-md mx-auto my-2 px-4" />
            <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: 'bold',
              },
            }}
          />
          
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 bg-coral/20 blur-xl rounded-full animate-pulse" />
                  <Loader2 className="w-12 h-12 text-coral animate-spin relative z-10" />
                </div>
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Loading Page...</p>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/auth" element={<Auth />} />
              
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              <Route path="/avatar-selection" element={
                <ProtectedRoute>
                  <AvatarSelection />
                </ProtectedRoute>
              } />
              
              <Route path="/home" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <Home onAddMoney={handleAddMoney} onWithdraw={handleWithdraw} />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/goals" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <Goals onAddMoney={handleAddMoney} onWithdraw={handleWithdraw} />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/history" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <History />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/zettl" element={
                <ProtectedRoute>
                  <ZettlPage />
                </ProtectedRoute>
              } />

              <Route path="/zettl/chat/:friendId" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <ZettlChatRoom />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/zettl-activity" element={
                <ProtectedRoute>
                  <Layout onPlusClick={() => { setPlusAction('main'); setIsPlusModalOpen(true); }}>
                    <ActivityFeedPage />
                  </Layout>
                </ProtectedRoute>
              } />
              
              {/* Fallback route to catch white screens on invalid paths */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          <AnimatePresence>
            {isPlusModalOpen && (
              <PlusModal 
                action={plusAction}
                setAction={setPlusAction}
                onClose={() => { setIsPlusModalOpen(false); setPlusAction('main'); setSelectedGoal(null); setInitialAmount(''); }}
                selectedGoal={selectedGoal}
                initialAmount={initialAmount}
              />
            )}
          </AnimatePresence>

          <CelebrationModal 
            {...celebration}
            onClose={() => setCelebration(prev => ({ ...prev, isOpen: false }))}
          />
            </ZettlProvider>
            </MobileViewportWrapper>
          </BrowserRouter>
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

function FormattedAmountInput({
  label,
  value,
  onChange,
  currencySymbol = '$',
  quickChips = [500, 1000, 5000, 10000],
  placeholder = '0',
  autoFocus = false
}: {
  label: string;
  value: number | string;
  onChange: (numericVal: number, formattedStr: string) => void;
  currencySymbol?: string;
  quickChips?: number[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const formatValue = (val: number | string): string => {
    if (val === undefined || val === null || val === '') return '';
    const valStr = val.toString();
    if (valStr === '' || valStr === '.') return valStr;

    const clean = valStr.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const intPart = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-US') : '';
    if (parts.length > 1) {
      return `${intPart}.${parts[1].slice(0, 2)}`;
    }
    return intPart;
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatValue(value));

  useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    if (rawInput === '') {
      setDisplayValue('');
      onChange(0, '');
      return;
    }

    if (rawInput === '.' || rawInput.endsWith('.')) {
      const clean = rawInput.replace(/[^0-9.]/g, '');
      const parts = clean.split('.');
      if (parts.length <= 2) {
        setDisplayValue(clean);
        const num = parseFloat(clean) || 0;
        onChange(num, clean);
        return;
      }
    }

    const clean = rawInput.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) return;

    const num = parseFloat(clean);
    if (isNaN(num)) {
      setDisplayValue('');
      onChange(0, '');
      return;
    }

    const formatted = formatValue(clean);
    setDisplayValue(formatted);
    onChange(num, formatted);
  };

  const handleChipClick = (amount: number) => {
    const formatted = amount.toLocaleString('en-US');
    setDisplayValue(formatted);
    onChange(amount, formatted);
  };

  return (
    <div className="space-y-1.5 text-left">
      <div className="flex justify-between items-center ml-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60">
          {label}
        </label>
      </div>

      <div className="flex items-center clay-inset rounded-2xl px-4 py-3 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
        <span className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 mr-2 select-none">
          {currencySymbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="bg-transparent outline-none flex-1 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 tracking-tight"
          value={displayValue}
          onChange={handleInputChange}
        />
      </div>

      {quickChips && quickChips.length > 0 && (
        <div className="flex items-center gap-2 pt-1 overflow-x-auto hide-scrollbar">
          {quickChips.map((chipAmt) => (
            <button
              key={chipAmt}
              type="button"
              onClick={() => handleChipClick(chipAmt)}
              className="py-1.5 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:bg-purple-500/10 hover:border-purple-500/30 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 flex-shrink-0"
            >
              {currencySymbol}{chipAmt.toLocaleString('en-US')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlusModal({ action, setAction, onClose, selectedGoal, initialAmount }: any) {
  const { 
    currentUser, addSoloGoal, addGroupGoal, 
    joinGroupGoal, addContribution, withdrawMoney, soloGoals, groupGoals,
    addEmergencyGoal, emergencyGoals
  } = useStore();

  const userCurrencySymbol = currentUser?.preferences?.currency === 'INR' ? '₹' : currentUser?.preferences?.currency === 'EUR' ? '€' : '$';

  const [formData, setFormData] = useState({
    name: '',
    target: 1000,
    deadline: '',
    category: 'General',
    password: '',
    groupId: '',
    amount: initialAmount || '',
    frequency: 'monthly' as any,
    memberCount: 2,
    routineAmount: 100
  });

  const handleCreateEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('Please log in first');
    if (!formData.name.trim()) return toast.error('Please enter a goal name');
    const routineAmt = typeof formData.routineAmount === 'number' ? formData.routineAmount : parseInt(formData.routineAmount);
    if (!routineAmt || isNaN(routineAmt) || routineAmt <= 0) return toast.error('Please enter a valid routine amount');
    
    addEmergencyGoal({
      id: generateUUID(),
      userId: currentUser.id,
      name: formData.name.trim(),
      targetAmount: 0,
      currentAmount: 0,
      frequency: formData.frequency,
      routineAmount: routineAmt,
      createdAt: new Date().toISOString(),
      completed: false
    });
    
    toast.success('Emergency fund created!');
    onClose();
  };

  const calculateGoalMetrics = () => {
    const totalTarget = formData.target || 0;
    const memberCount = Math.max(1, formData.memberCount || 1);
    const perPersonTarget = action === 'group-create' ? totalTarget / memberCount : totalTarget;

    let daysLeft = 0;
    let hasDeadline = false;

    if (formData.deadline) {
      try {
        const parsed = parseISO(formData.deadline);
        if (!isNaN(parsed.getTime())) {
          daysLeft = Math.max(1, differenceInDays(parsed, new Date()));
          hasDeadline = true;
        }
      } catch (e) {
        daysLeft = 0;
      }
    }

    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));

    let periods = 1;
    if (hasDeadline && daysLeft > 0) {
      if (formData.frequency === 'daily') periods = daysLeft;
      else if (formData.frequency === 'weekly') periods = weeksLeft;
      else if (formData.frequency === 'monthly') periods = monthsLeft;
    } else {
      if (formData.frequency === 'daily') periods = 365;
      else if (formData.frequency === 'weekly') periods = 52;
      else if (formData.frequency === 'monthly') periods = 12;
    }

    const neededPerPeriod = (totalTarget > 0) 
      ? Math.ceil(perPersonTarget / Math.max(1, periods)) 
      : 0;

    // Real-time progress percentage ratio calculation
    const routineVal = formData.routineAmount || neededPerPeriod || 0;
    const progressRatio = totalTarget > 0 ? Math.min(100, Math.round((routineVal / totalTarget) * 100)) : 0;
    const estMonthsToTarget = routineVal > 0 && totalTarget > 0 ? Math.ceil(totalTarget / (formData.frequency === 'daily' ? routineVal * 30 : formData.frequency === 'weekly' ? routineVal * 4.33 : routineVal)) : 0;

    return {
      neededPerPeriod,
      daysLeft,
      weeksLeft,
      monthsLeft,
      periodsLeft: periods,
      perPersonTarget,
      hasDeadline,
      progressRatio,
      estMonthsToTarget
    };
  };

  const goalMetrics = calculateGoalMetrics();
  const neededPerPeriod = goalMetrics.neededPerPeriod;

  const handleCreateSolo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('Please log in first');
    if (!formData.name || !formData.target || formData.target <= 0) return toast.error('Please fill name and target amount');
    
    addSoloGoal({
      id: generateUUID(),
      userId: currentUser.id,
      name: formData.name,
      targetAmount: formData.target,
      currentAmount: 0,
      deadline: formData.deadline || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      category: formData.category,
      frequency: formData.frequency,
      createdAt: new Date().toISOString(),
      completed: false
    });
    
    toast.success('Solo goal created!');
    onClose();
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('Please log in first');
    if (!formData.name || !formData.target || formData.target <= 0) return toast.error('Please fill name and target amount');
    
    const groupId = `ZAVR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    addGroupGoal({
      id: generateUUID(),
      groupId,
      name: formData.name,
      targetAmount: formData.target,
      memberCount: formData.memberCount,
      password: formData.password,
      creatorId: currentUser.id,
      members: [{
        userId: currentUser.id,
        name: currentUser.fullName,
        avatar: currentUser.avatar,
        contributed: 0,
        joinedAt: new Date().toISOString()
      }],
      totalCollected: 0,
      createdAt: new Date().toISOString(),
      deadline: formData.deadline || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      frequency: formData.frequency,
      completed: false
    });
    
    toast.success(`Group goal created! ID: ${groupId}`);
    onClose();
  };

  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const res = joinGroupGoal(formData.groupId, formData.password);
    if (res.success) {
      toast.success(res.message);
      onClose();
    } else {
      toast.error(res.message);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = parseFloat(formData.amount.toString().replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return toast.error('Invalid amount');
    
    setIsSubmitting(true);
    try {
      await addContribution(selectedGoal.id, amount, selectedGoal.type);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6321', '#FF9E21', '#ffffff']
      });
      
      toast.success('Contribution added!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save contribution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = parseFloat(formData.amount.toString().replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return toast.error('Invalid amount');
    
    const goal = selectedGoal.type === 'solo' 
      ? soloGoals.find(g => g.id === selectedGoal.id)
      : selectedGoal.type === 'emergency'
      ? emergencyGoals.find(g => g.id === selectedGoal.id)
      : groupGoals.find(g => g.id === selectedGoal.id);

    if (!goal) return;

    if (selectedGoal.type === 'solo' || selectedGoal.type === 'emergency') {
      if ((goal as any).currentAmount < amount) return toast.error('Insufficient balance');
    } else {
      const member = (goal as any).members.find((m: any) => m.userId === currentUser?.id);
      if (!member || member.contributed < amount) return toast.error('Insufficient balance');
    }

    if (!showWithdrawConfirm) {
      setShowWithdrawConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await withdrawMoney(selectedGoal.id, amount, selectedGoal.type);
      toast.success('Withdrawal successful!');
      setShowWithdrawConfirm(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to withdraw money');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation state for Next / Submit buttons
  const isGoalFormValid = action === 'emergency' 
    ? (formData.name.trim().length > 0 && formData.routineAmount > 0)
    : (formData.name.trim().length > 0 && formData.target > 0);

  const isContributeValid = parseFloat(formData.amount.toString().replace(/,/g, '')) > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="relative w-full max-w-md clay rounded-t-[2.5rem] p-6 sm:p-8 pb-10 shadow-2xl border-t border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#111118] text-zinc-900 dark:text-white max-h-[90vh] overflow-y-auto hide-scrollbar"
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-white/20 rounded-full mx-auto mb-4 cursor-grab" />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {action === 'main' ? "What's next?" : 
               action === 'solo' ? 'Create Solo Goal' : 
               action === 'group-create' ? 'Create Group Goal' : 
               action === 'group-join' ? 'Join Group' : 
               action === 'emergency' ? 'Emergency Fund' :
               action === 'withdraw' ? 'Withdraw Money' : 'Add Money'}
            </h2>
            {action !== 'main' && (
              <p className="text-xs text-zinc-500 dark:text-[#94A3B8]/60 mt-0.5 font-medium">
                {action === 'solo' ? 'Set your target amount and saving frequency' : 
                 action === 'group-create' ? 'Set up a goal to save together with friends' : 
                 action === 'group-join' ? 'Enter a group ID to start contributing' : 'Enter amount and confirm'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-zinc-600 dark:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        {action === 'main' && (
          <div className="space-y-3 sm:space-y-3.5 my-2">
            <button 
              onClick={() => setAction('solo')}
              className="w-full p-4 sm:p-5 rounded-[1.25rem] bg-zinc-100/80 dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:bg-zinc-200/50 dark:hover:bg-[#1C1C26] cursor-pointer group transition-all flex items-center justify-between text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-[#0D0D12] border border-black/5 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Target size={22} className="text-[#FF6B6B] dark:text-[#FF7C7C]" />
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">Solo Goal</h4>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-[#94A3B8]/60 mt-0.5">Save for your personal dreams</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-200 transition-colors ml-2 flex-shrink-0" />
            </button>

            <button 
              onClick={() => setAction('group-create')}
              className="w-full p-4 sm:p-5 rounded-[1.25rem] bg-zinc-100/80 dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.08] hover:border-teal-500/50 dark:hover:border-teal-500/50 hover:bg-zinc-200/50 dark:hover:bg-[#1C1C26] cursor-pointer group transition-all flex items-center justify-between text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-[#0D0D12] border border-black/5 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Users size={22} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">Group Goal</h4>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-[#94A3B8]/60 mt-0.5">Collaborate and save with friends</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-200 transition-colors ml-2 flex-shrink-0" />
            </button>

            <button 
              onClick={() => setAction('group-join')}
              className="w-full p-4 sm:p-5 rounded-[1.25rem] bg-zinc-100/80 dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.08] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:bg-zinc-200/50 dark:hover:bg-[#1C1C26] cursor-pointer group transition-all flex items-center justify-between text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-[#0D0D12] border border-black/5 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <UserPlus size={22} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">Join Group</h4>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-[#94A3B8]/60 mt-0.5">Enter a group ID to join others</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-200 transition-colors ml-2 flex-shrink-0" />
            </button>

            <button 
              onClick={() => setAction('emergency')}
              className="w-full p-4 sm:p-5 rounded-[1.25rem] bg-zinc-100/80 dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.08] hover:border-amber-500/50 dark:hover:border-amber-500/50 hover:bg-zinc-200/50 dark:hover:bg-[#1C1C26] cursor-pointer group transition-all flex items-center justify-between text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-[#0D0D12] border border-black/5 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">Emergency Fund</h4>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-[#94A3B8]/60 mt-0.5">Save for unexpected needs</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-200 transition-colors ml-2 flex-shrink-0" />
            </button>
          </div>
        )}

        {(action === 'solo' || action === 'group-create' || action === 'emergency') && (
          <form onSubmit={action === 'emergency' ? handleCreateEmergency : (action === 'solo' ? handleCreateSolo : handleCreateGroup)} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Goal Name</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                <Target size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                <input 
                  autoFocus
                  placeholder={action === 'emergency' ? 'e.g. Rainy Day Fund' : 'e.g. New MacBook Pro'} 
                  className="bg-transparent outline-none flex-1 text-sm text-zinc-900 dark:text-white font-semibold placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            {action !== 'emergency' ? (
              <>
                <FormattedAmountInput
                  label="Target Amount"
                  value={formData.target}
                  currencySymbol={userCurrencySymbol}
                  quickChips={[500, 1000, 5000, 10000]}
                  onChange={(numericVal) => setFormData({ ...formData, target: numericVal })}
                />

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Target Deadline (Optional)</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                    <Calendar size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                    <input 
                      type="date"
                      className="bg-transparent outline-none flex-1 text-sm text-zinc-900 dark:text-white font-semibold dark:[color-scheme:dark]"
                      value={formData.deadline}
                      onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>
                  {formData.deadline && (
                    <p className="text-[10px] text-[#FF6B6B] font-bold uppercase tracking-widest ml-1">
                      Deadline Selected: {formatDateSafely(formData.deadline)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <FormattedAmountInput
                label="Monthly Contribution"
                value={formData.routineAmount}
                currencySymbol={userCurrencySymbol}
                quickChips={[100, 250, 500, 1000]}
                onChange={(numericVal) => setFormData({ ...formData, routineAmount: numericVal })}
              />
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Saving Routine</label>
              <div className="flex p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl">
                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFormData({ ...formData, frequency: freq })}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all capitalize",
                      formData.frequency === freq ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-md" : "text-zinc-500 dark:text-[#94A3B8]/60 hover:text-zinc-900 dark:hover:text-white font-medium"
                    )}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {action === 'group-create' && (
              <>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Planned Members Count</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                    <Users size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                    <input 
                      type="number"
                      min="2"
                      max="10"
                      className="bg-transparent outline-none flex-1 text-sm text-zinc-900 dark:text-white font-semibold"
                      value={formData.memberCount}
                      onChange={e => setFormData({ ...formData, memberCount: parseInt(e.target.value) || 2 })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Group Password (Optional)</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                    <Lock size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                    <input 
                      type="password"
                      placeholder="Set a password" 
                      className="bg-transparent outline-none flex-1 text-sm text-zinc-900 dark:text-white font-semibold placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Real-time progress and calculator card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="clay-inset p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60">Estimated Routine</p>
                  <p className="text-xl sm:text-2xl font-black mt-0.5 text-[#FF6B6B]">
                    {action === 'emergency' 
                      ? formatCurrency(formData.routineAmount, currentUser?.preferences?.currency)
                      : formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)}
                    <span className="text-[10px] font-bold ml-1 text-zinc-400">/{formData.frequency}</span>
                  </p>
                </div>
                {action !== 'emergency' && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60">
                      {action === 'group-create' ? 'Group Target' : 'Target Amount'}
                    </p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                      {formatCurrency(formData.target, currentUser?.preferences?.currency)}
                    </p>
                    {action === 'group-create' && (
                      <p className="text-[9px] font-bold text-teal-600 dark:text-teal-400 mt-0.5">
                        ({formatCurrency(goalMetrics.perPersonTarget, currentUser?.preferences?.currency)} / member)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Real-time progress bar indicator */}
              {action !== 'emergency' && formData.target > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                    <span>Routine Contribution Ratio</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">{goalMetrics.progressRatio}% of target / month</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 dark:bg-black/40 overflow-hidden border border-black/5 dark:border-white/5">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-[#FF6B6B] transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(5, goalMetrics.progressRatio))}%` }}
                    />
                  </div>
                </div>
              )}

              {action !== 'emergency' && goalMetrics.hasDeadline && (
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl text-center">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Days Left</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">{goalMetrics.daysLeft} Days</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Weeks Left</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">{goalMetrics.weeksLeft} Weeks</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8]/60">Months Left</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">{goalMetrics.monthsLeft} Months</p>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <p className="text-[10px] text-zinc-500 dark:text-[#94A3B8]/70 leading-relaxed">
                  {action === 'emergency'
                    ? `You will save this amount ${formData.frequency} to build your emergency fund.`
                    : goalMetrics.hasDeadline
                      ? `Target deadline in ${goalMetrics.daysLeft} days. Save ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency} to stay on track.`
                      : `Save ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency}. Select a deadline to calculate exact completion timeline.`}
                </p>
              </div>
            </motion.div>

            {/* Submit / Next Button - disabled until form is valid */}
            <button 
              type="submit"
              disabled={!isGoalFormValid}
              className="w-full py-4 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-2xl font-bold uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[rgba(255,107,107,0.35)] active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Create Goal <ArrowRight size={18} />
            </button>
          </form>
        )}

        {action === 'group-join' && (
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Group ID</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                <Hash size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                <input 
                  autoFocus
                  placeholder="ZAVR-XXXXXX" 
                  className="bg-transparent outline-none flex-1 text-sm uppercase text-zinc-900 dark:text-white font-semibold placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  value={formData.groupId}
                  onChange={e => setFormData({ ...formData, groupId: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#94A3B8]/60 ml-1">Password (Optional)</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-3.5 border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-black/[0.02] dark:bg-white/[0.02]">
                <Lock size={18} className="text-purple-500/70 dark:text-purple-400/70 mr-3" />
                <input 
                  type="password"
                  placeholder="••••••••" 
                  className="bg-transparent outline-none flex-1 text-sm text-zinc-900 dark:text-white font-semibold placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={!formData.groupId.trim()}
              className="w-full py-4 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-2xl font-bold uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[rgba(255,107,107,0.35)] active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Join Group <ArrowRight size={18} />
            </button>
          </form>
        )}

        {action === 'contribute' && (
          <form onSubmit={handleContribute} className="space-y-5">
            <div className="text-center space-y-1">
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Contributing to</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">
                {selectedGoal?.type === 'solo' 
                  ? soloGoals.find(g => g.id === selectedGoal.id)?.name 
                  : selectedGoal?.type === 'emergency'
                  ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name
                  : groupGoals.find(g => g.id === selectedGoal.id)?.name}
              </h3>
            </div>

            <FormattedAmountInput
              label="Amount to add"
              value={formData.amount}
              currencySymbol={userCurrencySymbol}
              quickChips={[100, 500, 1000, 5000]}
              autoFocus
              onChange={(numericVal, formattedStr) => setFormData({ ...formData, amount: formattedStr })}
            />

            <button 
              type="submit"
              disabled={!isContributeValid}
              className="w-full py-4 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-2xl font-bold uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[rgba(255,107,107,0.35)] active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isContributeValid ? (
                <>Add {userCurrencySymbol}{Number(formData.amount.toString().replace(/,/g, '')).toLocaleString('en-US')} <ArrowRight size={18} /></>
              ) : (
                <>Confirm Contribution <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}

        {action === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-5">
            <AnimatePresence mode="wait">
              {!showWithdrawConfirm ? (
                <motion.div
                  key="withdraw-input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-2">
                      <MinusCircle size={28} />
                    </div>
                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest">Withdrawing from</p>
                    <h3 className="text-xl font-black text-foreground">
                      {selectedGoal?.type === 'solo' 
                        ? soloGoals.find(g => g.id === selectedGoal.id)?.name 
                        : selectedGoal?.type === 'emergency'
                        ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name
                        : groupGoals.find(g => g.id === selectedGoal.id)?.name}
                    </h3>
                  </div>

                  <FormattedAmountInput
                    label="Amount to withdraw"
                    value={formData.amount}
                    currencySymbol={userCurrencySymbol}
                    quickChips={[100, 500, 1000, 5000]}
                    autoFocus
                    onChange={(numericVal, formattedStr) => setFormData({ ...formData, amount: formattedStr })}
                  />

                  <button 
                    type="submit"
                    disabled={!isContributeValid}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Next <ArrowRight size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="withdraw-confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mx-auto animate-pulse">
                    <MinusCircle size={36} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black">Are you sure?</h3>
                    <p className="text-zinc-400 text-sm">
                      You are about to withdraw <span className="text-red-400 font-bold">{userCurrencySymbol}{formData.amount}</span> from <span className="font-bold text-foreground">{selectedGoal?.type === 'solo' ? soloGoals.find(g => g.id === selectedGoal.id)?.name : selectedGoal?.type === 'emergency' ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name : groupGoals.find(g => g.id === selectedGoal.id)?.name}</span>.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-2">
                    <button 
                      type="submit"
                      className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                    >
                      Yes, Withdraw Money
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowWithdrawConfirm(false)}
                      className="w-full py-3.5 clay-inset rounded-2xl font-bold text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </motion.div>
    </div>
  );
}

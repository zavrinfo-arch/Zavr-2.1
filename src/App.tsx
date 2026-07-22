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
            <PreviewBanner />
            <ZettlProvider>
              <NetworkHealthMonitor />
              <ConfigWarning />
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
          </BrowserRouter>
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

function PlusModal({ action, setAction, onClose, selectedGoal, initialAmount }: any) {
  const { 
    currentUser, addSoloGoal, addGroupGoal, 
    joinGroupGoal, addContribution, withdrawMoney, soloGoals, groupGoals,
    addEmergencyGoal, emergencyGoals
  } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    target: 1000,
    deadline: '',
    category: 'General',
    password: '',
    groupId: '',
    amount: initialAmount || '',
    frequency: 'weekly' as any,
    memberCount: 2,
    routineAmount: 100
  });

  const handleCreateEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('Please log in first');
    if (!formData.name || !formData.routineAmount) return toast.error('Fill all fields');
    
    addEmergencyGoal({
      id: generateUUID(),
      userId: currentUser.id,
      name: formData.name,
      targetAmount: formData.target,
      currentAmount: 0,
      frequency: formData.frequency,
      routineAmount: formData.routineAmount,
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

    return {
      neededPerPeriod,
      daysLeft,
      weeksLeft,
      monthsLeft,
      periodsLeft: periods,
      perPersonTarget,
      hasDeadline
    };
  };

  const goalMetrics = calculateGoalMetrics();
  const neededPerPeriod = goalMetrics.neededPerPeriod;

  const handleCreateSolo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('Please log in first');
    if (!formData.name || !formData.deadline) return toast.error('Fill all fields');
    
    addSoloGoal({
      id: generateUUID(),
      userId: currentUser.id,
      name: formData.name,
      targetAmount: formData.target,
      currentAmount: 0,
      deadline: formData.deadline,
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
    if (!formData.name || !formData.deadline) return toast.error('Fill all fields');
    
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
      deadline: formData.deadline,
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

    const amount = parseFloat(formData.amount);
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

    const amount = parseFloat(formData.amount);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
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
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md clay rounded-t-[3rem] p-8 pb-12 shadow-2xl border-t border-border"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">
            {action === 'main' ? 'What\'s next?' : 
             action === 'solo' ? 'Create Solo Goal' : 
             action === 'group-create' ? 'Create Group Goal' : 
             action === 'group-join' ? 'Join Group' : 'Add Money'}
          </h2>
          <button onClick={onClose} className="p-2 clay rounded-full">
            <X size={20} />
          </button>
        </div>

        {action === 'main' && (
          <div className="space-y-4">
            <button 
              onClick={() => setAction('solo')}
              className="w-full p-6 clay-card rounded-3xl flex items-center justify-between group hover:bg-foreground/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl clay-inset flex items-center justify-center text-[#FF6B6B]">
                  <Target size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">Solo Goal</h4>
                  <p className="text-xs opacity-40">Save for your personal dreams</p>
                </div>
              </div>
              <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </button>

            <button 
              onClick={() => setAction('group-create')}
              className="w-full p-6 clay-card rounded-3xl flex items-center justify-between group hover:bg-foreground/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl clay-inset flex items-center justify-center text-[#4ECDC4]">
                  <Users size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">Group Goal</h4>
                  <p className="text-xs opacity-40">Collaborate and save with friends</p>
                </div>
              </div>
              <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </button>

            <button 
              onClick={() => setAction('group-join')}
              className="w-full p-6 clay-card rounded-3xl flex items-center justify-between group hover:bg-foreground/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl clay-inset flex items-center justify-center text-emerald-500">
                  <UserPlus size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">Join Group</h4>
                  <p className="text-xs opacity-40">Enter a group ID to join others</p>
                </div>
              </div>
              <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </button>

            <button 
              onClick={() => setAction('emergency')}
              className="w-full p-6 clay-card rounded-3xl flex items-center justify-between group hover:bg-foreground/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl clay-inset flex items-center justify-center text-amber-500">
                  <ShieldAlert size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">Emergency Fund</h4>
                  <p className="text-xs opacity-40">Save for unexpected needs</p>
                </div>
              </div>
              <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}

        {(action === 'solo' || action === 'group-create' || action === 'emergency') && (
          <form onSubmit={action === 'emergency' ? handleCreateEmergency : (action === 'solo' ? handleCreateSolo : handleCreateGroup)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Goal Name</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                <Target size={20} className="opacity-20 mr-3" />
                <input 
                  autoFocus
                  placeholder={action === 'emergency' ? 'e.g. Rainy Day Fund' : 'e.g. New MacBook Pro'} 
                  className="bg-transparent outline-none flex-1 text-sm text-foreground"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className={cn("space-y-2", action === 'emergency' ? "col-span-2" : "col-span-1")}>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Target Amount</label>
                <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                  <CreditCard size={20} className="opacity-20 mr-3" />
                  <input 
                    type="number"
                    placeholder="1000" 
                    className="bg-transparent outline-none flex-1 text-sm text-foreground"
                    value={formData.target}
                    onChange={e => setFormData({ ...formData, target: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              {action !== 'emergency' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Deadline</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                    <Calendar size={20} className="opacity-20 mr-3" />
                    <input 
                      type="date"
                      className="bg-transparent outline-none flex-1 text-sm text-foreground"
                      value={formData.deadline}
                      onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>
                  {formData.deadline && (
                    <p className="text-[10px] text-[#FF6B6B] font-black uppercase tracking-widest ml-4">
                      Deadline Selected: {formatDateSafely(formData.deadline)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={cn("space-y-2", action === 'emergency' ? "col-span-1" : "col-span-2")}>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Saving Routine</label>
                <div className="flex p-1 clay-inset rounded-2xl shadow-none">
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFormData({ ...formData, frequency: freq })}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold transition-all capitalize",
                        formData.frequency === freq ? "clay-coral text-white" : "opacity-40"
                      )}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
              {action === 'emergency' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Routine Amount</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                    <CreditCard size={20} className="opacity-20 mr-3" />
                    <input 
                      type="number"
                      placeholder="100" 
                      className="bg-transparent outline-none flex-1 text-sm text-foreground"
                      value={formData.routineAmount}
                      onChange={e => setFormData({ ...formData, routineAmount: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              {action === 'group-create' && (
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Planned Members Count</label>
                  <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                    <Users size={20} className="opacity-20 mr-3" />
                    <input 
                      type="number"
                      min="2"
                      max="10"
                      className="bg-transparent outline-none flex-1 text-sm text-foreground"
                      value={formData.memberCount}
                      onChange={e => setFormData({ ...formData, memberCount: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>

            {action === 'group-create' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Group Password (Optional)</label>
                <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                  <Lock size={20} className="opacity-20 mr-3" />
                  <input 
                    type="password"
                    placeholder="Set a password" 
                    className="bg-transparent outline-none flex-1 text-sm text-foreground"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="clay-inset p-5 rounded-2xl bg-surface border border-border space-y-4"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Estimated Routine</p>
                  <p className="text-2xl font-black mt-1 text-[#FF6B6B]">
                    {action === 'emergency' 
                      ? formatCurrency(formData.routineAmount, currentUser?.preferences?.currency)
                      : formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)}
                    <span className="text-[10px] font-bold ml-1 opacity-40">/{formData.frequency}</span>
                  </p>
                </div>
                {action !== 'emergency' && (
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                      {action === 'group-create' ? 'Group Target' : 'Target'}
                    </p>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      {formatCurrency(formData.target, currentUser?.preferences?.currency)}
                    </p>
                    {action === 'group-create' && (
                      <p className="text-[9px] font-bold text-[#4ECDC4] mt-0.5">
                        ({formatCurrency(goalMetrics.perPersonTarget, currentUser?.preferences?.currency)} / member)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {action !== 'emergency' && goalMetrics.hasDeadline && (
                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-black/[0.02] dark:bg-white/[0.02] border border-border/50 rounded-xl text-center">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-wider opacity-40">Days Left</p>
                    <p className="text-xs font-black text-foreground mt-0.5">{goalMetrics.daysLeft} Days</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-wider opacity-40">Weeks Left</p>
                    <p className="text-xs font-black text-foreground mt-0.5">{goalMetrics.weeksLeft} Weeks</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-wider opacity-40">Months Left</p>
                    <p className="text-xs font-black text-foreground mt-0.5">{goalMetrics.monthsLeft} Months</p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <p className="text-[9px] opacity-60 leading-relaxed">
                  {action === 'emergency'
                    ? `You will save this amount ${formData.frequency} to build your emergency fund. There is no fixed target, save as much as you need.`
                    : action === 'group-create' 
                    ? goalMetrics.hasDeadline
                      ? `Target deadline in ${goalMetrics.daysLeft} days (${goalMetrics.periodsLeft} ${formData.frequency} cycles) by ${formatDateSafely(formData.deadline)}. Each of the ${formData.memberCount || 1} members contributes ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency}.`
                      : `Each of the ${formData.memberCount || 1} members needs to contribute ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency}. Select a deadline to calculate exact completion days.`
                    : goalMetrics.hasDeadline
                      ? `Target deadline in ${goalMetrics.daysLeft} days (${goalMetrics.periodsLeft} ${formData.frequency} cycles) by ${formatDateSafely(formData.deadline)}. Save ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency}.`
                      : `You need to save ${formatCurrency(neededPerPeriod, currentUser?.preferences?.currency)} per ${formData.frequency}. Select a deadline date to calculate exact completion days.`}
                </p>
              </div>
            </motion.div>

            <button 
              type="submit"
              className="w-full py-5 clay-coral text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm flex items-center justify-center gap-3 mt-4 shadow-2xl active:scale-95 transition-all"
            >
              Create Goal <ArrowRight size={20} />
            </button>
          </form>
        )}

        {action === 'group-join' && (
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Group ID</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                <Hash size={20} className="opacity-20 mr-3" />
                <input 
                  autoFocus
                  placeholder="ZAVR-XXXXXX" 
                  className="bg-transparent outline-none flex-1 text-sm uppercase text-foreground"
                  value={formData.groupId}
                  onChange={e => setFormData({ ...formData, groupId: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Password (If any)</label>
              <div className="flex items-center clay-inset rounded-2xl px-4 py-4">
                <Lock size={20} className="opacity-20 mr-3" />
                <input 
                  type="password"
                  placeholder="••••••••" 
                  className="bg-transparent outline-none flex-1 text-sm text-foreground"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-4 clay-teal text-black rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition-all"
            >
              Join Group <ArrowRight size={20} />
            </button>
          </form>
        )}

        {action === 'contribute' && (
          <form onSubmit={handleContribute} className="space-y-6">
            <div className="text-center space-y-2">
              <p className="opacity-40 text-xs font-bold uppercase tracking-widest">Contributing to</p>
              <h3 className="text-2xl font-black">
                {selectedGoal.type === 'solo' 
                  ? soloGoals.find(g => g.id === selectedGoal.id)?.name 
                  : selectedGoal.type === 'emergency'
                  ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name
                  : groupGoals.find(g => g.id === selectedGoal.id)?.name}
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Amount to add</label>
              <div className="flex items-center clay-inset rounded-3xl px-8 py-8">
                <span className="text-4xl font-black mr-4 opacity-20">₹</span>
                <input 
                  autoFocus
                  type="number"
                  placeholder="0" 
                  className="bg-transparent outline-none flex-1 text-5xl font-black"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[100, 500, 1000].map(val => (
                <button 
                  key={val}
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: val.toString() })}
                  className="py-3 clay-card rounded-xl text-xs font-bold hover:bg-foreground/5 transition-colors"
                >
                  +₹{val}
                </button>
              ))}
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] hover:from-[#FF6B6B] hover:to-[#FF7C7C] text-white rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[rgba(255,107,107,0.35)] hover:shadow-[rgba(255,107,107,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
            >
              {formData.amount && Number(formData.amount) > 0 ? (
                <>ADD ₹{Number(formData.amount).toLocaleString('en-IN')} <ArrowRight size={20} /></>
              ) : (
                <>Confirm Contribution <ArrowRight size={20} /></>
              )}
            </button>
          </form>
        )}

        {action === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-6">
            <AnimatePresence mode="wait">
              {!showWithdrawConfirm ? (
                <motion.div
                  key="withdraw-input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-4">
                      <MinusCircle size={32} />
                    </div>
                    <p className="opacity-40 text-xs font-bold uppercase tracking-widest text-red-500">Withdrawing from</p>
                    <h3 className="text-2xl font-black">
                      {selectedGoal.type === 'solo' 
                        ? soloGoals.find(g => g.id === selectedGoal.id)?.name 
                        : selectedGoal.type === 'emergency'
                        ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name
                        : groupGoals.find(g => g.id === selectedGoal.id)?.name}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-4">Amount to withdraw</label>
                    <div className="flex items-center clay-inset rounded-3xl px-8 py-8">
                      <span className="text-4xl font-black mr-4 opacity-20">₹</span>
                      <input 
                        autoFocus
                        type="number"
                        placeholder="0" 
                        className="bg-transparent outline-none flex-1 text-5xl font-black text-red-500"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[100, 500, 1000].map(val => (
                      <button 
                        key={val}
                        type="button"
                        onClick={() => setFormData({ ...formData, amount: val.toString() })}
                        className="py-3 clay-card rounded-xl text-xs font-bold hover:bg-foreground/5 transition-colors"
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 shadow-lg shadow-red-500/20"
                  >
                    Next <ArrowRight size={20} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="withdraw-confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mx-auto animate-pulse">
                      <MinusCircle size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black">Are you sure?</h3>
                      <p className="opacity-60 text-sm">
                        You are about to withdraw <span className="text-red-500 font-bold">₹{formData.amount}</span> from <span className="font-bold">{selectedGoal.type === 'solo' ? soloGoals.find(g => g.id === selectedGoal.id)?.name : selectedGoal.type === 'emergency' ? emergencyGoals.find(g => g.id === selectedGoal.id)?.name : groupGoals.find(g => g.id === selectedGoal.id)?.name}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      type="submit"
                      className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20"
                    >
                      Yes, Withdraw Money
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowWithdrawConfirm(false)}
                      className="w-full py-4 clay-inset rounded-2xl font-bold opacity-60 shadow-none"
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

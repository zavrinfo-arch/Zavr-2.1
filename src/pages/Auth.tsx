import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { cn, fetchWithRetry, formatDateSafely } from '../lib/utils';
import { 
  Mail, Lock, User, Phone, Calendar, MapPin,
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowRight, AtSign,
  ShieldCheck, KeyRound, Sparkles, Loader2, Sun, Moon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInYears, parseISO, format } from 'date-fns';
import { AVATARS } from '../constants';

type SignupStep = 'email' | 'verify' | 'password' | 'profile';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(() => {
    return sessionStorage.getItem('auth_is_login') === 'false' ? false : true;
  });
  const [signupStep, setSignupStep] = useState<SignupStep>(() => {
    return (sessionStorage.getItem('auth_signup_step') as SignupStep) || 'email';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotModalLoading, setForgotModalLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'new-password'>('request');
  const [forgotResolvedEmail, setForgotResolvedEmail] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotNewPasswordConfirm, setForgotNewPasswordConfirm] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotCountdown, setForgotCountdown] = useState(0);

  useEffect(() => {
    if (!showForgotModal || forgotStep !== 'verify' || forgotCountdown <= 0) return;
    
    const interval = setInterval(() => {
      setForgotCountdown((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showForgotModal, forgotStep, forgotCountdown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isRecovery = params.get('reset') === 'true' || window.location.hash.includes('type=recovery') || window.location.hash.includes('recovery');
    if (isRecovery) {
      setIsResetMode(true);
    }
  }, []);
  const lastVerifyClick = React.useRef(0);
  const isVerifyingRef = React.useRef(false);
  const isSigningUpRef = React.useRef(false);
  
  const navigate = useNavigate();
  const { currentUser, session, checkAuth, isAuthLoading, theme, setTheme } = useStore();

  useEffect(() => {
    sessionStorage.setItem('auth_is_login', isLogin.toString());
    sessionStorage.setItem('auth_signup_step', signupStep);
  }, [isLogin, signupStep]);

  useEffect(() => {
    if (session && !isAuthLoading && currentUser) {
      console.log('[AUTH] Current User State:', { id: currentUser.id, onboarding: currentUser.onboardingCompleted });
      
      if (currentUser.onboardingCompleted) {
        navigate('/home', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [session, currentUser, isAuthLoading, navigate]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: sessionStorage.getItem('auth_email') || '',
    username: '',
    phone: '',
    dob: '',
    location: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
    avatarId: 1
  });

  useEffect(() => {
    if (formData.email) {
      sessionStorage.setItem('auth_email', formData.email);
    }
  }, [formData.email]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return 'Weak';
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    if (hasUpper && hasNumber && hasSpecial) return 'Strong';
    return 'Medium';
  };

  const passwordStrength = validatePassword(formData.password);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    
    if (name === 'username' && typeof finalValue === 'string') {
      finalValue = finalValue.toLowerCase().replace(/\s+/g, '');
    }
    
    if (name === 'email' && typeof finalValue === 'string') {
      finalValue = finalValue.trim().toLowerCase();
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      console.warn('[AUTH] Login already in progress, skipping concurrent click.');
      return;
    }
    if (!formData.email || !formData.password) {
      toast.error('Email or Username and password are required');
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    console.log('[AUTH] Starting login performance tracking...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout limit for robustness

    try {
      const loginInput = formData.email.trim();
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email: loginInput,
          loginInput,
          password: formData.password
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const networkTime = Date.now();
      console.log(`[AUTH] Network /signin request completed in ${networkTime - startTime}ms`);

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }
      
      const { session } = result;
      if (!session) throw new Error('Authentication failed: No session returned.');

      // 2. Synchronize Supabase Client session & Check Auth
      if (isConfigured) {
        const sessionStart = Date.now();
        try {
          const { error: setSessionErr } = await supabase.auth.setSession(session);
          if (setSessionErr) {
            console.error('[AUTH] Set session error:', setSessionErr.message);
            if (setSessionErr.message?.includes('Refresh Token Not Found') || setSessionErr.message?.includes('Invalid Refresh Token')) {
              localStorage.removeItem('zavr-auth-token');
            }
          }
        } catch (setSessionErr: any) {
          console.warn('[AUTH] setSession exception caught gracefully:', setSessionErr);
        }
        // Trigger checkAuth immediately, seeding with pre-fetched profile to run at 0 extra cost
        await checkAuth(false, result.profile);
        console.log(`[AUTH] Session synchronization completed in ${Date.now() - sessionStart}ms`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] Perfect! Total login sequence completed in ${totalTime}ms (under 2 seconds limit)`);

      toast.success('Welcome back!');
      
      // Redirect directly to dashboard home
      navigate('/home', { replace: true });
    } catch (error: any) {
      clearTimeout(timeoutId);
      const totalTime = Date.now() - startTime;
      console.error(`[AUTH] Login sequence failed after ${totalTime}ms:`, error);
      
      let message = error.message;
      if (error.name === 'AbortError') {
        message = 'Request timed out (3s limit). Please check your internet connection and try again.';
      }
      
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid email or password')) {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-xs uppercase tracking-tight">Login Failed</p>
            <p className="text-[10px] opacity-60 leading-relaxed">
              Incorrect email or password. If you just signed up, you may need to verify your email, or reset your password if you forgot it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button 
                onClick={() => { toast.dismiss(t.id); setIsLogin(false); setSignupStep('verify'); }}
                className="text-[9px] bg-foreground px-2 py-1.5 rounded-md uppercase font-black text-background transition-opacity hover:opacity-80 shrink-0 cursor-pointer"
              >
                Verify Code
              </button>
              <button 
                onClick={async () => { 
                  toast.dismiss(t.id);
                  setLoading(true);
                  try {
                    const email = formData.email.trim().toLowerCase();
                    if (!email) {
                      toast.error('Please enter your email address first.');
                      return;
                    }
                    const response = await fetchWithRetry('/api/auth/resend-code', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, type: 'signup' })
                    });
                    if (!response.ok) {
                      const resData = await response.json();
                      throw new Error(resData.error || 'Failed to resend code');
                    }
                    toast.success('Code resent! Go to verification.');
                    setIsLogin(false);
                    setSignupStep('verify');
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-[9px] bg-[#FF6B6B] px-2 py-1.5 rounded-md uppercase font-black text-white transition-opacity hover:opacity-80 shrink-0 cursor-pointer"
              >
                Resend Code
              </button>
              <button 
                onClick={async () => {
                  toast.dismiss(t.id);
                  setLoading(true);
                  try {
                    const email = formData.email.trim().toLowerCase();
                    if (!email) {
                      toast.error('Please type in your email address first.');
                      return;
                    }
                    const response = await fetchWithRetry('/api/auth/reset-password-request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email })
                    });
                    if (!response.ok) {
                      const resData = await response.json();
                      throw new Error(resData.error || 'Failed to send reset link');
                    }
                    toast.success('Password reset link sent to your email! (Check your spam/junk folder too)');
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-[9px] bg-amber-500 px-2 py-1.5 rounded-md uppercase font-black text-black transition-opacity hover:opacity-80 shrink-0 cursor-pointer"
              >
                Reset Password
              </button>
              <button 
                onClick={() => { toast.dismiss(t.id); }}
                className="text-[9px] bg-foreground/5 px-2 py-1.5 rounded-md uppercase font-black transition-colors hover:bg-foreground/10 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 6000 });
        return;
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    if (loading || isSigningUpRef.current) {
      console.warn('[AUTH] Signup already in progress, skipping concurrent click.');
      return;
    }
    
    if (signupStep === 'email') {
      if (!formData.email || !formData.password) {
        setErrors({ 
          email: !formData.email ? 'Email required' : '',
          password: !formData.password ? 'Password required' : ''
        });
        return;
      }
      
      const email = formData.email.trim().toLowerCase();
      
      const strength = validatePassword(formData.password);
      if (strength !== 'Strong') {
        toast.error('Password must be strong (8+ chars, Uppercase, Number, Special)');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      isSigningUpRef.current = true;
      setLoading(true);
      const signupStart = Date.now();
      console.log('[AUTH] Starting signup performance tracking...');

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: formData.password,
          options: {
            data: {
              email: email,
              username: email.split('@')[0],
              user_name: email.split('@')[0],
              full_name: '',
              onboarding_completed: false
            }
          }
        });

        const signupDuration = Date.now() - signupStart;
        console.log(`[PERFORMANCE] Supabase auth.signUp completed in ${signupDuration}ms`);

        if (error) {
          console.error("SIGNUP ERROR:", error.message);
          if (error.message.includes('Database error saving new user')) {
            toast.error('The server encountered a database error during signup. Please try again or contact support.');
          } else {
            toast.error(error.message);
          }
          return;
        }

        console.log("USER CREATED OPTIMISTIC:", data.user);
        
        // Optimistic UI updates
        if (data.session) {
          try {
            const { error: setSessionErr } = await supabase.auth.setSession(data.session);
            if (setSessionErr) {
              console.error('[AUTH] Set session error during signup:', setSessionErr.message);
              if (setSessionErr.message?.includes('Refresh Token Not Found') || setSessionErr.message?.includes('Invalid Refresh Token')) {
                localStorage.removeItem('zavr-auth-token');
              }
            }
          } catch (err: any) {
            console.warn('[AUTH] setSession exception caught gracefully during signup:', err);
          }
          
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session: data.session })
          }).catch(err => {
            console.error('[AUTH] Silent background session sync error:', err);
          });
          
          sessionStorage.removeItem('auth_signup_step');
          sessionStorage.removeItem('auth_email');
          toast.success('Account created optimistically! Proceeding to profile details.');
          setSignupStep('profile');
        } else {
          toast.success('Sign up initiated! Please enter your verification code.');
          setSignupStep('verify');
        }
      } catch (error: any) {
        console.error("UNEXPECTED ERROR:", error);
        toast.error(error.message || 'An unexpected error occurred during signup');
      } finally {
        isSigningUpRef.current = false;
        setLoading(false);
      }
    } else if (signupStep === 'verify') {
      const activeCode = codeOverride || verificationCode;
      if (activeCode.length !== 6) {
        toast.error('Enter 6-digit code');
        return;
      }

      if (isVerifyingRef.current) {
        console.log('[AUTH] OTP verification already in progress, skipping concurrent call.');
        return;
      }

      // Debounce clicks on the verify button & auto-submit (prevent multiple submissions)
      const now = Date.now();
      if (now - lastVerifyClick.current < 1500) {
        return;
      }
      lastVerifyClick.current = now;

      isVerifyingRef.current = true;
      setLoading(true);

      try {
        const email = formData.email.trim().toLowerCase();
        
        console.log('[AUTH] Verifying OTP with type "signup" (email confirmation)...');
        // Correct default type for signup OTP confirmation in Supabase is "signup"
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: activeCode,
          type: 'signup'
        });

        if (error) {
          console.log('[AUTH] OTP type "signup" failed, trying fallback type "email" (magic link/login)...', error.message);
          const emailVerify = await supabase.auth.verifyOtp({
            email,
            token: activeCode,
            type: 'email'
          });
          if (emailVerify.error) {
            throw error; // Throw original error
          }
        }

        // Get session
        await supabase.auth.getSession();

        sessionStorage.removeItem('auth_signup_step');
        sessionStorage.removeItem('auth_email');
        toast.success('Email verified successfully!');
        
        // Trigger checkAuth immediately to hydrate optimistic or auto-created user profile
        await checkAuth();

        // Redirect directly to dashboard safely
        navigate('/home', { replace: true });
      } catch (error: any) {
        console.error('[AUTH] OTP direct verification exception:', error);
        toast.error(error.message || 'OTP Verification failed');
      } finally {
        isVerifyingRef.current = false;
        setLoading(false);
      }
    } else if (signupStep === 'password') {
      // Logic moved to 'email' step (account creation)
      setSignupStep('profile');
    } else if (signupStep === 'profile') {
      if (!formData.fullName || !formData.username || !formData.dob) {
        toast.error('Please fill all required fields');
        return;
      }

      const age = differenceInYears(new Date(), parseISO(formData.dob));
      if (age < 13) {
        toast.error('You must be at least 13 years old');
        return;
      }

      setLoading(true);
      try {
      // Get logged in user from session (instant local lookup)
      const { data: { session } } = await supabase.auth.getSession();
      const finalUser = session?.user;

      console.log("USER:", finalUser);

      // If no user, stop execution
      if (!finalUser) {
        console.error("No authenticated user");
        setLoading(false);
        return;
      }

      // Map values as per requirement 6
      const fullName = formData.fullName;
      const username = formData.username;
      const phone = formData.phone;
      const birthDate = formData.dob;
      const gender = (formData as any).gender || '';
      const avatarUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`;

      // Save using UPSERT (not insert) as per requirement 2
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: finalUser.id,
          full_name: fullName || null,
          username: username || null,
          phone: phone || null,
          birth_date: birthDate || null,
          gender: gender || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        });

        if (error) {
          console.error("SAVE ERROR:", error);
          toast.error("Failed to save personal details");
          setLoading(false);
          return;
        }

        console.log("Saved successfully");

        const savedProfile = {
          id: finalUser.id,
          full_name: fullName || null,
          username: username || null,
          phone: phone || null,
          birth_date: birthDate || null,
          gender: gender || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
          onboarding_completed: true, // Auto-completed now
          preferences: { currency: 'INR', notificationsEnabled: true, reminders: { enabled: true, time: '20:00', frequency: 'daily' } }
        };
        await checkAuth(false, savedProfile);
        setShowWelcome(true);
      } catch (error: any) {
        console.error('[Auth] Unexpected error:', error);
        toast.error(error.message || 'An unexpected error occurred during profile setup');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!resetPassword) {
      toast.error('Password is required');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const strength = validatePassword(resetPassword);
    if (strength !== 'Strong') {
      toast.error('Password must be strong (8+ chars, Uppercase, Number, Special)');
      return;
    }

    setLoading(true);
    const id = toast.loading('updating your password...');
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: resetPassword
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully!', { id });
      
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sessionData.session })
        });
      } catch (err) {
        console.warn('[AUTH] Background session sync error:', err);
      }

      await checkAuth();

      // Clear search query and hashes from the url
      window.history.replaceState(null, '', window.location.pathname);
      
      setIsResetMode(false);
      setIsLogin(true);

      navigate('/home', { replace: true });
    } catch (err: any) {
      console.error('[AUTH] Reset password failed:', err);
      toast.error(err.message || 'Failed to reset password', { id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-8 py-12 bg-background overflow-y-auto relative">
      {/* Floating Theme Switcher Button */}
      <div className="absolute top-6 right-6 z-[90]">
        <motion.button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-3 rounded-2xl clay bg-surface text-foreground hover:text-[#FF6B6B] transition-colors border border-foreground/5 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={16} className="text-amber-500 animate-[spin_10s_linear_infinite]" />
              <span className="text-[10px] uppercase font-bold tracking-wider select-none hidden sm:inline opacity-80">Light</span>
            </>
          ) : (
            <>
              <Moon size={16} className="text-indigo-500" />
              <span className="text-[10px] uppercase font-bold tracking-wider select-none hidden sm:inline opacity-80">Dark</span>
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-sm clay bg-surface p-10 text-center space-y-6"
            >
              <div className="w-24 h-24 mx-auto clay-coral rounded-3xl flex items-center justify-center text-white animate-bounce">
                <Sparkles size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Welcome!</h2>
                <p className="text-sm opacity-40 leading-relaxed">
                  Your account is ready. Let's start your savings journey!
                </p>
              </div>
              <button 
                onClick={() => navigate('/home')}
                className="w-full py-4 clay-coral text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl"
              >
                Let's Go!
              </button>
            </motion.div>
          </div>
        )}

        {showForgotModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!forgotModalLoading) setShowForgotModal(false);
              }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm clay bg-surface p-8 text-center space-y-6"
            >
              {forgotStep === 'request' && (
                <>
                  <div className="w-16 h-16 mx-auto clay-coral rounded-2xl flex items-center justify-center text-white">
                    <KeyRound size={28} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-black tracking-tight">Forgot Password</h2>
                    <p className="text-xs opacity-40 leading-relaxed">
                      Enter your Username or Email Address and we'll send you a 6-digit confirmation code.
                    </p>
                  </div>
                  <div className="space-y-4 text-left">
                    <Input 
                      id="forgot-email-username"
                      icon={AtSign} 
                      name="forgotInput" 
                      type="text"
                      placeholder="Email or Username" 
                      value={forgotInput} 
                      onChange={(e: any) => setForgotInput(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      disabled={forgotModalLoading}
                      onClick={async () => {
                        const trimmed = forgotInput.trim();
                        if (!trimmed) {
                          toast.error('Please enter your email or username');
                          return;
                        }
                        setForgotModalLoading(true);
                        try {
                          const response = await fetchWithRetry('/api/auth/reset-password-request', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ loginInput: trimmed })
                          });
                          const result = await response.json();
                          if (!response.ok) {
                            throw new Error(result.error || 'Failed to send reset code');
                          }
                          toast.success(result.message || '6-digit confirmation code sent!');
                          
                          // Store resolved email
                          if (result.email) {
                            setForgotResolvedEmail(result.email);
                          } else if (trimmed.includes('@')) {
                            setForgotResolvedEmail(trimmed);
                          } else {
                            setForgotResolvedEmail(trimmed);
                          }
                          
                          setForgotStep('verify');
                          setForgotCountdown(60);
                        } catch (err: any) {
                          toast.error(err.message);
                        } finally {
                          setForgotModalLoading(false);
                        }
                      }}
                      className="flex-1 py-3 clay-coral text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {forgotModalLoading ? <Loader2 className="animate-spin" size={12} /> : 'Send Code'}
                    </button>
                  </div>
                </>
              )}

              {forgotStep === 'verify' && (
                <>
                  <div className="w-16 h-16 mx-auto clay-coral rounded-2xl flex items-center justify-center text-white">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-black tracking-tight">Verify Code</h2>
                    <p className="text-xs opacity-40 leading-relaxed">
                      Enter the 6-digit code sent to:
                      <span className="block font-semibold opacity-70 mt-1 select-all font-mono">
                        {forgotResolvedEmail}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-4 text-left">
                    <Input 
                      id="forgot-otp-code"
                      icon={ShieldCheck} 
                      name="forgotOtpCode" 
                      type="text"
                      placeholder="••••••" 
                      maxLength={6}
                      value={forgotOtpCode} 
                      onChange={(e: any) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setForgotOtpCode(val);
                      }}
                      className="font-mono text-center tracking-[0.5em] text-lg pl-[0.25em]"
                    />
                    <div className="text-center pt-1">
                      {forgotCountdown > 0 ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 select-none">
                          Resend code in {forgotCountdown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={forgotModalLoading}
                          onClick={async () => {
                            if (!forgotResolvedEmail) {
                              toast.error('Registered email missing. Please go back.');
                              return;
                            }
                            setForgotModalLoading(true);
                            const id = toast.loading('Resending verification code...');
                            try {
                              const response = await fetchWithRetry('/api/auth/resend-code', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotResolvedEmail, type: 'recovery' })
                              });
                              const result = await response.json();
                              if (!response.ok) throw new Error(result.error);
                              toast.success(result.message || 'Verification code resent!', { id });
                              setForgotCountdown(60);
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to resend code', { id });
                            } finally {
                              setForgotModalLoading(false);
                            }
                          }}
                          className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B6B] opacity-60 hover:opacity-100 transition-opacity"
                        >
                          Resend Code
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setForgotStep('request')}
                      className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                    >
                      Back
                    </button>
                    <button 
                      type="button"
                      disabled={forgotModalLoading || forgotOtpCode.length < 6}
                      onClick={async () => {
                        setForgotModalLoading(true);
                        const id = toast.loading('Verifying code...');
                        try {
                          const response = await fetchWithRetry('/api/auth/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              email: forgotResolvedEmail,
                              token: forgotOtpCode,
                              type: 'recovery'
                            })
                          });
                          const result = await response.json();
                          if (!response.ok) {
                            throw new Error(result.error || 'Invalid verification code');
                          }
                          toast.success('Code verified successfully!', { id });
                          setForgotStep('new-password');
                        } catch (err: any) {
                          toast.error(err.message || 'Incorrect verification code', { id });
                        } finally {
                          setForgotModalLoading(false);
                        }
                      }}
                      className="flex-1 py-3 clay-coral text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {forgotModalLoading ? <Loader2 className="animate-spin" size={12} /> : 'Verify'}
                    </button>
                  </div>
                </>
              )}

              {forgotStep === 'new-password' && (
                <>
                  <div className="w-16 h-16 mx-auto clay-coral rounded-2xl flex items-center justify-center text-white">
                    <Lock size={28} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-black tracking-tight">New Password</h2>
                    <p className="text-xs opacity-40 leading-relaxed">
                      A secure password must be at least 8 characters and contain mixed case, numbers, and symbols.
                    </p>
                  </div>
                  <div className="space-y-4 text-left">
                    <div className="relative">
                      <Input 
                        id="forgot-new-password"
                        icon={Lock} 
                        name="forgotNewPassword" 
                        type={showForgotNewPassword ? 'text' : 'password'} 
                        placeholder="New Password" 
                        value={forgotNewPassword} 
                        onChange={(e: any) => setForgotNewPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
                      >
                        {showForgotNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {forgotNewPassword && (
                      <div className="flex items-center gap-2 px-1">
                        <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: validatePassword(forgotNewPassword) === 'Weak' ? '33%' : validatePassword(forgotNewPassword) === 'Medium' ? '66%' : '100%',
                              backgroundColor: validatePassword(forgotNewPassword) === 'Weak' ? '#ef4444' : validatePassword(forgotNewPassword) === 'Medium' ? '#f59e0b' : '#10b981'
                            }}
                            className="h-full"
                          />
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          validatePassword(forgotNewPassword) === 'Weak' ? "text-red-500" : validatePassword(forgotNewPassword) === 'Medium' ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {validatePassword(forgotNewPassword)}
                        </span>
                      </div>
                    )}

                    <Input 
                      id="forgot-new-password-confirm"
                      icon={Lock} 
                      name="forgotNewPasswordConfirm" 
                      type="password" 
                      placeholder="Confirm New Password" 
                      value={forgotNewPasswordConfirm} 
                      onChange={(e: any) => setForgotNewPasswordConfirm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      disabled={forgotModalLoading}
                      onClick={async () => {
                        if (!forgotNewPassword) {
                          toast.error('Password is required');
                          return;
                        }
                        if (forgotNewPassword !== forgotNewPasswordConfirm) {
                          toast.error('Passwords do not match');
                          return;
                        }
                        const strength = validatePassword(forgotNewPassword);
                        if (strength !== 'Strong') {
                          toast.error('Password must be strong (8+ characters with uppercase, numbers, and symbols)');
                          return;
                        }

                        setForgotModalLoading(true);
                        const id = toast.loading('Updating your password...');
                        try {
                          const { data, error } = await supabase.auth.updateUser({
                            password: forgotNewPassword
                          });

                          if (error) {
                            throw error;
                          }

                          toast.success('Password updated successfully!', { id });

                          try {
                            const { data: sessionData } = await supabase.auth.getSession();
                            await fetch('/api/auth/session', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ session: sessionData.session })
                            });
                          } catch (err) {
                            console.warn('[AUTH] Background session sync error:', err);
                          }

                          await checkAuth();
                          setShowForgotModal(false);
                          navigate('/home', { replace: true });
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to update password', { id });
                        } finally {
                          setForgotModalLoading(false);
                        }
                      }}
                      className="flex-1 py-3 clay-coral text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {forgotModalLoading ? <Loader2 className="animate-spin" size={12} /> : 'Save Password'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 flex flex-col items-center text-center"
      >
        <div className="mb-8">
          <img
            src="https://raw.githubusercontent.com/zavrinfo-arch/zavr-privacy-policy/main/zavr_logo.png"
            alt="Zavr Logo"
            className="w-16 h-16 object-contain rounded-full shadow-lg shadow-emerald-500/20 hover:scale-105 transition duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3 text-foreground">
          {isResetMode ? 'Update Password' : isLogin ? 'Welcome Back' : 'Join Zavr'}
        </h1>
        <p className="opacity-30 text-sm leading-relaxed">
          {isResetMode ? 'Set a secure new password for your account' : isLogin ? 'Sign in with your email' : 'Start your gamified savings adventure'}
        </p>
      </motion.div>

      {!isResetMode && (
        <div className="flex p-1 clay-inset mb-10">
          <button 
            onClick={() => { setIsLogin(true); setSignupStep('email'); }}
            className={cn(
              "flex-1 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-widest",
              isLogin ? "bg-surface text-foreground shadow-xl" : "opacity-30"
            )}
          >
            Login
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={cn(
              "flex-1 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-widest",
              !isLogin ? "bg-surface text-foreground shadow-xl" : "opacity-30"
            )}
          >
            Signup
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isResetMode ? (
          <motion.form 
            key="reset-password"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleResetPassword} 
            className="space-y-4"
          >
            <div className="relative">
              <Input 
                icon={Lock} 
                name="resetPassword" 
                type={showResetPassword ? 'text' : 'password'} 
                placeholder="New Password" 
                value={resetPassword} 
                onChange={(e: any) => setResetPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
              >
                {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {resetPassword && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: validatePassword(resetPassword) === 'Weak' ? '33%' : validatePassword(resetPassword) === 'Medium' ? '66%' : '100%',
                      backgroundColor: validatePassword(resetPassword) === 'Weak' ? '#ef4444' : validatePassword(resetPassword) === 'Medium' ? '#f59e0b' : '#10b981'
                    }}
                    className="h-full"
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  validatePassword(resetPassword) === 'Weak' ? "text-red-500" : validatePassword(resetPassword) === 'Medium' ? "text-amber-500" : "text-emerald-500"
                )}>
                  {validatePassword(resetPassword)}
                </span>
              </div>
            )}

            <Input 
              icon={Lock} 
              name="resetConfirmPassword" 
              type="password" 
              placeholder="Confirm New Password" 
              value={resetConfirmPassword} 
              onChange={(e: any) => setResetConfirmPassword(e.target.value)}
            />

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all active:scale-95 text-white uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  Reset Password
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <p className="text-center text-[10px] opacity-20 font-bold uppercase tracking-widest mt-4">
              Remembered your password? <button type="button" onClick={() => { setIsResetMode(false); setIsLogin(true); }} className="text-[#FF6B6B]">Back to Login</button>
            </p>
          </motion.form>
        ) : isLogin ? (
          <motion.form 
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={handleLogin} 
            className="space-y-4"
          >
            <Input 
              id="login-email-username"
              icon={Mail} 
              name="email" 
              type="text"
              placeholder="Email or Username" 
              value={formData.email} 
              onChange={handleInputChange}
            />
            <div className="relative">
              <Input 
                icon={Lock} 
                name="password" 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Password" 
                value={formData.password} 
                onChange={handleInputChange}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
             <div className="flex justify-end px-1">
              <button 
                type="button"
                onClick={() => {
                  setForgotInput(formData.email);
                  setForgotStep('request');
                  setForgotOtpCode('');
                  setForgotNewPassword('');
                  setForgotNewPasswordConfirm('');
                  setForgotResolvedEmail('');
                  setForgotCountdown(0);
                  setShowForgotModal(true);
                }}
                className="text-[10px] uppercase font-bold tracking-widest text-[#FF6B6B] opacity-60 hover:opacity-100 transition-opacity"
              >
                Forgot Password?
              </button>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all active:scale-95 text-white uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="text-center text-[10px] opacity-20 font-bold uppercase tracking-widest mt-4">
              Don't have an account? <button type="button" onClick={() => setIsLogin(false)} className="text-[#FF6B6B]">Create Account</button>
            </p>
          </motion.form>
        ) : (
          <motion.form 
            key="signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSignupStep} 
            className="space-y-4"
          >
            {signupStep === 'email' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Input 
                  icon={Mail} 
                  name="email" 
                  type="email" 
                  placeholder="Email Address" 
                  value={formData.email} 
                  onChange={handleInputChange}
                  error={errors.email}
                />
                <div className="relative">
                  <Input 
                    icon={Lock} 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Create Password" 
                    value={formData.password} 
                    onChange={handleInputChange}
                    error={errors.password}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 opacity-40 hover:opacity-100"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
                {formData.password && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: passwordStrength === 'Weak' ? '33%' : passwordStrength === 'Medium' ? '66%' : '100%',
                          backgroundColor: passwordStrength === 'Weak' ? '#ef4444' : passwordStrength === 'Medium' ? '#f59e0b' : '#10b981'
                        }}
                        className="h-full"
                      />
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      passwordStrength === 'Weak' ? "text-red-500" : passwordStrength === 'Medium' ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {passwordStrength}
                    </span>
                  </div>
                )}

                <Input 
                  icon={Lock} 
                  name="confirmPassword" 
                  type="password" 
                  placeholder="Confirm Password" 
                  value={formData.confirmPassword} 
                  onChange={handleInputChange}
                  error={errors.confirmPassword}
                />

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl text-white uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <p className="text-[10px] opacity-30 text-center mt-6 leading-relaxed px-4">
                  By signing up, you agree to our{' '}
                  <a href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#FF6B6B] transition-colors">Terms & Conditions</a>
                  {' '}and{' '}
                  <a href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#FF6B6B] transition-colors">Privacy Policy</a>.
                </p>
              </motion.div>
            )}

            {signupStep === 'verify' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
                <div className="w-16 h-16 mx-auto clay-inset flex items-center justify-center text-[#FF6B6B] mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-lg font-bold">Verify Email</h3>
                <p className="text-xs opacity-40 mb-6">Enter the 6-digit code sent to your email</p>
                <div className="flex justify-center gap-2">
                  <input 
                    maxLength={6}
                    autoFocus
                    className="w-full clay-inset bg-foreground/5 p-4 text-center text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-[#FF6B6B]/20"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setVerificationCode(val);
                      if (val.length === 6 && !loading) {
                        handleSignupStep(undefined, val);
                      }
                    }}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold text-white uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      Verifying...
                    </div>
                  ) : 'Verify Code'}
                </button>
                <div className="pt-6">
                  <button 
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const email = formData.email.trim().toLowerCase();
                        const response = await fetchWithRetry('/api/auth/resend-code', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email, type: 'signup' })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error);
                        toast.success('Code resent! Check your inbox.');
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="text-[10px] uppercase font-bold tracking-widest text-[#FF6B6B] opacity-60 hover:opacity-100 transition-opacity"
                  >
                    Didn't receive code? Resend
                  </button>
                </div>
              </motion.div>
            )}

            {signupStep === 'profile' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Input 
                  icon={User} 
                  name="fullName" 
                  placeholder="Full Name" 
                  value={formData.fullName} 
                  onChange={handleInputChange}
                />
                <Input 
                  icon={AtSign} 
                  name="username" 
                  placeholder="Username" 
                  value={formData.username} 
                  onChange={handleInputChange}
                  error={errors.username}
                />
                <Input 
                  icon={Calendar} 
                  name="dob" 
                  type="date" 
                  placeholder="Date of Birth" 
                  value={formData.dob} 
                  onChange={handleInputChange}
                />
                <Input 
                  icon={Phone} 
                  name="phone" 
                  placeholder="Phone Number (Optional)" 
                  value={formData.phone} 
                  onChange={handleInputChange}
                />
                <Input 
                  icon={MapPin} 
                  name="location" 
                  placeholder="Location (Optional)" 
                  value={formData.location} 
                  onChange={handleInputChange}
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold text-white uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      Completing...
                    </div>
                  ) : 'Complete Setup'}
                </button>
                <p className="text-[10px] opacity-30 text-center mt-6 leading-relaxed px-4">
                  We collect this information to personalize your experience. By completing setup, you agree to our{' '}
                  <a href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#FF6B6B] transition-colors">Terms & Conditions</a>
                  {' '}and{' '}
                  <a href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#FF6B6B] transition-colors">Privacy Policy</a>.
                </p>
              </motion.div>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({ icon: Icon, error, className, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <div className={cn(
        "relative flex items-center clay-card transition-all border",
        error ? "border-red-500/30 bg-red-500/5" : "border-foreground/5 focus-within:border-foreground/20"
      )}>
        <div className="pl-4 opacity-20">
          <Icon size={18} />
        </div>
        <input 
          {...props}
          className={cn("w-full py-4 px-3 bg-transparent outline-none text-sm text-foreground placeholder:opacity-10", className)}
        />
      </div>
      {props.type === 'date' && props.value && (
        <p className="text-[10px] text-[#FF6B6B] font-black uppercase tracking-widest ml-4">
          Date: {formatDateSafely(props.value)}
        </p>
      )}
      {error && <p className="text-[10px] text-red-500 font-bold ml-4 uppercase tracking-widest">{error}</p>}
    </div>
  );
}

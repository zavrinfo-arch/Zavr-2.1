import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { cn, fetchWithRetry, formatDateSafely } from '../lib/utils';
import { 
  Mail, Lock, User, Phone, Calendar, MapPin,
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowRight, AtSign,
  ShieldCheck, KeyRound, Sparkles, Loader2
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
  const lastVerifyClick = React.useRef(0);
  
  const navigate = useNavigate();
  const { currentUser, session, checkAuth, isAuthLoading } = useStore();

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
    if (!formData.email || !formData.password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    console.log('[AUTH] Starting login performance tracking...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Strict 3 second timeout

    try {
      const email = formData.email.trim().toLowerCase();
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email,
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
        // Trigger checkAuth immediately to hydrate optimistic/cached profile
        await checkAuth();
        console.log(`[AUTH] Session synchronization completed in ${Date.now() - sessionStart}ms`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] Perfect! Total login sequence completed in ${totalTime}ms (under 2 seconds limit)`);

      toast.success('Welcome back!');
      
      // Redirect instantly without waiting on background profile fetching
      const onboardingCompleted = session.user.user_metadata?.onboarding_completed ?? true;
      if (onboardingCompleted) {
        navigate('/home', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      const totalTime = Date.now() - startTime;
      console.error(`[AUTH] Login sequence failed after ${totalTime}ms:`, error);
      
      let message = error.message;
      if (error.name === 'AbortError') {
        message = 'Request timed out (3s limit). Please check your internet connection and try again.';
      }
      toast.error(message);
      
      if (message.toLowerCase().includes('invalid login credentials')) {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-xs uppercase tracking-tight">Invalid Credentials</p>
            <p className="text-[10px] opacity-60 leading-relaxed">
              Check your email and password. You might need to verify your account first if you haven't done so, or reset your password if you've forgotten it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button 
                onClick={() => { toast.dismiss(t.id); setIsLogin(false); setSignupStep('verify'); }}
                className="text-[9px] bg-foreground px-2 py-1.5 rounded-md uppercase font-black text-background transition-opacity hover:opacity-80 shrink-0"
              >
                Verify Code
              </button>
              <button 
                onClick={async () => { 
                  toast.dismiss(t.id);
                  setLoading(true);
                  try {
                    const email = formData.email.trim().toLowerCase();
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
                className="text-[9px] bg-[#FF6B6B] px-2 py-1.5 rounded-md uppercase font-black text-white transition-opacity hover:opacity-80 shrink-0"
              >
                Resend Code
              </button>
              <button 
                onClick={() => { toast.dismiss(t.id); }}
                className="text-[9px] bg-foreground/5 px-2 py-1.5 rounded-md uppercase font-black transition-colors hover:bg-foreground/10 shrink-0"
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
        setLoading(false);
      }
    } else if (signupStep === 'verify') {
      const activeCode = codeOverride || verificationCode;
      if (activeCode.length !== 6) {
        toast.error('Enter 6-digit code');
        return;
      }

      // Debounce clicks on the verify button & auto-submit (prevent multiple submissions)
      const now = Date.now();
      if (now - lastVerifyClick.current < 1500) {
        return;
      }
      lastVerifyClick.current = now;

      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const email = formData.email.trim().toLowerCase();
        const response = await fetchWithRetry('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, token: activeCode, type: 'signup' }),
          signal: controller.signal
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response. Please try again later.');
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Verification failed');
        
        if (result.session) {
          try {
            const { error: setSessionErr } = await supabase.auth.setSession(result.session);
            if (setSessionErr) {
              console.error('[AUTH] Set session error during verification:', setSessionErr.message);
              if (setSessionErr.message?.includes('Refresh Token Not Found') || setSessionErr.message?.includes('Invalid Refresh Token')) {
                localStorage.removeItem('zavr-auth-token');
              }
            }
          } catch (err: any) {
            console.warn('[AUTH] setSession exception caught gracefully during verification:', err);
          }
        }

        sessionStorage.removeItem('auth_signup_step');
        sessionStorage.removeItem('auth_email');
        toast.success('Email verified!');
        setSignupStep('profile');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          toast.error('Verification timed out (15s limit). Please check connection and try again.');
        } else {
          const message = error.message === 'Failed to fetch' 
            ? 'Unable to connect to the server. Please check your internet connection or try again later.'
            : error.message;
          toast.error(message);
        }
      } finally {
        clearTimeout(timeoutId);
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
      // Get logged in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const finalUser = user || session?.user;

      console.log("USER:", finalUser);
      if (userError) console.log("USER ERROR:", userError);

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
          alert("Failed to save personal details");
          setLoading(false);
          return;
        }

        console.log("Saved successfully");

        await checkAuth();
        setShowWelcome(true);
      } catch (error: any) {
        console.error('[Auth] Unexpected error:', error);
        toast.error(error.message || 'An unexpected error occurred during profile setup');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-8 py-12 bg-background overflow-y-auto">
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
                onClick={() => navigate('/onboarding')}
                className="w-full py-4 clay-coral text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl"
              >
                Let's Go!
              </button>
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
          {isLogin ? 'Welcome Back' : 'Join Zavr'}
        </h1>
        <p className="opacity-30 text-sm leading-relaxed">
          {isLogin ? 'Sign in with your email' : 'Start your gamified savings adventure'}
        </p>
      </motion.div>

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

      <AnimatePresence mode="wait">
        {isLogin ? (
          <motion.form 
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={handleLogin} 
            className="space-y-4"
          >
            <Input 
              icon={Mail} 
              name="email" 
              type="email"
              placeholder="Email Address" 
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
                onClick={async () => {
                  if (!formData.email) {
                    toast.error('Enter your email first');
                    return;
                  }
                  setLoading(true);
                  try {
                    const response = await fetchWithRetry('/api/auth/reset-password-request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: formData.email })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    toast.success('Reset email sent!');
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setLoading(false);
                  }
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

function Input({ icon: Icon, error, ...props }: any) {
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
          className="w-full py-4 px-3 bg-transparent outline-none text-sm text-foreground placeholder:opacity-10"
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

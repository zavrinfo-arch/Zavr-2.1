import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { 
  Mail, Lock, User, Phone, Calendar, MapPin,
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowRight, AtSign,
  ShieldCheck, KeyRound, Sparkles, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInYears, parseISO } from 'date-fns';
import { AVATARS } from '../constants';

type SignupStep = 'email' | 'verify' | 'password' | 'profile';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState<SignupStep>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { setCurrentUser, checkAuth } = useStore();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    dob: '',
    location: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
    avatarId: 1
  });

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
    setLoading(true);
    
    const loginWithRetry = async (retries = 3, delay = 1000): Promise<Response> => {
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });
        return response;
      } catch (err: any) {
        const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError';
        if (retries > 0 && isNetworkError) {
          console.warn(`Login failed (${err.message}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return loginWithRetry(retries - 1, delay * 1.5);
        }
        throw err;
      }
    };

    try {
      const response = await loginWithRetry();

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Please try again later.');
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Login failed');

      if (result.session) {
        await supabase.auth.setSession(result.session);
      }

      await checkAuth();
      toast.success('Welcome back!');
      navigate('/home');
    } catch (error: any) {
      const message = error.message === 'Failed to fetch' 
        ? 'Unable to connect to the server. Please check your internet connection or try again later.'
        : error.message;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupStep === 'email') {
      if (!formData.email) {
        setErrors({ email: 'Email required' });
        return;
      }
      setLoading(true);
      const signupWithRetry = async (retries = 3, delay = 1000): Promise<Response> => {
        try {
          const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: formData.email })
          });
          return response;
        } catch (err: any) {
          const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError';
          if (retries > 0 && isNetworkError) {
            console.warn(`Signup failed (${err.message}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return signupWithRetry(retries - 1, delay * 1.5);
          }
          throw err;
        }
      };

      try {
        const response = await signupWithRetry();

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response. Please try again later.');
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Signup failed');
        
        toast.success('Verification code sent!');
        setSignupStep('verify');
      } catch (error: any) {
        const message = error.message === 'Failed to fetch' 
          ? 'Unable to connect to the server. Please check your internet connection or try again later.'
          : error.message;
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else if (signupStep === 'verify') {
      if (verificationCode.length !== 6) {
        toast.error('Enter 6-digit code');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: formData.email, token: verificationCode })
        }).catch(err => {
          if (err.message === 'Failed to fetch') {
            throw new Error('Unable to connect to the server. Please check your internet connection or try again later.');
          }
          throw err;
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response. Please try again later.');
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Verification failed');
        
        if (result.session) {
          await supabase.auth.setSession(result.session);
        }

        toast.success('Email verified!');
        setSignupStep('password');
      } catch (error: any) {
        const message = error.message === 'Failed to fetch' 
          ? 'Unable to connect to the server. Please check your internet connection or try again later.'
          : error.message;
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else if (signupStep === 'password') {
      const strength = validatePassword(formData.password);
      if (strength !== 'Strong') {
        toast.error('Password must be strong (8+ chars, Uppercase, Number, Special)');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' });
        return;
      }
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
        const response = await fetch('/api/auth/complete-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: formData.username,
            fullName: formData.fullName,
            dob: formData.dob,
            phone: formData.phone,
            location: formData.location,
            password: formData.password
          })
        }).catch(err => {
          if (err.message === 'Failed to fetch') {
            throw new Error('Unable to connect to the server. Please check your internet connection or try again later.');
          }
          throw err;
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response. Please try again later.');
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Profile completion failed');

        await checkAuth();
        setShowWelcome(true);
      } catch (error: any) {
        const message = error.message === 'Failed to fetch' 
          ? 'Unable to connect to the server. Please check your internet connection or try again later.'
          : error.message;
        toast.error(message);
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
        className="mb-12"
      >
        <div className="w-16 h-16 clay p-1 flex items-center justify-center mb-8">
          <img 
            src="/logo.svg" 
            alt="Zavr Logo" 
            className="w-full h-full object-contain"
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
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all active:scale-95 text-white uppercase tracking-widest text-xs disabled:opacity-50"
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
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl text-white uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : (
                    <>
                      Send Code
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
                    onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold text-white uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify Code'}
                </button>
              </motion.div>
            )}

            {signupStep === 'password' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="w-16 h-16 mx-auto clay-inset flex items-center justify-center text-[#FF6B6B] mb-4">
                  <KeyRound size={32} />
                </div>
                <div className="relative">
                  <Input 
                    icon={Lock} 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="New Password" 
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
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ 
                        width: formData.password ? (passwordStrength === 'Weak' ? '33%' : passwordStrength === 'Medium' ? '66%' : '100%') : 0,
                        backgroundColor: passwordStrength === 'Weak' ? '#ef4444' : passwordStrength === 'Medium' ? '#f59e0b' : '#10b981'
                      }}
                      className="h-full"
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    passwordStrength === 'Weak' ? "text-red-500" : passwordStrength === 'Medium' ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {formData.password ? passwordStrength : ''}
                  </span>
                </div>
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
                  className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold text-white uppercase tracking-widest text-xs"
                >
                  Continue
                </button>
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
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'Complete Setup'}
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
      {error && <p className="text-[10px] text-red-500 font-bold ml-4 uppercase tracking-widest">{error}</p>}
    </div>
  );
}

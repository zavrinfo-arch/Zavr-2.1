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
  Mail, Lock, User, Phone, Calendar, 
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowRight, AtSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInYears, parseISO } from 'date-fns';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { users, addUser, setCurrentUser } = useStore();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
    terms: false,
    rememberMe: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return 'Weak';
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) return 'Strong';
    return 'Medium';
  };

  const passwordStrength = validatePassword(formData.password);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (isLogin) {
      const user = users.find(u => u.email === formData.email && u.id === 'pass-' + formData.password); // Mock password check
      // In a real app we'd hash passwords, but here we use a simple mock
      const foundUser = users.find(u => u.email === formData.email);
      
      if (!foundUser) {
        toast.error('User not found');
        return;
      }
      
      // For demo purposes, any password works if user exists, or we can check a mock field
      setCurrentUser(foundUser);
      toast.success('Welcome back!');
      navigate(foundUser.onboardingCompleted ? '/home' : '/onboarding');
    } else {
      // Signup Validation
      if (!formData.fullName) newErrors.fullName = 'Required';
      if (!formData.email) newErrors.email = 'Required';
      if (!formData.username) newErrors.username = 'Required';
      if (users.some(u => u.username === formData.username)) newErrors.username = 'Username taken';
      
      if (formData.dob) {
        const age = differenceInYears(new Date(), parseISO(formData.dob));
        if (age < 16) newErrors.dob = 'Must be at least 16 years old';
      } else {
        newErrors.dob = 'Required';
      }

      if (formData.password.length < 8) newErrors.password = 'Min 8 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      if (!formData.terms) toast.error('Please accept terms');

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        fullName: formData.fullName,
        email: formData.email,
        username: formData.username,
        phone: formData.phone,
        dob: formData.dob,
        avatar: '',
        onboardingCompleted: false,
        interests: [],
        weeklyTarget: 0,
        badges: [],
        createdAt: new Date().toISOString(),
        xp: 0,
        level: 1,
        preferences: {
          currency: 'INR' as const,
          notificationsEnabled: true,
          reminders: {
            enabled: false,
            time: '09:00',
            frequency: 'daily' as const
          }
        }
      };

      addUser(newUser);
      setCurrentUser(newUser);
      toast.success('Account created!');
      navigate('/onboarding');
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-8 py-12 bg-background overflow-y-auto">
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
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="opacity-30 text-sm leading-relaxed">
          {isLogin ? 'Sign in to continue your savings journey' : 'Join Zavr and start saving smarter'}
        </p>
      </motion.div>

      <div className="flex p-1 clay-inset mb-10">
        <button 
          onClick={() => setIsLogin(true)}
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

      <form onSubmit={handleAuth} className="space-y-4">
        <AnimatePresence mode="wait">
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              <Input 
                icon={User} 
                name="fullName" 
                placeholder="Full Name" 
                value={formData.fullName} 
                onChange={handleInputChange}
                error={errors.fullName}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  icon={AtSign} 
                  name="username" 
                  placeholder="Username" 
                  value={formData.username} 
                  onChange={handleInputChange}
                  error={errors.username}
                />
                <Input 
                  icon={Phone} 
                  name="phone" 
                  placeholder="Phone" 
                  value={formData.phone} 
                  onChange={handleInputChange}
                />
              </div>
              <Input 
                icon={Calendar} 
                name="dob" 
                type="date" 
                placeholder="Date of Birth" 
                value={formData.dob} 
                onChange={handleInputChange}
                error={errors.dob}
              />
            </motion.div>
          )}
        </AnimatePresence>

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
            placeholder="Password" 
            value={formData.password} 
            onChange={handleInputChange}
            error={errors.password}
          />
          <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {!isLogin && (
          <>
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

            <label className="flex items-center gap-3 px-1 cursor-pointer group">
              <input 
                type="checkbox" 
                name="terms" 
                checked={formData.terms} 
                onChange={handleInputChange}
                className="w-5 h-5 rounded-lg border-foreground/5 bg-foreground/5 text-[#FF6B6B] focus:ring-[#FF6B6B]"
              />
              <span className="text-xs opacity-40 group-hover:opacity-60 transition-colors">
                I agree to the <span className="text-[#FF6B6B] font-bold">Terms & Conditions</span>
              </span>
            </label>
          </>
        )}

        {isLogin && (
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                name="rememberMe" 
                checked={formData.rememberMe} 
                onChange={handleInputChange}
                className="w-4 h-4 rounded border-foreground/5 bg-foreground/5 text-[#FF6B6B]"
              />
              <span className="text-xs opacity-30 font-medium">Remember me</span>
            </label>
            <button type="button" className="text-xs text-[#FF6B6B] font-bold uppercase tracking-wider">Forgot Password?</button>
          </div>
        )}

        <button 
          type="submit"
          className="w-full py-4 mt-6 clay-coral rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all active:scale-95 text-white uppercase tracking-widest text-xs"
        >
          {isLogin ? 'Sign In' : 'Create Account'}
          <ArrowRight size={18} />
        </button>
      </form>
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

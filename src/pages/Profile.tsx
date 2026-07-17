/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { AVATARS_50 } from '../constants/avatars';
import { formatCurrency, cn } from '../lib/utils';
import { 
  User, Settings, Bell, Globe, 
  Download, LogOut, Flame, Trophy, 
  CheckCircle2, Star, Shield, Zap,
  Camera, Clock, Calendar, X, Check, Lock,
  Sun, Moon
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_PREFERENCES = {
  currency: 'INR' as const,
  notificationsEnabled: true,
  reminders: {
    enabled: false,
    time: '09:00',
    frequency: 'daily' as const
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const { 
    currentUser, streakData, soloGoals, 
    transactions, setCurrentUser, updateUser, signOut,
    session
  } = useStore();
  const { theme, setTheme } = useTheme();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    fullName: currentUser?.fullName || '',
    username: currentUser?.username || '',
    location: currentUser?.location || '',
  });

  React.useEffect(() => {
    if (currentUser) {
      setEditData({
        fullName: currentUser.fullName || '',
        username: currentUser.username || '',
        location: currentUser.location || '',
      });
    }
  }, [currentUser]);

  const displayFullName = currentUser?.fullName?.trim() || session?.user?.email?.split('@')[0] || 'User';
  const displayUsername = currentUser?.username?.trim() || session?.user?.email?.split('@')[0] || 'user';

  const handleSaveProfile = async () => {
    if (!editData.fullName || !editData.username) {
      toast.error('Please fill all fields');
      return;
    }

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
        return;
      }

      // Map values
      const fullName = editData.fullName;
      const username = editData.username;
      const phone = currentUser?.phone || '';
      const birthDate = currentUser?.dob || '';
      const gender = (currentUser as any)?.gender || '';
      const avatarUrl = currentUser?.avatar || '';

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
          location: editData.location,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error("SAVE ERROR:", error);
        toast.error("Failed to save personal details");
        return;
      }

      console.log("Saved successfully");

      // Update store state
      await updateUser({
        fullName: editData.fullName,
        username: editData.username,
        location: editData.location,
      });

      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      console.error('[Profile] Unexpected error:', err);
      toast.error('An unexpected error occurred.');
    }
  };

  const stats = {
    lifetimeSaved: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    completedGoals: soloGoals.filter(g => g.completed).length,
    totalBadges: currentUser?.badges?.length || 0,
  };

  const handleLogout = async () => {
    console.log('handleLogout triggered');
    const id = toast.loading('Logging out...');
    try {
      await signOut();
      console.log('signOut completed, redirecting...');
      toast.success('Logged out successfully', { id });
      // Use window.location for a full refresh to clear any remaining state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout handler error:', error);
      toast.error('Failed to logout', { id });
    }
  };

  const exportData = () => {
    const data = {
      user: currentUser,
      soloGoals,
      transactions,
      streakData
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zavr-data-${currentUser?.username}.json`;
    a.click();
    toast.success('Data exported successfully');
  };

  return (
    <div className="space-y-10 pb-20 font-sans px-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center pt-6">
        <div className="relative group">
          <button 
            onClick={() => navigate('/avatar-selection')}
            className="w-32 h-32 rounded-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md flex items-center justify-center overflow-hidden active:scale-95 transition-transform shadow-xl"
          >
            <img 
              src={AVATARS_50.find(a => a.id === currentUser?.avatarId?.toString())?.url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser?.username}`} 
              alt="Avatar"
              className="w-full h-full object-cover p-1.5"
              referrerPolicy="no-referrer"
            />
          </button>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-xl flex items-center justify-center text-sm font-black text-white border-2 border-white dark:border-[#0a0a0f] shadow-lg">
            {currentUser?.level || 1}
          </div>
          <button 
            onClick={() => navigate('/avatar-selection')}
            className="absolute -top-1 -right-1 p-2 bg-white dark:bg-[#111118] border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-white/70 hover:text-zinc-950 dark:hover:text-white rounded-full hover:scale-115 transition-all shadow-md"
          >
            <Camera size={16} />
          </button>
        </div>

        <div className="mt-8 space-y-4 w-full max-w-xs mx-auto">
          {isEditing ? (
            <div className="space-y-3">
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-1 focus-within:border-[#FF6B6B]/60 transition-colors">
                <input 
                  type="text"
                  value={editData.fullName}
                  onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none text-zinc-900 dark:text-white text-xs"
                  placeholder="Full Name"
                />
              </div>
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-1 focus-within:border-[#FF6B6B]/60 transition-colors">
                <input 
                  type="text"
                  value={editData.username}
                  onChange={e => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none text-zinc-500 dark:text-white/60 text-xs"
                  placeholder="Username"
                />
              </div>
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-1 focus-within:border-[#FF6B6B]/60 transition-colors">
                <input 
                  type="text"
                  value={editData.location}
                  onChange={e => setEditData({ ...editData, location: e.target.value })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none text-zinc-900 dark:text-white text-xs"
                  placeholder="Location"
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 py-3 bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-[rgba(255,107,107,0.35)] active:scale-95 transition-transform cursor-pointer"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] text-zinc-500 dark:text-white/60 rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-transform cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{displayFullName}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-zinc-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest">@{displayUsername}</p>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10" />
                  <p className="text-[#FF6B6B] text-[10px] font-black uppercase tracking-[0.2em]">{streakData.tier} Tier</p>
                </div>
 
                {/* Email and Joined database Date info */}
                <div className="mt-4 flex flex-col items-center gap-1 text-center">
                  <p className="text-xs font-medium text-zinc-500 dark:text-white/50 lowercase tracking-wide">
                    {currentUser?.email || session?.user?.email || 'user@zavr.app'}
                  </p>
                  <p className="text-[9px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-[0.12em] mt-1">
                    Member Since: {(() => {
                      const rawJoinDate = currentUser?.createdAt || session?.user?.created_at;
                      if (!rawJoinDate) return 'Recently';
                      try {
                        return format(parseISO(rawJoinDate), 'dd MMMM yyyy');
                      } catch (e) {
                        return 'Recently';
                      }
                    })()}
                  </p>
                  <p className="text-[9px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-[0.12em] mt-0.5">
                    Last Login: {(() => {
                      const rawLoginDate = currentUser?.lastLoginDate || (currentUser as any)?.last_login;
                      if (!rawLoginDate) return 'Now';
                      try {
                        return format(parseISO(rawLoginDate), 'dd MMMM yyyy, HH:mm');
                      } catch (e) {
                        return 'Now';
                      }
                    })()}
                  </p>
                </div>
 
                <button 
                  onClick={() => setIsEditing(true)}
                  className="mt-6 px-5 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] text-zinc-500 dark:text-white/60 hover:text-zinc-950 dark:hover:text-white rounded-full text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Experience Bar */}
        <div className="mt-8 w-64 h-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-full overflow-hidden p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentUser?.xp || 0) % 1000 / 10}%` }}
            className="h-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] rounded-full shadow-[0_0_12px_rgba(255,107,107,0.3)]"
          />
        </div>
        <p className="text-[9px] text-zinc-400 dark:text-white/20 font-bold uppercase tracking-[0.2em] mt-3">
          {1000 - ((currentUser?.xp || 0) % 1000)} XP to Level { (currentUser?.level || 1) + 1 }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: Flame, label: 'Current Streak', value: `${streakData.currentStreak} Days`, color: 'text-[#FF6B6B]', bg: 'bg-[#FF6B6B]/10' },
          { icon: Star, label: 'Lifetime Saved', value: formatCurrency(stats.lifetimeSaved, currentUser?.preferences?.currency || 'INR'), color: 'text-[#FF7C7C]', bg: 'bg-[#FF7C7C]/10' },
          { icon: CheckCircle2, label: 'Goals Completed', value: stats.completedGoals, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Trophy, label: 'Badges Earned', value: stats.totalBadges, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-2xl p-5 space-y-4 shadow-sm"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-black/[0.04] dark:border-white/[0.04]", stat.color, stat.bg)}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-[9px] text-zinc-400 dark:text-white/30 font-bold uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Badges Gallery */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-white/40 uppercase tracking-[0.25em] flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" /> Badges Gallery
          </h3>
          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
            {stats.totalBadges} Unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          {!currentUser?.badges || currentUser.badges.length === 0 ? (
            <div className="col-span-3 bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] p-12 text-center rounded-2xl">
              <Trophy className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-white/10" />
              <p className="text-[9px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-widest">Keep saving to unlock badges!</p>
            </div>
          ) : (
            currentUser.badges.map((badge) => (
              <motion.div 
                key={badge.id}
                whileHover={{ scale: 1.05, y: -3 }}
                className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center space-y-3.5 group transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                  {badge.icon}
                </div>
                <div>
                  <p className="text-[9px] font-bold leading-tight text-zinc-900 dark:text-white uppercase tracking-widest">{badge.name}</p>
                  <p className="text-[8px] text-zinc-400 dark:text-white/20 mt-1.5 font-bold uppercase tracking-wider">
                    {(() => {
                      if (!badge.unlockedAt) return 'Unlocked';
                      try {
                        return format(parseISO(badge.unlockedAt), 'dd/MM/yyyy');
                      } catch (e) {
                        return 'Unlocked';
                      }
                    })()}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="space-y-6">
        <div className="space-y-5">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-white/40 uppercase tracking-[0.25em] flex items-center gap-2">
            <Clock size={16} /> Saving Reminders
          </h3>
          
          <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] p-3 rounded-2xl space-y-2">
            <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors border border-black/[0.04] dark:border-white/[0.04]",
                  currentUser?.preferences?.reminders?.enabled ? "text-[#FF6B6B] bg-[#FF6B6B]/10" : "text-zinc-400 dark:text-white/20 bg-black/[0.02] dark:bg-white/[0.02]"
                )}>
                  <Bell size={18} />
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Enable Reminders</span>
              </div>
              <button 
                onClick={() => {
                  const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                  const reminders = currentPrefs.reminders;
                  updateUser({ 
                    preferences: { 
                      ...currentPrefs, 
                      reminders: { ...reminders, enabled: !reminders.enabled } 
                    } 
                  });
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative p-0.5 border border-black/[0.08] dark:border-white/[0.08]",
                  currentUser?.preferences?.reminders?.enabled ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B]" : "bg-black/[0.04] dark:bg-white/[0.04]"
                )}
              >
                <motion.div 
                  animate={{ x: currentUser?.preferences?.reminders?.enabled ? 24 : 2 }}
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                />
              </button>
            </div>

            {currentUser?.preferences?.reminders?.enabled && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="p-4 space-y-3.5 bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
                  <p className="text-[8px] text-zinc-400 dark:text-white/30 font-bold uppercase tracking-[0.2em]">Routine Frequency</p>
                  <div className="flex p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl">
                    {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => {
                          const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                          const reminders = currentPrefs.reminders;
                          updateUser({ 
                            preferences: { 
                              ...currentPrefs, 
                              reminders: { ...reminders, frequency: freq } 
                            } 
                          });
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[9px] font-bold transition-all uppercase tracking-widest",
                          currentUser?.preferences?.reminders?.frequency === freq ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white" : "text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/50"
                        )}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-zinc-400 dark:text-white/30">
                      <Clock size={18} />
                    </div>
                    <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Reminder Time</span>
                  </div>
                  <input 
                    type="time"
                    value={currentUser?.preferences?.reminders?.time || '09:00'}
                    onChange={(e) => {
                      const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                      const reminders = currentPrefs.reminders;
                      updateUser({ 
                        preferences: { 
                          ...currentPrefs, 
                          reminders: { ...reminders, time: e.target.value } 
                        } 
                  });
                    }}
                    className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] px-4 py-2 rounded-xl text-xs font-bold outline-none text-[#FF6B6B]"
                  />
                </div>

                {currentUser?.preferences?.reminders?.frequency === 'weekly' && (
                  <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-zinc-400 dark:text-white/30">
                        <Calendar size={18} />
                      </div>
                      <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Day of Week</span>
                    </div>
                    <select 
                      value={currentUser?.preferences?.reminders?.day || 'Monday'}
                      onChange={(e) => {
                        const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                        const reminders = currentPrefs.reminders;
                        updateUser({ 
                          preferences: { 
                            ...currentPrefs, 
                            reminders: { ...reminders, day: e.target.value } 
                          } 
                        });
                      }}
                      className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] px-4 py-2 rounded-xl text-xs font-bold outline-none text-[#FF6B6B] appearance-none text-center min-w-[100px]"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}

                {currentUser?.preferences?.reminders?.frequency === 'monthly' && (
                  <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-zinc-400 dark:text-white/30">
                        <Calendar size={18} />
                      </div>
                      <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Day of Month</span>
                    </div>
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      value={currentUser?.preferences?.reminders?.date || 1}
                      onChange={(e) => {
                        const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                        const reminders = currentPrefs.reminders;
                        updateUser({ 
                          preferences: { 
                            ...currentPrefs, 
                            reminders: { ...reminders, date: parseInt(e.target.value) } 
                          } 
                        });
                      }}
                      className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] px-4 py-2 rounded-xl text-xs font-bold outline-none text-[#FF6B6B] w-16 text-center"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-white/40 uppercase tracking-[0.25em] flex items-center gap-2">
            <Settings size={16} /> General Settings
          </h3>
          
          <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] p-3 rounded-2xl space-y-2 shadow-sm">
            <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-[#FF6B6B]">
                  <Globe size={18} />
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Currency</span>
              </div>
              <select 
                value={currentUser?.preferences?.currency}
                onChange={(e) => {
                  const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                  updateUser({ 
                    preferences: { 
                      ...currentPrefs, 
                      currency: e.target.value as any 
                    } 
                  });
                }}
                className="bg-white dark:bg-[#111118] border border-black/[0.06] dark:border-white/[0.08] px-4 py-2 rounded-xl text-xs font-bold outline-none text-[#FF6B6B] appearance-none text-center min-w-[80px]"
              >
                <option value="INR" className="bg-white dark:bg-[#111118] text-zinc-800 dark:text-white">₹ INR</option>
                <option value="USD" className="bg-white dark:bg-[#111118] text-zinc-800 dark:text-white">$ USD</option>
                <option value="EUR" className="bg-white dark:bg-[#111118] text-zinc-800 dark:text-white">€ EUR</option>
              </select>
            </div>

            <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors border border-black/[0.04] dark:border-white/[0.04]",
                  theme === 'dark' ? "text-amber-400 bg-amber-400/10" : "text-[#FF6B6B] bg-[#FF6B6B]/10"
                )}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-white/80">App Theme</span>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-3.5 py-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider text-zinc-800 dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={12} className="animate-[spin_10s_linear_infinite] text-amber-400" />
                    <span>Dark</span>
                  </>
                ) : (
                  <>
                    <Moon size={12} className="text-[#FF6B6B]" />
                    <span>Light</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors border border-black/[0.04] dark:border-white/[0.04]",
                  currentUser?.preferences?.notificationsEnabled ? "text-[#FF6B6B] bg-[#FF6B6B]/10" : "text-zinc-400 dark:text-white/20 bg-black/[0.02] dark:bg-white/[0.02]"
                )}>
                  <Bell size={18} />
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Notifications</span>
              </div>
              <button 
                onClick={() => {
                  const currentPrefs = currentUser?.preferences || DEFAULT_PREFERENCES;
                  updateUser({ 
                    preferences: { 
                      ...currentPrefs, 
                      notificationsEnabled: !currentPrefs.notificationsEnabled 
                    } 
                  });
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative p-0.5 border border-black/[0.08] dark:border-white/[0.08]",
                  currentUser?.preferences?.notificationsEnabled ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B]" : "bg-black/[0.04] dark:bg-white/[0.04]"
                )}
              >
                <motion.div 
                  animate={{ x: currentUser?.preferences?.notificationsEnabled ? 24 : 2 }}
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                />
              </button>
            </div>

            <button 
              onClick={exportData}
              className="w-full p-4 flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-400 dark:text-white/40 group-hover:text-zinc-600 dark:group-hover:text-white/60 transition-colors">
                  <Download size={18} />
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-white/80">Export Data (JSON)</span>
              </div>
              <div className="text-[9px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-widest group-hover:text-zinc-600 dark:group-hover:text-white/50 transition-colors">Download</div>
            </button>
          </div>
        </div>

        <div className="text-center space-y-4 pt-4">
          <div className="flex justify-center gap-6">
            <a 
              href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[9px] text-zinc-400 dark:text-white/20 hover:text-zinc-600 dark:hover:text-white/50 underline font-bold uppercase tracking-[0.2em] transition-all"
            >
              Terms & Conditions
            </a>
            <a 
              href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[9px] text-zinc-400 dark:text-white/20 hover:text-zinc-600 dark:hover:text-white/50 underline font-bold uppercase tracking-[0.2em] transition-all"
            >
              Privacy Policy
            </a>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full py-5 bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/15 border border-[#FF8A8A]/20 text-[#FF6B6B] rounded-2xl font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer text-xs"
        >
          <LogOut size={18} /> Logout
        </button>
      </section>
    </div>
  );
}

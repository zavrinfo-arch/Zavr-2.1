/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AVATARS } from '../constants';
import { formatCurrency, cn } from '../lib/utils';
import { 
  User, Settings, Bell, Globe, 
  Download, LogOut, Flame, Trophy, 
  CheckCircle2, Star, Shield, Zap,
  Camera, Clock, Calendar, X, Check, Lock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
    transactions, setCurrentUser, updateUser, signOut
  } = useStore();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    fullName: currentUser?.fullName || '',
    username: currentUser?.username || '',
    location: currentUser?.location || '',
  });

  const handleSaveProfile = () => {
    if (!editData.fullName || !editData.username) {
      toast.error('Please fill all fields');
      return;
    }
    updateUser({
      fullName: editData.fullName,
      username: editData.username,
      location: editData.location,
    });
    setIsEditing(false);
    toast.success('Profile updated!');
  };

  const stats = {
    lifetimeSaved: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    completedGoals: soloGoals.filter(g => g.completed).length,
    totalBadges: currentUser?.badges.length || 0,
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
    <div className="space-y-10 pb-12">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center pt-6">
        <div className="relative group">
          <div className="w-36 h-36 rounded-full clay bg-surface flex items-center justify-center overflow-hidden">
            <img 
              src={AVATARS.find(a => a.id === currentUser?.avatarId)?.url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUser?.username}`} 
              alt="Avatar"
              className="w-full h-full object-cover p-2"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-12 h-12 clay-coral rounded-2xl flex items-center justify-center text-lg font-black text-white border-4 border-background shadow-2xl">
            {currentUser?.level}
          </div>
          <button 
            onClick={() => setIsAvatarModalOpen(true)}
            className="absolute -top-1 -right-1 p-2.5 clay-inset bg-surface opacity-40 rounded-full border-4 border-background hover:scale-110 transition-all hover:opacity-100"
          >
            <Camera size={18} />
          </button>
        </div>

        <AnimatePresence>
          {isAvatarModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAvatarModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg clay bg-surface p-8 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">Change Avatar</h3>
                  <button onClick={() => setIsAvatarModalOpen(false)} className="p-2 hover:bg-foreground/5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar">
                  {AVATARS.map((avatar) => {
                    const isLocked = avatar.minLevel && (currentUser?.level || 1) < avatar.minLevel;
                    return (
                      <button
                        key={avatar.id}
                        disabled={isLocked}
                        onClick={() => {
                          updateUser({ avatarId: avatar.id });
                          setIsAvatarModalOpen(false);
                          toast.success('Avatar updated!');
                        }}
                        className={cn(
                          "relative aspect-square rounded-2xl flex items-center justify-center clay-card border-2 transition-all overflow-hidden",
                          currentUser?.avatarId === avatar.id ? "border-[#FF6B6B] scale-105" : "border-transparent",
                          isLocked ? "opacity-20 grayscale cursor-not-allowed" : "hover:scale-105"
                        )}
                      >
                        <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover p-1" />
                        {isLocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                            <Lock size={12} className="text-white" />
                          </div>
                        )}
                        {currentUser?.avatarId === avatar.id && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B6B] rounded-full flex items-center justify-center">
                            <Check className="text-white" size={10} strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <div className="mt-8 space-y-4 w-full max-w-xs mx-auto">
          {isEditing ? (
            <div className="space-y-4">
              <div className="clay-inset p-1 rounded-2xl bg-foreground/5">
                <input 
                  type="text"
                  value={editData.fullName}
                  onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none"
                  placeholder="Full Name"
                />
              </div>
              <div className="clay-inset p-1 rounded-2xl bg-foreground/5">
                <input 
                  type="text"
                  value={editData.username}
                  onChange={e => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none opacity-60"
                  placeholder="Username"
                />
              </div>
              <div className="clay-inset p-1 rounded-2xl bg-foreground/5">
                <input 
                  type="text"
                  value={editData.location}
                  onChange={e => setEditData({ ...editData, location: e.target.value })}
                  className="w-full bg-transparent px-4 py-3 text-center font-bold outline-none"
                  placeholder="Location"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 py-3 clay-teal text-black rounded-xl font-bold text-xs uppercase tracking-widest"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 clay-inset rounded-xl font-bold text-xs uppercase tracking-widest opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <h2 className="text-3xl font-bold tracking-tight">{currentUser?.fullName}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <p className="opacity-30 text-xs font-bold uppercase tracking-widest">@{currentUser?.username}</p>
                  <span className="w-1 h-1 rounded-full bg-foreground/10" />
                  <p className="text-[#4ECDC4] text-[10px] font-black uppercase tracking-[0.2em]">{streakData.tier} Tier</p>
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="mt-4 px-6 py-2 clay-inset rounded-full text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all"
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="mt-8 w-64 h-4 clay-inset bg-foreground/5 rounded-full overflow-hidden p-1">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentUser?.xp || 0) % 1000 / 10}%` }}
            className="h-full bg-gradient-to-r from-[#4ECDC4] via-[#FF6B6B] to-[#4ECDC4] rounded-full shadow-[0_0_15px_rgba(78,205,196,0.5)]"
            style={{ backgroundSize: '200% 100%' }}
          />
        </div>
        <p className="text-[9px] opacity-20 font-black uppercase tracking-[0.2em] mt-3">
          {1000 - ((currentUser?.xp || 0) % 1000)} XP to Level { (currentUser?.level || 1) + 1 }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-5">
        {[
          { icon: Flame, label: 'Current Streak', value: `${streakData.currentStreak} Days`, color: 'text-[#FF6B6B]', bg: 'bg-[#FF6B6B]/10' },
          { icon: Star, label: 'Lifetime Saved', value: formatCurrency(stats.lifetimeSaved, currentUser?.preferences.currency), color: 'text-[#FF6B6B]', bg: 'bg-[#FF6B6B]/10' },
          { icon: CheckCircle2, label: 'Goals Completed', value: stats.completedGoals, color: 'text-[#4ECDC4]', bg: 'bg-[#4ECDC4]/10' },
          { icon: Trophy, label: 'Badges Earned', value: stats.totalBadges, color: 'text-[#E2B05E]', bg: 'bg-[#E2B05E]/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="clay p-6 space-y-4"
          >
            <div className={cn("w-12 h-12 rounded-2xl clay-inset flex items-center justify-center", stat.color, stat.bg)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] opacity-20 font-bold uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className="text-xl font-black">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Badges Gallery */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em] flex items-center gap-3">
            <Trophy size={18} className="text-[#E2B05E]" /> Badges Gallery
          </h3>
          <span className="text-[10px] font-bold text-[#E2B05E] bg-[#E2B05E]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            {stats.totalBadges} Unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {currentUser?.badges.length === 0 ? (
            <div className="col-span-3 clay p-16 text-center opacity-20">
              <Trophy className="w-12 h-12 mx-auto mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Keep saving to unlock badges!</p>
            </div>
          ) : (
            currentUser?.badges.map((badge) => (
              <motion.div 
                key={badge.id}
                whileHover={{ scale: 1.05, y: -5 }}
                className="clay p-5 flex flex-col items-center text-center space-y-4 group transition-all"
              >
                <div className="w-16 h-16 rounded-2xl clay-inset flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                  {badge.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black leading-tight opacity-100 uppercase tracking-widest">{badge.name}</p>
                  <p className="text-[8px] opacity-20 mt-2 font-bold uppercase tracking-wider">
                    {format(parseISO(badge.unlockedAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="space-y-8">
        <div className="space-y-6">
          <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em] flex items-center gap-3">
            <Clock size={18} /> Saving Reminders
          </h3>
          
          <div className="clay p-3 space-y-2">
            <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl clay-inset flex items-center justify-center transition-colors",
                  currentUser?.preferences?.reminders?.enabled ? "text-[#4ECDC4]" : "opacity-10"
                )}>
                  <Bell size={20} />
                </div>
                <span className="text-sm font-bold opacity-80">Enable Reminders</span>
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
                  "w-14 h-7 rounded-full transition-all relative clay-inset",
                  currentUser?.preferences?.reminders?.enabled ? "bg-[#4ECDC4]" : "bg-foreground/10"
                )}
              >
                <motion.div 
                  animate={{ x: currentUser?.preferences?.reminders?.enabled ? 28 : 4 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full clay shadow-xl"
                />
              </button>
            </div>

            {currentUser?.preferences?.reminders?.enabled && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="p-5 space-y-4 clay-inset rounded-2xl bg-foreground/5">
                  <p className="text-[9px] opacity-20 font-black uppercase tracking-[0.2em]">Routine Frequency</p>
                  <div className="flex p-1.5 clay-inset rounded-xl bg-foreground/5">
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
                          "flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest",
                          currentUser?.preferences?.reminders?.frequency === freq ? "clay-coral text-white" : "opacity-20 hover:opacity-40"
                        )}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center opacity-20">
                      <Clock size={20} />
                    </div>
                    <span className="text-sm font-bold opacity-80">Reminder Time</span>
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
                    className="bg-foreground/5 px-4 py-2 rounded-xl text-xs font-black outline-none text-[#4ECDC4] clay-inset"
                  />
                </div>

                {currentUser?.preferences?.reminders?.frequency === 'weekly' && (
                  <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center opacity-20">
                        <Calendar size={20} />
                      </div>
                      <span className="text-sm font-bold opacity-80">Day of Week</span>
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
                      className="bg-foreground/5 px-4 py-2 rounded-xl text-xs font-black outline-none text-[#4ECDC4] clay-inset appearance-none text-center min-w-[100px]"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}

                {currentUser?.preferences?.reminders?.frequency === 'monthly' && (
                  <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center opacity-20">
                        <Calendar size={20} />
                      </div>
                      <span className="text-sm font-bold opacity-80">Day of Month</span>
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
                      className="bg-foreground/5 px-4 py-2 rounded-xl text-xs font-black outline-none text-[#4ECDC4] clay-inset w-16 text-center"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em] flex items-center gap-3">
            <Settings size={18} /> General Settings
          </h3>
          
          <div className="clay p-3 space-y-2">
            <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center text-[#4ECDC4]">
                  <Globe size={20} />
                </div>
                <span className="text-sm font-bold opacity-80">Currency</span>
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
                className="bg-foreground/5 px-4 py-2 rounded-xl text-xs font-black outline-none text-[#4ECDC4] clay-inset appearance-none text-center min-w-[80px]"
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>

            <div className="p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl clay-inset flex items-center justify-center transition-colors",
                  currentUser?.preferences?.notificationsEnabled ? "text-[#FF6B6B]" : "opacity-10"
                )}>
                  <Bell size={20} />
                </div>
                <span className="text-sm font-bold opacity-80">Notifications</span>
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
                  "w-14 h-7 rounded-full transition-all relative clay-inset",
                  currentUser?.preferences?.notificationsEnabled ? "bg-[#4ECDC4]" : "bg-foreground/10"
                )}
              >
                <motion.div 
                  animate={{ x: currentUser?.preferences?.notificationsEnabled ? 28 : 4 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full clay shadow-xl"
                />
              </button>
            </div>

            <button 
              onClick={exportData}
              className="w-full p-5 flex items-center justify-between clay-inset rounded-2xl bg-foreground/5 hover:bg-foreground/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl clay-inset flex items-center justify-center opacity-20 group-hover:opacity-40 transition-colors">
                  <Download size={20} />
                </div>
                <span className="text-sm font-bold opacity-80">Export Data (JSON)</span>
              </div>
              <div className="text-[10px] font-black opacity-20 uppercase tracking-widest">Download</div>
            </button>
          </div>
        </div>

        <div className="text-center space-y-4 pt-4">
          <div className="flex justify-center gap-6">
            <a 
              href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[10px] opacity-20 hover:opacity-100 underline font-black uppercase tracking-[0.2em] transition-all"
            >
              Terms & Conditions
            </a>
            <a 
              href="https://zavrinfo-arch.github.io/zavr-privacy-policy/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[10px] opacity-20 hover:opacity-100 underline font-black uppercase tracking-[0.2em] transition-all"
            >
              Privacy Policy
            </a>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full py-6 clay bg-[#FF6B6B]/10 rounded-3xl text-[#FF6B6B] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[#FF6B6B]/20 transition-all active:scale-[0.98] border-2 border-[#FF6B6B]/20"
        >
          <LogOut size={22} /> Logout
        </button>
      </section>
    </div>
  );
}

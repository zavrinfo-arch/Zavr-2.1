/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { AVATARS_50 } from '../constants/avatars';
import { cn } from '../lib/utils';
import { Check, ArrowRight, ArrowLeft, Loader2, Sparkles, User, Palette, Camera, ShieldCheck, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

const STYLE_LABELS = {
  'gen-z': { label: 'Gen-Z Modern', icon: Sparkles, color: 'text-purple-500' },
  'classic': { label: 'Classic Premium', icon: User, color: 'text-blue-500' },
  'bw': { label: 'B&W Artistic', icon: Camera, color: 'text-gray-500' },
  'minimal': { label: 'Minimalist', icon: Palette, color: 'text-teal-500' },
};

export default function AvatarSelection() {
  const navigate = useNavigate();
  const { currentUser, updateUser, refreshData, signOut } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(currentUser?.avatarId?.toString() || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'gen-z' | 'classic' | 'bw' | 'minimal'>('gen-z');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        console.log('[AvatarSelection] userId set:', user.id);
      }
    };
    init();

    if (currentUser?.avatarId) {
      setSelectedId(currentUser.avatarId.toString());
    }
  }, [currentUser]);

  const saveAvatar = async () => {
    if (!userId) {
      toast.error('Authentication required');
      return;
    }

    if (!selectedId) {
      toast.error('Please select an avatar');
      return;
    }

    setLoading(true);
    console.log('[DEBUG] Saving avatar for user:', userId);
    try {
      const selectedAvatar = AVATARS_50.find(a => a.id === selectedId);
      if (!selectedAvatar) throw new Error('Invalid avatar selection');

      // 1. Update local store AND DB (Await both for consistency)
      console.log('[DEBUG] Updating store and remote state: onboardingCompleted = true');
      await updateUser({
        avatar: selectedAvatar.url,
        avatarId: selectedId as any,
        onboardingCompleted: true,
      });

      // 2. Verify update success before navigating
      const freshUser = useStore.getState().currentUser;
      console.log('[DEBUG] Store updated. onboardingCompleted:', freshUser?.onboardingCompleted);

      if (!freshUser?.onboardingCompleted) {
        console.error('[DEBUG] Update failed to stick in store!');
        toast.error('Local sync issue. Retrying...');
        await refreshData();
      }

      toast.success('Your character is ready!');
      
      // Use navigate() for soft-navigation which preserves store state
      // Use replace: true to prevent back-button loops
      console.log('[DEBUG] Redirecting to dashboard in 800ms...');
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 800);
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error('Sync failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAvatars = AVATARS_50.filter(a => a.style === activeTab);

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 clay-card rounded-2xl opacity-60 hover:opacity-100 transition-opacity"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight serif-heading">Select Hero</h1>
            <p className="text-xs opacity-40 font-bold uppercase tracking-widest">List Model View</p>
          </div>
        </div>
        
        {/* Reload Preview Support (Logout) */}
        <button 
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="text-[9px] font-black uppercase tracking-widest px-4 py-2 clay-card opacity-40 hover:opacity-100 transition-all"
        >
          Reset / Logout
        </button>
      </div>

      {/* Style Selector */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {(Object.keys(STYLE_LABELS) as Array<keyof typeof STYLE_LABELS>).map((style) => {
          const Icon = STYLE_LABELS[style].icon;
          return (
            <button
              key={style}
              onClick={() => setActiveTab(style)}
              className={cn(
                "px-6 py-4 rounded-2xl flex items-center gap-3 transition-all whitespace-nowrap active:scale-95",
                activeTab === style 
                  ? "clay-card bg-surface shadow-xl ring-2 ring-coral/20" 
                  : "opacity-40 hover:opacity-60"
              )}
            >
              <Icon size={16} className={STYLE_LABELS[style].color} />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                {STYLE_LABELS[style].label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Avatar Grid (Icons View) */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pb-32">
          <AnimatePresence mode="popLayout">
            {filteredAvatars.map((avatar, index) => (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedId(avatar.id)}
                className={cn(
                  "relative aspect-square rounded-[2rem] transition-all group overflow-visible",
                  selectedId === avatar.id 
                    ? "clay-inset bg-surface border-2 border-coral shadow-2xl scale-110 z-10" 
                    : "clay-card hover:bg-foreground/5 hover:scale-105"
                )}
              >
                {/* Avatar Preview */}
                <div className="w-full h-full p-2 relative flex items-center justify-center">
                  <img 
                    src={avatar.url} 
                    alt={avatar.id} 
                    className="w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  
                  {selectedId === avatar.id && (
                    <motion.div 
                      layoutId="check"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-coral shadow-lg flex items-center justify-center border-2 border-white z-20"
                    >
                      <Check className="text-white" size={10} strokeWidth={4} />
                    </motion.div>
                  )}
                </div>

                {/* Micro Label */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                   <p className={cn(
                     "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors",
                     selectedId === avatar.id ? "bg-coral text-white" : "bg-foreground/5 opacity-40"
                   )}>
                     {avatar.id.split('_').pop()?.toUpperCase()}
                   </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 left-6 right-6 z-50">
        <motion.button
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          disabled={!selectedId || loading}
          onClick={saveAvatar}
          className={cn(
            "w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.3em] shadow-2xl transition-all",
            !selectedId || loading 
              ? "bg-foreground/10 opacity-50 cursor-not-allowed" 
              : "clay-coral text-white scale-105"
          )}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              Confirm Hero <ArrowRight size={20} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

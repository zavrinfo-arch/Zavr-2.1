/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { AVATARS_50, getAvatarUrl, getAvatarIndex } from '../constants/avatars';
import { cn } from '../lib/utils';
import { Check, ArrowRight, ArrowLeft, Loader2, Sparkles, User, Palette, Camera, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

const CATEGORY_LABELS = {
  'all': { label: 'All 50 Avatars', icon: Sparkles, color: 'text-purple-500' },
  'collection_1': { label: '1 - 15', icon: User, color: 'text-blue-500' },
  'collection_2': { label: '16 - 30', icon: Camera, color: 'text-amber-500' },
  'collection_3': { label: '31 - 40', icon: Palette, color: 'text-teal-500' },
  'collection_4': { label: '41 - 50', icon: Zap, color: 'text-emerald-500' },
};

export default function AvatarSelection() {
  const navigate = useNavigate();
  const { currentUser, updateUser, refreshData, signOut } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  
  // Initial selected avatar logic
  const initialIndex = getAvatarIndex(currentUser?.avatarId?.toString() || currentUser?.avatar);
  const [selectedId, setSelectedId] = useState<string>(`avatar_${initialIndex}`);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof CATEGORY_LABELS>('all');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    init();

    if (currentUser?.avatarId || currentUser?.avatar) {
      const idx = getAvatarIndex(currentUser.avatarId?.toString() || currentUser.avatar);
      setSelectedId(`avatar_${idx}`);
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
    try {
      const selectedAvatar = AVATARS_50.find(a => a.id === selectedId) || AVATARS_50[0];
      const avatarId = selectedAvatar.id;
      const avatarUrl = selectedAvatar.image;

      // 1. Update Supabase profiles table with avatar_id and avatar_url
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          avatar_id: avatarId,
          avatar_url: avatarUrl,
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (dbError) {
        console.warn('[AvatarSelection] Supabase update warning:', dbError.message);
      }

      // 2. Update local Zustand store
      await updateUser({
        avatar: avatarUrl,
        avatarId: avatarId as any,
        onboardingCompleted: true,
      });

      toast.success('Your hero avatar is set!');
      
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 600);
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error('Sync failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAvatars = activeTab === 'all' 
    ? AVATARS_50 
    : AVATARS_50.filter(a => a.style === activeTab);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0f] text-zinc-900 dark:text-white flex flex-col p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.05] text-zinc-700 dark:text-white rounded-2xl opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight serif-heading">Select Hero</h1>
            <p className="text-xs text-zinc-500 dark:text-[#94A3B8] font-bold uppercase tracking-widest">50 Custom Avatars</p>
          </div>
        </div>
        
        {/* Reset / Logout */}
        <button 
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-white/40 rounded-xl opacity-40 hover:opacity-100 transition-all cursor-pointer"
        >
          Reset / Logout
        </button>
      </div>

      {/* Collection Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((style) => {
          const Icon = CATEGORY_LABELS[style].icon;
          return (
            <button
              key={style}
              onClick={() => setActiveTab(style)}
              className={cn(
                "px-5 py-3.5 rounded-2xl flex items-center gap-2.5 transition-all whitespace-nowrap active:scale-95 cursor-pointer",
                activeTab === style 
                  ? "bg-white dark:bg-[#111118] text-zinc-900 dark:text-white shadow-xl ring-2 ring-[#FF6B6B]/40 border border-[#FF8A8A]/20" 
                  : "bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.04] dark:border-white/[0.04] text-zinc-500 dark:text-white opacity-40 hover:opacity-100"
              )}
            >
              <Icon size={16} className={CATEGORY_LABELS[style].color} />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                {CATEGORY_LABELS[style].label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Avatar Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 pb-32">
          <AnimatePresence mode="popLayout">
            {filteredAvatars.map((avatar, index) => {
              const isSelected = selectedId === avatar.id;
              return (
                <motion.button
                  key={avatar.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  onClick={() => setSelectedId(avatar.id)}
                  className={cn(
                    "relative aspect-square rounded-[2rem] transition-all group overflow-visible cursor-pointer",
                    isSelected 
                      ? "bg-white dark:bg-[#111118] border-2 border-[#FF8A8A] shadow-lg dark:shadow-[0_0_15px_rgba(255,107,107,0.4)] scale-105 z-10" 
                      : "bg-white dark:bg-[#111118]/40 border border-black/[0.06] dark:border-white/[0.04] hover:border-[#FF6B6B]/40 hover:scale-102"
                  )}
                >
                  {/* Avatar Image */}
                  <div className="w-full h-full p-2.5 relative flex items-center justify-center">
                    <img 
                      src={avatar.image} 
                      alt={avatar.name} 
                      className="w-full h-full object-contain drop-shadow-md rounded-full"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    
                    {isSelected && (
                      <motion.div 
                        layoutId="check"
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] shadow-lg flex items-center justify-center border-2 border-white dark:border-[#111118] z-20"
                      >
                        <Check className="text-white" size={10} strokeWidth={4} />
                      </motion.div>
                    )}
                  </div>

                  {/* Micro Label */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <p className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors",
                      isSelected ? "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white" : "bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-[#94A3B8] opacity-50"
                    )}>
                      {avatar.name}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Confirm Button */}
      <div className="fixed bottom-8 left-6 right-6 z-50 max-w-lg mx-auto">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          disabled={!selectedId || loading}
          onClick={saveAvatar}
          className={cn(
            "w-full py-5 rounded-[2rem] flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all cursor-pointer",
            !selectedId || loading 
              ? "bg-white/10 opacity-50 cursor-not-allowed text-white/40" 
              : "bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white hover:from-[#FF6B6B] hover:to-[#FF7C7C] shadow-[0_8px_25px_rgba(255,107,107,0.5)]"
          )}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              Confirm Avatar <ArrowRight size={20} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}


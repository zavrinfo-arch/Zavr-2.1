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
import { supabase } from '../lib/supabase';

const STYLE_LABELS = {
  'gen-z': { label: 'Gen-Z Modern', icon: Sparkles, color: 'text-purple-500' },
  'classic': { label: 'Classic Premium', icon: User, color: 'text-blue-500' },
  'bw': { label: 'B&W Artistic', icon: Camera, color: 'text-gray-500' },
  'minimal': { label: 'Minimalist', icon: Palette, color: 'text-teal-500' },
};

export default function AvatarSelection() {
  const navigate = useNavigate();
  const { currentUser, updateUser, refreshData, signOut } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(currentUser?.avatarId?.toString() || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'gen-z' | 'classic' | 'bw' | 'minimal'>('gen-z');

  useEffect(() => {
    if (currentUser?.avatarId) {
      setSelectedId(currentUser.avatarId.toString());
    }
  }, [currentUser]);

  const saveAvatar = async () => {
    if (!selectedId) {
      toast.error('Please select an avatar');
      return;
    }

    setLoading(true);
    console.log('[DEBUG] Saving avatar session check...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Session expired. Please log in again.');
        signOut();
        navigate('/auth');
        return;
      }

      const selectedAvatar = AVATARS_50.find(a => a.id === selectedId);
      if (!selectedAvatar) throw new Error('Invalid avatar selection');

      // 1. Update local store AND DB (Await both for consistency)
      console.log('[DEBUG] Updating store and remote state: onboardingCompleted = true');
      await updateUser({
        avatar: selectedAvatar.url,
        avatarId: selectedId as any,
        onboardingCompleted: true,
      });

      toast.success('Your character is ready!');
      
      // Use navigate() for soft-navigation which preserves store state
      // Use replace: true to prevent back-button loops
      console.log('[DEBUG] Redirecting to dashboard...');
      navigate('/home', { replace: true });
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

      {/* List Model Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-4 pb-32">
          <AnimatePresence mode="popLayout">
            {filteredAvatars.map((avatar, index) => (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedId(avatar.id)}
                className={cn(
                  "w-full flex items-center gap-6 p-4 rounded-[2rem] transition-all relative group",
                  selectedId === avatar.id 
                    ? "clay-inset bg-surface border-2 border-coral shadow-2xl" 
                    : "clay-card hover:bg-foreground/5 hover:translate-x-2"
                )}
              >
                {/* Avatar Preview */}
                <div className="relative">
                  <div className={cn(
                    "w-20 h-20 rounded-3xl overflow-hidden clay-inset p-1 transition-transform group-hover:scale-110",
                    selectedId === avatar.id ? "ring-4 ring-coral/20" : ""
                  )}>
                    <img 
                      src={avatar.url} 
                      alt={avatar.id} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {selectedId === avatar.id && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-coral shadow-lg flex items-center justify-center border-2 border-white">
                      <Check className="text-white" size={14} strokeWidth={4} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      "font-black text-base tracking-tight",
                      selectedId === avatar.id ? "text-coral" : "opacity-80"
                    )}>
                      {avatar.id.replace(/_/g, ' ').toUpperCase()}
                    </h4>
                    {index === 0 && <span className="text-[8px] font-black bg-coral/10 text-coral px-2 py-0.5 rounded-full uppercase">Hero</span>}
                  </div>
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">
                    {STYLE_LABELS[activeTab].label} Series
                  </p>
                  
                  {/* Stats Placeholder for "Better" gaming look */}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <Zap size={10} className="text-amber-500" />
                      <span className="text-[10px] font-black opacity-30">Power Lv.{10 + (index % 5)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck size={10} className="text-emerald-500" />
                      <span className="text-[10px] font-black opacity-30">V.Rare</span>
                    </div>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-4">
                  <ArrowRight size={20} className="text-coral" />
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

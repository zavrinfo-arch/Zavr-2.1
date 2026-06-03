import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { AVATARS_50, AvatarData } from '../../constants/avatars';
import { NeoLuxuryStyles } from './styles';

interface AvatarSelectorProps {
  selectedAvatar: AvatarData;
  onSelect: (avatar: AvatarData) => void;
}

/**
 * AvatarSelector
 * Renders a list of elegant, premium minimalist avatars.
 * Employs scale transitions and subtle outline rings for selection styling.
 */
export default function AvatarSelector({ selectedAvatar, onSelect }: AvatarSelectorProps) {
  return (
    <div className="space-y-6 animate-fadeIn duration-500">
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Choose your avatar</h2>
        <p className="text-xs text-[#8E8E93] uppercase tracking-[0.1em]">Select a visual character to personalize your savings feed</p>
      </div>

      <div 
        id="avatar-grid" 
        className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-[420px] overflow-y-auto pr-1 hide-scrollbar pb-6"
      >
        {AVATARS_50.map((avatar) => {
          const isSelected = selectedAvatar.id === avatar.id;
          return (
            <motion.button
              key={avatar.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(avatar)}
              className={`relative aspect-square rounded-2xl transition-all flex items-center justify-center p-2.5 bg-white/[0.01] border hover:bg-white/[0.03] ${
                isSelected 
                  ? "bg-white/[0.04] border-white/20 shadow-[0_12px_24px_rgba(255,255,255,0.05)] scale-105 z-10" 
                  : "border-white/[0.03] opacity-50 hover:opacity-100"
              }`}
            >
              <img 
                src={avatar.url} 
                alt={avatar.id} 
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" 
                referrerPolicy="no-referrer" 
              />
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-lg border border-black">
                  <Check size={10} strokeWidth={4} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

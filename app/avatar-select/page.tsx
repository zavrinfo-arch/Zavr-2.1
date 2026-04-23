'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { handleContinue } from './handleContinue';
import { getOnboardingCookie } from '@/lib/onboarding';

const AVATARS = [
  { id: 'avatar_1', src: '/avatars/1.png', alt: 'Avatar 1' },
  { id: 'avatar_2', src: '/avatars/2.png', alt: 'Avatar 2' },
  { id: 'avatar_3', src: '/avatars/3.png', alt: 'Avatar 3' },
];

export default function AvatarSelectPage() {
  const supabase = createClientComponentClient();

  const [userId, setUserId]                     = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null);
  const [buttonDisabled, setButtonDisabled]     = useState(false);

  // Ref = source of truth for navigation logic (survives re-renders)
  const avatarIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      // ── Already done? Skip the page entirely ────────────────────────────
      if (getOnboardingCookie()) {
        console.log('[AvatarSelectPage] cookie says done — skipping to dashboard');
        window.location.href = '/dashboard';
        return;
      }

      // ── Get current user ─────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AvatarSelectPage] No authenticated user');
        window.location.href = '/login';
        return;
      }

      // ── Check Supabase profile in case cookie is missing but DB is done ──
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, avatar_id')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_completed) {
        console.log('[AvatarSelectPage] DB says done — skipping to dashboard');
        window.location.href = '/dashboard';
        return;
      }

      setUserId(user.id);
      console.log('[AvatarSelectPage] userId set:', user.id);
    }

    init();
  }, []); // Empty deps — runs once, never resets selection state

  function selectAvatar(id: string, src: string) {
    avatarIdRef.current = id;   // ref — for navigation logic
    setSelectedAvatarId(id);    // state — for UI highlight
    setPreviewUrl(src);
    console.log('[AvatarSelectPage] selected:', id);
  }

  function onClickContinue() {
    const avatarId = avatarIdRef.current ?? selectedAvatarId;
    console.log('[AvatarSelectPage] Continue clicked — avatarId:', avatarId, 'userId:', userId);
    handleContinue(userId!, avatarId, previewUrl, setButtonDisabled);
  }

  return (
    <div>
      <h1>Choose your avatar</h1>

      {previewUrl && (
        <img
          key={selectedAvatarId}
          src={previewUrl}
          alt="Selected avatar preview"
          width={120}
          height={120}
        />
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        {AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => selectAvatar(avatar.id, avatar.src)}
            style={{
              border: selectedAvatarId === avatar.id ? '3px solid blue' : '2px solid gray',
              background: 'none',
              padding: 4,
              cursor: 'pointer',
            }}
          >
            <img src={avatar.src} alt={avatar.alt} width={80} height={80} />
          </button>
        ))}
      </div>

      <button
        onClick={onClickContinue}
        disabled={buttonDisabled || !selectedAvatarId || !userId}
        style={{ marginTop: 24, opacity: buttonDisabled ? 0.5 : 1 }}
      >
        {buttonDisabled ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}
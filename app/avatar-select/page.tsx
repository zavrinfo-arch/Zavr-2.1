'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { handleContinue } from './handleContinue';
import { getOnboardingCookie, setOnboardingCookie } from '@/lib/onboarding';

const AVATARS = [
  { id: 'avatar_1', src: '/avatars/1.png', alt: 'Avatar 1' },
  { id: 'avatar_2', src: '/avatars/2.png', alt: 'Avatar 2' },
  { id: 'avatar_3', src: '/avatars/3.png', alt: 'Avatar 3' },
];

import { useRouter } from 'next/navigation';

export default function AvatarSelectPage() {
  const router = useRouter();
  const [userId, setUserId]                     = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null);
  const [buttonDisabled, setButtonDisabled]     = useState(false);

  // Ref = source of truth for navigation logic (survives re-renders)
  const avatarIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      // ── Get current user first ───────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AvatarSelectPage] No authenticated user');
        router.push('/login');
        return;
      }

      // ── Check Supabase profile (Primary Source of Truth) ─────────────────
      console.log('[AvatarSelectPage] Checking profile in DB...');
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, avatar_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[AvatarSelectPage] Profile fetch error:', error);
      }

      if (profile?.onboarding_completed) {
        console.log('[AvatarSelectPage] DB says onboarding complete — skipping to home');
        // Ensure cookie is in sync if it was missing
        setOnboardingCookie(profile.avatar_id || '1');
        router.push('/home');
        return;
      }

      // ── Check cookie as fallback/optimization ────────────────────────────
      if (getOnboardingCookie()) {
        console.log('[AvatarSelectPage] Cookie says done — skipping to home');
        router.push('/home');
        return;
      }

      setUserId(user.id);
      console.log('[AvatarSelectPage] User needs onboarding. userId set:', user.id);
    }

    init();
  }, [router]);

  function selectAvatar(id: string, src: string) {
    avatarIdRef.current = id;   // ref — for navigation logic
    setSelectedAvatarId(id);    // state — for UI highlight
    setPreviewUrl(src);
    console.log('[AvatarSelectPage] selected:', id);
  }

  function onClickContinue() {
    if (!userId) {
      console.error('[AvatarSelectPage] Cannot continue: userId is null');
      return;
    }
    const avatarId = avatarIdRef.current ?? selectedAvatarId;
    console.log('[AvatarSelectPage] Continue clicked — avatarId:', avatarId, 'userId:', userId);
    handleContinue(userId, avatarId, previewUrl, setButtonDisabled);
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
import { supabase } from '../src/lib/supabaseClient';

export const ONBOARDING_COOKIE = 'onboarding_complete';
export const AVATAR_COOKIE     = 'selected_avatar';
export const MAX_REDIRECT_ATTEMPTS = 3;

/** Call this ONLY after the Supabase write has confirmed success */
export function setOnboardingCookie(avatarId: string): boolean {
  try {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const base = `path=/; expires=${expires.toUTCString()}; SameSite=Strict`;

    document.cookie = `${ONBOARDING_COOKIE}=true; ${base}`;
    document.cookie = `${AVATAR_COOKIE}=${encodeURIComponent(avatarId)}; ${base}`;

    // Verify the write actually landed
    const verified = document.cookie.includes(`${ONBOARDING_COOKIE}=true`);
    console.log('[onboarding] cookie write verified:', verified, '| cookies:', document.cookie);
    return verified;
  } catch (err) {
    console.error('[onboarding] cookie write failed:', err);
    return false;
  }
}

/** Persist onboarding completion to Supabase profiles table.
 *  Returns true only if the DB row was actually updated. */
export async function persistOnboardingToSupabase(
  userId: string,
  avatarId: string,
  avatarUrl?: string
): Promise<boolean> {
  console.log('[onboarding] writing to Supabase...', { userId, avatarId, avatarUrl });

  const payload: any = {
    avatar_id: avatarId,
    onboarding_completed: true,
    updated_at: new Date().toISOString()
  };

  if (avatarUrl) payload.avatar_url = avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (error) {
    console.error('[onboarding] Supabase update failed:', error.message);
    return false;
  }

  // Read back to confirm propagation
  console.log('[onboarding] Re-fetching profile to confirm update...');
  const { data, error: readError } = await supabase
    .from('profiles')
    .select('onboarding_completed, avatar_id, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[onboarding] Supabase read-back error:', readError);
    return false;
  }

  console.log('[onboarding] Data read back:', data);

  if (!data?.onboarding_completed) {
    console.error('[onboarding] Supabase read-back failed: onboarding_completed is still false');
    return false;
  }

  console.log('[onboarding] Supabase write confirmed success');
  return true;
}

export function getOnboardingCookie(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes(`${ONBOARDING_COOKIE}=true`);
}

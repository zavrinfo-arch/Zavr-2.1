import { createClient } from './supabase/client';

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
  avatarId: string
): Promise<boolean> {
  const supabase = createClient();
  console.log('[onboarding] writing to Supabase...', { userId, avatarId });

  const { error } = await supabase
    .from('user_profiles')
    .update({
      avatar_id: avatarId,
      onboarding_completed: true,
    })
    .eq('id', userId);

  if (error) {
    console.error('[onboarding] Supabase write failed:', error.message);
    return false;
  }

  // Read back to confirm propagation
  const { data, error: readError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed, avatar_id')
    .eq('id', userId)
    .single();

  if (readError || !data?.onboarding_completed) {
    console.error('[onboarding] Supabase read-back failed or value not propagated:', readError);
    return false;
  }

  console.log('[onboarding] Supabase confirmed:', data);
  return true;
}

export function getOnboardingCookie(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes(`${ONBOARDING_COOKIE}=true`);
}

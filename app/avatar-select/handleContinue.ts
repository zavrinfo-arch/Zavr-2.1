import {
  persistOnboardingToSupabase,
  setOnboardingCookie,
  MAX_REDIRECT_ATTEMPTS,
} from '@/lib/onboarding';

let redirectLock     = false;
let redirectAttempts = 0;

export async function handleContinue(
  userId: string,
  avatarId: string | null,
  previewUrl: string | null,
  setButtonDisabled: (v: boolean) => void
) {
  console.log('[handleContinue] START', { userId, avatarId, redirectLock, redirectAttempts });

  if (!avatarId) {
    console.warn('[handleContinue] No avatar selected');
    return;
  }
  if (!userId) {
    console.error('[handleContinue] No userId — user not authenticated');
    return;
  }
  if (redirectLock) {
    console.warn('[handleContinue] Locked — duplicate call blocked');
    return;
  }
  if (redirectAttempts >= MAX_REDIRECT_ATTEMPTS) {
    console.error('[handleContinue] MAX_REDIRECT_ATTEMPTS hit — forcing entry');
    window.location.href = '/dashboard?force_dashboard=1';
    return;
  }
  if ((window as any).__FORCE_REDIRECT === true) {
    console.log('[handleContinue] __FORCE_REDIRECT override');
    window.location.href = '/dashboard?force_dashboard=1';
    return;
  }

  redirectLock = true;
  redirectAttempts++;
  setButtonDisabled(true);

  try {
    // ── Step 1: Write to Supabase and CONFIRM it succeeded ────────────────
    console.log('[handleContinue] Step 1 — writing to Supabase');
    const dbSuccess = await persistOnboardingToSupabase(userId, avatarId, previewUrl || undefined);

    if (!dbSuccess) {
      throw new Error('Supabase write or read-back failed');
    }
    console.log('[handleContinue] Step 1 ✓ Supabase confirmed');

    // ── Step 2: NOW write the cookie (middleware reads this) ──────────────
    console.log('[handleContinue] Step 2 — writing cookie');
    const cookieSuccess = setOnboardingCookie(avatarId);

    if (!cookieSuccess) {
      // Cookie failed but DB succeeded — use force param as fallback
      console.warn('[handleContinue] Step 2 ✗ cookie failed — using home');
      window.location.href = '/home?force_dashboard=1';
      return;
    }
    console.log('[handleContinue] Step 2 ✓ cookie confirmed');

    // ── Step 3: Navigate — AFTER both DB and cookie are confirmed ─────────
    console.log('[handleContinue] Step 3 — navigating');
    window.location.href = '/home';

  } catch (err) {
    console.error('[handleContinue] ERROR:', err);
    redirectLock = false;
    redirectAttempts--;
    setButtonDisabled(false);
  }
}
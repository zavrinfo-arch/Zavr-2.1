import { supabase } from '../lib/supabaseClient';

export interface AuthProfile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  last_login_at: string | null;
  last_active_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: any;
  session: any;
  profile: AuthProfile | null;
}

const PROFILE_CACHE_KEY = 'auth_profile_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * LocalStorage cache helper for user profiles
 */
export function getCachedProfile(userId: string): AuthProfile | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      console.log('✅ Found valid cached profile for:', userId);
      return parsed.profile;
    } else {
      localStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
    }
  } catch (e) {
    console.warn('⚠️ Error reading cached profile:', e);
  }
  return null;
}

export function cacheProfile(profile: AuthProfile): void {
  if (!profile || !profile.id) return;
  try {
    localStorage.setItem(
      `${PROFILE_CACHE_KEY}_${profile.id}`,
      JSON.stringify({
        timestamp: Date.now(),
        profile,
      })
    );
  } catch (e) {
    console.warn('⚠️ Error caching profile:', e);
  }
}

export function clearProfileCache(userId: string): void {
  try {
    localStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
  } catch (e) {
    // ignore
  }
}

/**
 * Retry wrapper helper
 */
async function retryOperation<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (err?.status === 400 || err?.message?.includes('Invalid login credentials') || err?.message?.includes('not confirmed')) {
        throw err;
      }
      console.warn(`🔄 Retry attempt ${attempt}/${retries} failed:`, err.message || err);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Checks if an account exists in the profiles table by email or username.
 * Optimized with exact indexing and retry logic.
 */
export async function checkAccountExists(
  emailOrUsername: string
): Promise<{ exists: boolean; email?: string; profile: AuthProfile | null }> {
  return retryOperation(async () => {
    const isEmail = emailOrUsername.includes('@');
    const cleanedInput = emailOrUsername.toLowerCase().trim();

    let query = supabase
      .from('profiles')
      .select('id, email, username, full_name, avatar_url, onboarding_completed, last_login_at, last_active_at, login_count, created_at, updated_at');

    if (isEmail) {
      query = query.eq('email', cleanedInput);
    } else {
      query = query.eq('username', cleanedInput);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[authService.checkAccountExists] DB Error:', error);
      throw new Error(error.message);
    }

    if (!data) {
      return { exists: false, profile: null };
    }

    const authProf = data as AuthProfile;
    cacheProfile(authProf);

    return {
      exists: true,
      email: data.email || undefined,
      profile: authProf
    };
  }, 3, 1000);
}

/**
 * Authenticates user using email and password with retry and caching logic.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  return retryOperation(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      throw error;
    }

    // Try fetching profile from DB with cached fallback
    let profile: AuthProfile | null = null;
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profileErr && profileData) {
        profile = profileData as AuthProfile;
        cacheProfile(profile);
      } else {
        profile = getCachedProfile(data.user.id);
      }
    } catch (e) {
      console.warn('⚠️ Direct profile query failed during login, using cache:', e);
      profile = getCachedProfile(data.user.id);
    }

    return {
      user: data.user,
      session: data.session,
      profile
    };
  }, 3, 1000);
}

/**
 * Resolves a username to an email and authenticates.
 */
export async function loginWithUsername(
  username: string,
  password: string
): Promise<AuthResponse> {
  return retryOperation(async () => {
    const account = await checkAccountExists(username);
    if (!account.exists || !account.email) {
      throw new Error('Account not found. Please sign up.');
    }
    return await loginWithEmail(account.email, password);
  }, 3, 1000);
}

/**
 * Updates profiles stats: last_login_at, last_active_at, and increments login_count
 */
export async function updateLoginStats(
  userId: string,
  currentLoginCount: number
): Promise<AuthProfile | null> {
  try {
    const nowISO = new Date().toISOString();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        last_login_at: nowISO,
        last_active_at: nowISO,
        login_count: (currentLoginCount || 0) + 1
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[authService.updateLoginStats] Error updating profile login stats:', error);
      throw error;
    }

    if (data) {
      cacheProfile(data as AuthProfile);
    }

    return data as AuthProfile | null;
  } catch (err: any) {
    console.error('[authService.updateLoginStats] Unexpected exception:', err);
    throw err;
  }
}

/**
 * Forces a fresh fetch of the profile from Supabase and updates cache
 */
export async function forceRefreshProfile(userId: string): Promise<AuthProfile | null> {
  if (!userId) return null;
  clearProfileCache(userId);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const prof = data as AuthProfile;
      cacheProfile(prof);
      return prof;
    }
  } catch (err) {
    console.error('[authService.forceRefreshProfile] Failed to refresh profile:', err);
  }
  return getCachedProfile(userId);
}

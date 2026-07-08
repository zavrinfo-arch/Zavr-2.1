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

/**
 * Checks if an account exists in the profiles table by email or username.
 * Optimized with exact indexing and clean select parameters.
 */
export async function checkAccountExists(
  emailOrUsername: string
): Promise<{ exists: boolean; email?: string; profile: AuthProfile | null }> {
  try {
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

    return {
      exists: true,
      email: data.email || undefined,
      profile: data as AuthProfile
    };
  } catch (err: any) {
    console.error('[authService.checkAccountExists] Error:', err.message || err);
    throw err;
  }
}

/**
 * Authenticates user using email and password.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      throw error;
    }

    // Fetch and load the profile in a single query
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    return {
      user: data.user,
      session: data.session,
      profile: profile as AuthProfile | null
    };
  } catch (err: any) {
    console.error('[authService.loginWithEmail] Error:', err.message || err);
    throw err;
  }
}

/**
 * Resolves a username to an email and authenticates.
 */
export async function loginWithUsername(
  username: string,
  password: string
): Promise<AuthResponse> {
  try {
    const account = await checkAccountExists(username);
    if (!account.exists || !account.email) {
      throw new Error('Account not found. Please sign up.');
    }
    return await loginWithEmail(account.email, password);
  } catch (err: any) {
    console.error('[authService.loginWithUsername] Error:', err.message || err);
    throw err;
  }
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

    return data as AuthProfile | null;
  } catch (err: any) {
    console.error('[authService.updateLoginStats] Unexpected exception:', err);
    throw err;
  }
}

import { supabase } from '../lib/supabaseClient';
import { SoloGoal } from '../types';

/**
 * Handles database request retries gracefully in sandboxed or unstable environments.
 * This directly prevents the UI from freezing or throwing raw connection errors 
 * to the user when WebSockets or HTTP connections drop.
 */
async function runWithRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delayMs = 1000,
  signal?: AbortSignal
): Promise<{ data: T | null; error: any }> {
  let attempt = 0;
  while (attempt < retries) {
    if (signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }
    try {
      const result = await operation();
      if (!result.error) {
        return result;
      }
      
      if (result.error?.name === 'AbortError' || result.error?.message?.includes('aborted') || result.error?.message?.includes('AbortError')) {
        console.log('[Onboarding Database Retry] Abort detected in error result. Exiting retry loop.');
        return result;
      }

      console.warn(
        `[Onboarding Database Retry] Attempt ${attempt + 1}/${retries} failed. Code: ${result.error?.code}. Message: ${result.error?.message}`
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.name === 'DOMException') {
        console.log('[Onboarding Database Exception] Abort detected in caught exception. Exiting retry loop.');
        throw err;
      }
      console.warn(
        `[Onboarding Database Exception] Attempt ${attempt + 1}/${retries} failed with exception:`,
        err
      );
    }
    
    attempt++;
    if (attempt < retries) {
      if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      // Wait or abort early if signal aborts
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        }, delayMs * Math.pow(2, attempt));

        const onAbort = () => {
          clearTimeout(timeout);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };

        if (signal) {
          signal.addEventListener('abort', onAbort);
        }
      });
    }
  }
  
  if (signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }
  // Final attempt
  return operation();
}

// Shared in-memory cache for checked usernames
const usernameCache = new Map<string, boolean>();
let checkCount = 0;
let totalLatency = 0;

/**
 * Onboarding Database Service (Supabase)
 * This modular service isolates all data-access methods for the onboarding flow.
 */
export const onboardingService = {
  /**
   * Verifies username availability with a robust check.
   * Compares the lowercase version of the username.
   * Single Source of Truth: profiles table.
   */
  async checkUsernameAvailability(username: string, signal?: AbortSignal, excludeUserId?: string): Promise<{ available: boolean; error: any }> {
    const cleaned = username.toLowerCase().trim();
    
    // Validate only lowercase letters, numbers, and underscores (regex criteria: ^[a-z0-9_]{3,20}$)
    if (!cleaned || cleaned.length < 3 || cleaned.length > 20 || !/^[a-z0-9_]+$/.test(cleaned)) {
      return { available: false, error: null };
    }

    const cacheKey = `${cleaned}:${excludeUserId || ''}`;
    if (usernameCache.has(cacheKey)) {
      return { available: usernameCache.get(cacheKey)!, error: null };
    }

    console.time("username-check");
    const startTime = performance.now();
    checkCount++;

    try {
      // Primary search inside profiles table
      let query = supabase
        .from('profiles')
        .select('id')
        .eq('username', cleaned);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      query = query.limit(1);

      if (signal) {
        query = query.abortSignal(signal);
      }

      const { data, error } = await query.maybeSingle();

      const endTime = performance.now();
      const latency = endTime - startTime;
      totalLatency += latency;
      console.timeEnd("username-check");

      if (error) {
        return { available: false, error };
      }

      const available = !data;
      usernameCache.set(cacheKey, available);

      return {
        available,
        error: null
      };

    } catch (err: any) {
      console.timeEnd("username-check");
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        return { available: false, error: err };
      }
      return { available: false, error: err };
    }
  },

  /**
   * Loads existing profile data from profiles table.
   */
  async loadUserProfile(userId: string): Promise<{ data: any; error: any }> {
    try {
      // Fetch from profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, birth_date, dob, gender, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      if (data) {
        return {
          data: {
            id: data.id,
            full_name: data.full_name || '',
            username: data.username || '',
            country_code: '+91',
            phone_number: data.phone || '',
            date_of_birth: data.birth_date || data.dob || '',
            gender: data.gender || '',
            created_at: data.created_at,
            updated_at: data.updated_at
          },
          error: null
        };
      }

      return {
        data: {
          id: userId,
          full_name: '',
          username: '',
          country_code: '+91',
          phone_number: '',
          date_of_birth: '',
          gender: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      };
    } catch (err: any) {
      console.error('[Onboarding Service] Unexpected crash loading profile:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Saves personal details to profiles table.
   */
  async saveOnboardingProfile(
    userId: string,
    profileData: {
      fullName: string;
      username: string;
      phone: string;
      countryCode: string;
      dob: string;
      gender: string;
      avatarUrl?: string;
    }
  ): Promise<{ error: any }> {
    const cleaned = profileData.username.toLowerCase().trim();

    // Sync to public.profiles to satisfy general isolation and user references
    try {
      const pPayload: any = {
        id: userId,
        full_name: profileData.fullName || null,
        username: cleaned || null,
        phone: profileData.phone || null,
        birth_date: profileData.dob || null,
        dob: profileData.dob || null,
        gender: profileData.gender || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      if (profileData.avatarUrl) {
        pPayload.avatar_url = profileData.avatarUrl;
      }

      const { error: pErr } = await supabase
        .from('profiles')
        .upsert(pPayload);

      return { error: pErr };
    } catch (err: any) {
      console.error('[Onboarding service] Exception during profiles write:', err);
      return { error: err };
    }
  },

  /**
   * Creates the user's very first solo goal seamlessly.
   */
  async createInitialGoal(goal: SoloGoal): Promise<{ error: any }> {
    const { error } = await runWithRetry(async () => {
      const result = await supabase
        .from('solo_goals')
        .insert({
          id: goal.id,
          user_id: goal.userId,
          name: goal.name,
          target_amount: goal.targetAmount,
          current_amount: goal.currentAmount,
          deadline: goal.deadline,
          category: goal.category,
          frequency: goal.frequency,
          created_at: goal.createdAt,
          completed: goal.completed
        });
      return { data: null, error: result.error };
    });

    return { error };
  }
};

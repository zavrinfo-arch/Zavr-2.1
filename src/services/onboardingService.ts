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
   * Priority: checks user_profiles. Fallback: checks profiles.
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
      // Primary search inside user_profiles table
      let query = supabase
        .from('user_profiles')
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
        // Fallback to profiles if user_profiles table is not ready or has different column constraints
        if (error.code === '42703' || error.code === '42P01' || error.message?.includes('column') || error.message?.includes('relation')) {
          console.warn('[Username Check Fallback] user_profiles check failed, checking profiles table...', error.message);
          let fbQuery = supabase
            .from('profiles')
            .select('id')
            .eq('username', cleaned);

          if (excludeUserId) {
            fbQuery = fbQuery.neq('id', excludeUserId);
          }

          fbQuery = fbQuery.limit(1);

          if (signal) {
            fbQuery = fbQuery.abortSignal(signal);
          }

          const { data: fbData, error: fbError } = await fbQuery.maybeSingle();
          if (fbError) {
            return { available: false, error: fbError };
          }
          const available = !fbData;
          usernameCache.set(cacheKey, available);
          return { available, error: null };
        }
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
   * Loads existing profile data from user_profiles table with a bulletproof fallback to profiles.
   */
  async loadUserProfile(userId: string): Promise<{ data: any; error: any }> {
    try {
      // 1. Fetch from user_profiles
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, country_code, phone_number, date_of_birth, gender, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Handle fallback if columns are missing or if table was consolidated
        if (error.code === '42703' || error.code === '42P01' || error.message?.includes('column') || error.message?.includes('relation')) {
          console.warn('[Onboarding Service] user_profiles select failed, falling back to profiles table:', error.message);
          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .select('id, full_name, username, phone, birth_date, gender, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

          if (pError) {
            return { data: null, error: pError };
          }

          if (pData) {
            return {
              data: {
                id: pData.id,
                full_name: pData.full_name || '',
                username: pData.username || '',
                country_code: '+91',
                phone_number: pData.phone || '',
                date_of_birth: pData.birth_date || '',
                gender: pData.gender || '',
                created_at: pData.created_at,
                updated_at: pData.updated_at
              },
              error: null
            };
          }
          return { data: null, error: null };
        }
        return { data: null, error };
      }

      // 2. Handle missing profile row auto-creation criteria
      if (!data) {
        console.log('[Onboarding Service] user_profiles row missing, auto-creating a new row...');
        const { error: insError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insError) {
          console.warn('[Onboarding Service] Auto-insertion in user_profiles skipped or failed:', insError.message);
        }

        // Try reading profiles fallback to populate partial existing details
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, full_name, username, phone, birth_date, gender, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle();

        if (pData) {
          return {
            data: {
              id: pData.id,
              full_name: pData.full_name || '',
              username: pData.username || '',
              country_code: '+91',
              phone_number: pData.phone || '',
              date_of_birth: pData.birth_date || '',
              gender: pData.gender || '',
              created_at: pData.created_at,
              updated_at: pData.updated_at
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
      }

      return { data, error: null };
    } catch (err: any) {
      console.error('[Onboarding Service] Unexpected crash loading profile:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Saves personal details to both user_profiles and profiles.
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

    // 1. Sync to public.user_profiles
    const upPayload = {
      id: userId,
      full_name: profileData.fullName || null,
      username: cleaned || null,
      country_code: profileData.countryCode || null,
      phone_number: profileData.phone || null,
      date_of_birth: profileData.dob || null,
      gender: profileData.gender || null,
      updated_at: new Date().toISOString()
    };

    let upError = null;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert(upPayload);

      if (error) {
        console.warn('[Onboarding Service] Upsert to user_profiles failed, seeking fallback:', error.message);
        upError = error;

        // Try standard reduced payload if schema details aren't matching
        if (error.code === '42703' || error.message?.includes('column')) {
          const reducedPayload: any = { id: userId, updated_at: new Date().toISOString() };
          if (profileData.avatarUrl) reducedPayload.avatar_url = profileData.avatarUrl;
          reducedPayload.onboarding_completed = true;
          const { error: redErr } = await supabase.from('user_profiles').upsert(reducedPayload);
          if (!redErr) {
            upError = null;
          }
        }
      }
    } catch (ex: any) {
      console.error('[Onboarding Service] Exception during user_profiles write:', ex);
      upError = ex;
    }

    // 2. Sync to public.profiles to satisfy general isolation and user references
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

      if (pErr) {
        console.warn('[Onboarding Service] Sync to public.profiles failed (non-blocking if user_profiles worked):', pErr.message);
        if (!upError) {
          // If user_profiles succeeded, we can proceed without failing
          console.log('[Onboarding Service] user_profiles save succeeded, bypassing profiles save error.');
        } else {
          return { error: pErr };
        }
      }
    } catch (err: any) {
      console.error('[Onboarding service] Exception during profiles write:', err);
      if (upError) return { error: err };
    }

    return { error: upError };
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

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
   */
  async checkUsernameAvailability(username: string, signal?: AbortSignal, excludeUserId?: string): Promise<{ available: boolean; error: any }> {
    const cleaned = username.toLowerCase().trim();
    
    // Task 3: Client-side Validation pre-checks to reject immediately without database calls
    if (!cleaned || cleaned.length < 3 || cleaned.length > 20 || !/^[a-zA-Z0-9_]+$/.test(cleaned)) {
      return { available: false, error: null };
    }

    const cacheKey = `${cleaned}:${excludeUserId || ''}`;
    // Task 5: Cache hit check
    if (usernameCache.has(cacheKey)) {
      console.log(`[Username Check Cache Hit] "${cacheKey}" -> available: ${usernameCache.get(cacheKey)}`);
      return { available: usernameCache.get(cacheKey)!, error: null };
    }

    // Task 7: Performance Tracking & console.time
    console.time("username-check");
    const startTime = performance.now();
    checkCount++;

    try {
      // Task 4 & 6: Optimized Query Selection (select 'id', eq 'username', limit(1), maybeSingle)
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

      console.log(
        `[Username Check DB Fetch] "${cleaned}" (exclude=${excludeUserId}) completed in ${latency.toFixed(2)}ms. ` +
        `Result: data=${JSON.stringify(data)}, error=${JSON.stringify(error)}. ` +
        `Total Checks: ${checkCount}, Avg Latency: ${(totalLatency / checkCount).toFixed(2)}ms.`
      );

      if (error) {
        return {
          available: false,
          error
        };
      }

      const available = !data;
      // Save to Cache
      usernameCache.set(cacheKey, available);

      return {
        available,
        error: null
      };

    } catch (err: any) {
      console.timeEnd("username-check");
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        console.log(`[Username Check] Query for "${cleaned}" was aborted.`);
        return { available: false, error: err };
      }
      console.error('[Onboarding Service] Error checking username availability:', err);
      return { available: false, error: err };
    }
  },

  /**
   * Saves personal details to the database using UPSERT.
   */
  async saveOnboardingProfile(
    userId: string,
    profileData: {
      fullName: string;
      username: string;
      phone: string;
      dob: string;
      gender: string;
      avatarUrl: string;
    }
  ): Promise<{ error: any }> {
    const { error } = await runWithRetry(async () => {
      const result = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: profileData.fullName || null,
          username: profileData.username.toLowerCase().trim() || null,
          phone: profileData.phone || null,
          birth_date: profileData.dob || null,
          gender: profileData.gender || null,
          avatar_url: profileData.avatarUrl || null,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        });
      // Match supabase SDK format
      return { data: null, error: result.error };
    });

    return { error };
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

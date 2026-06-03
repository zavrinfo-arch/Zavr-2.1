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
  delayMs = 1000
): Promise<{ data: T | null; error: any }> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const result = await operation();
      if (!result.error) {
        return result;
      }
      
      console.warn(
        `[Onboarding Database Retry] Attempt ${attempt + 1}/${retries} failed. Code: ${result.error?.code}. Message: ${result.error?.message}`
      );
    } catch (err: any) {
      console.warn(
        `[Onboarding Database Exception] Attempt ${attempt + 1}/${retries} failed with exception:`,
        err
      );
    }
    
    attempt++;
    if (attempt < retries) {
      // Exponential backoff to avoid hammering the endpoint
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
    }
  }
  
  // Final attempt
  return operation();
}

/**
 * Onboarding Database Service (Supabase)
 * This modular service isolates all data-access methods for the onboarding flow.
 */
export const onboardingService = {
  /**
   * Verifies username availability with a robust check.
   * Compares the lowercase version of the username.
   */
  async checkUsernameAvailability(username: string): Promise<{ available: boolean; error: any }> {
    const cleaned = username.toLowerCase().trim();
    if (!cleaned) {
      return { available: false, error: null };
    }

    const { data, error } = await runWithRetry(async () => {
      return supabase
        .from('profiles')
        .select('username')
        .eq('username', cleaned)
        .maybeSingle();
    });

    if (error) {
      console.error('[Onboarding Service] Error checking username availability:', error);
      return { available: false, error };
    }

    // If data is null/undefined, it means no profile has this username yet -> it's available.
    return { available: !data, error: null };
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

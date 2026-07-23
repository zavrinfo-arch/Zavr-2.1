import { supabase } from '../lib/supabaseClient';

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

const PROFILE_CACHE_PREFIX = 'profile_service_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      console.log('✅ Found cached Profile for:', userId);
      return parsed.profile;
    }
    localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
  } catch (e) {
    console.warn('⚠️ Error reading cached profile:', e);
  }
  return null;
}

function setCachedProfile(profile: Profile): void {
  if (!profile || !profile.id) return;
  try {
    localStorage.setItem(
      `${PROFILE_CACHE_PREFIX}${profile.id}`,
      JSON.stringify({
        timestamp: Date.now(),
        profile,
      })
    );
  } catch (e) {
    console.warn('⚠️ Error saving profile to cache:', e);
  }
}

function clearProfileCache(userId: string): void {
  try {
    localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
  } catch (e) {
    // Ignore
  }
}

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  throw lastErr;
}

export const profileService = {
  /**
   * Fetches the user profile by ID with 3-attempt retry logic and localStorage caching
   */
  async getProfile(userId: string): Promise<{ data: Profile | null; error: any }> {
    if (!userId) return { data: null, error: 'No userId provided' };

    // Check cache first
    const cached = getCachedProfile(userId);
    if (cached) {
      return { data: cached, error: null };
    }

    try {
      const result = await retryWithDelay(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        return data as Profile | null;
      }, 3, 1000);

      if (result) {
        setCachedProfile(result);
      }

      return { data: result, error: null };
    } catch (error) {
      console.error('[profileService.getProfile] Error fetching profile:', error);
      // Fallback to expired cache if available
      try {
        const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { data: parsed.profile, error: null };
        }
      } catch (e) {
        // ignore
      }
      return { data: null, error };
    }
  },

  /**
   * Force refresh profile from database, ignoring cache
   */
  async forceRefreshProfile(userId: string): Promise<{ data: Profile | null; error: any }> {
    clearProfileCache(userId);
    return this.getProfile(userId);
  },

  /**
   * Creates a profile if not already existing
   */
  async createProfile(profile: Partial<Profile>): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();

      if (!error && data) {
        setCachedProfile(data as Profile);
      }

      return { data: data as Profile | null, error };
    } catch (error) {
      console.error('[profileService.createProfile] Unexpected error:', error);
      return { data: null, error };
    }
  },

  /**
   * Updates an existing profile row and invalidates cache
   */
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: any }> {
    try {
      clearProfileCache(userId);
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (!error && data) {
        setCachedProfile(data as Profile);
      }

      return { data: data as Profile | null, error };
    } catch (error) {
      console.error('[profileService.updateProfile] Unexpected error:', error);
      return { data: null, error };
    }
  },

  /**
   * Automatically tracks logins by updating last_login timestamp
   */
  async updateLastLogin(userId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      return { success: !error, error };
    } catch (error) {
      console.error('[profileService.updateLastLogin] Unexpected error:', error);
      return { success: false, error };
    }
  },

  /**
   * Uploads an avatar image file to Supabase Storage avatars bucket
   */
  async uploadAvatar(
    userId: string,
    fileUriOrBlob: any,
    fileExtension: string = 'png'
  ): Promise<{ url: string | null; error: any }> {
    try {
      const filePath = `${userId}/${Date.now()}.${fileExtension}`;
      let uploadBody: any;

      if (typeof fileUriOrBlob === 'string' && fileUriOrBlob.startsWith('file://')) {
        const response = await fetch(fileUriOrBlob);
        uploadBody = await response.blob();
      } else {
        uploadBody = fileUriOrBlob;
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadBody, {
          contentType: `image/${fileExtension}`,
          upsert: true,
        });

      if (uploadError) {
        return { url: null, error: uploadError };
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl || null;

      if (publicUrl) {
        await this.updateProfile(userId, { avatar_url: publicUrl });
      }

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('[profileService.uploadAvatar] Unexpected error:', error);
      return { url: null, error };
    }
  },
};

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

export const profileService = {
  /**
   * Fetches the user profile by ID
   */
  async getProfile(userId: string): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      return { data: data as Profile | null, error };
    } catch (error) {
      console.error('[profileService.getProfile] Unexpected error:', error);
      return { data: null, error };
    }
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

      return { data: data as Profile | null, error };
    } catch (error) {
      console.error('[profileService.createProfile] Unexpected error:', error);
      return { data: null, error };
    }
  },

  /**
   * Updates an existing profile row (optimized using standard single matching)
   */
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

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
   * Engineered for extreme RN & Web compatibility.
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
        // React Native Uri handling - convert to blob
        const response = await fetch(fileUriOrBlob);
        uploadBody = await response.blob();
      } else {
        uploadBody = fileUriOrBlob;
      }

      // Upload payload to Supabase Storage (Assumes 'avatars' bucket exists)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadBody, {
          contentType: `image/${fileExtension}`,
          upsert: true,
        });

      if (uploadError) {
        return { url: null, error: uploadError };
      }

      // Retrieve public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl || null;

      if (publicUrl) {
        // Sync url with profiles record automatically
        await this.updateProfile(userId, { avatar_url: publicUrl });
      }

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('[profileService.uploadAvatar] Unexpected error:', error);
      return { url: null, error };
    }
  },
};

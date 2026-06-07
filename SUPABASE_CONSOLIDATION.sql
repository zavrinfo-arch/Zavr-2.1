-- =========================================================================
-- SUPABASE DATABASE CONSOLIDATION MIGRATION
-- Project: Consolidating Profiles single-source-of-truth from public.user_profiles to public.profiles
-- Target Database: Supabase PostgreSQL (Public Schema)
-- =========================================================================

BEGIN;

-- 1. MIGRATE ANY STRAGGLING OR DIFFERING DATA
-- Ensure that if any user has completed onboarding or chose an avatar inside user_profiles but 
-- was not correctly propagated to profiles, we preserve this data.
UPDATE public.profiles p
SET 
  avatar_id = COALESCE(p.avatar_id, up.avatar_id),
  avatar_url = COALESCE(p.avatar_url, up.avatar_url),
  onboarding_completed = CASE 
    WHEN up.onboarding_completed = true THEN true 
    ELSE p.onboarding_completed 
  END,
  updated_at = GREATEST(p.updated_at, up.updated_at)
FROM public.user_profiles up
WHERE p.id = up.id;

-- If a user exists in user_profiles but somehow doesn't exist in profiles (impossible via trigger, but safe to handle),
-- insert them into profiles.
INSERT INTO public.profiles (id, avatar_id, avatar_url, onboarding_completed, updated_at)
SELECT up.id, up.avatar_id, up.avatar_url, up.onboarding_completed, up.updated_at
FROM public.user_profiles up
LEFT JOIN public.profiles p ON up.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. RE-DEFINE THE SIGNUP TRIGGER FUNCTION WITHOUT USER_PROFILES
-- This updates handle_new_user() to only write to profiles table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_avatar text;
  base_username text;
  resolved_username text;
BEGIN
  -- Safe fallback username extraction from auth metadata or email
  base_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name', 
    split_part(new.email, '@', 1)
  );

  -- Convert base_username to unique username safely
  resolved_username := public.generate_unique_username(base_username, new.id);

  -- Derive the default avatar URL
  default_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url', 
    'https://api.dicebear.com/7.x/lorelei/svg?seed=' || resolved_username
  );

  -- Insert safely into profiles with local exception catcher
  BEGIN
    INSERT INTO public.profiles (
      id, 
      username, 
      full_name, 
      email,
      avatar_id,
      avatar_url,
      onboarding_completed,
      updated_at
    )
    VALUES (
      new.id, 
      resolved_username, 
      COALESCE(new.raw_user_meta_data->>'full_name', resolved_username),
      new.email,
      'genz_1',
      default_avatar,
      false,
      new.created_at
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Capture constraint or datatype conflicts so signup is NEVER blocked by profiles issues
    NULL;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Absolute ultimate recovery catch-all to guarantee auth signup process completes within microseconds
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. DROP POLICIES AND CONSTRAINTS ON USER_PROFILES
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_user_isolation" ON public.user_profiles;

-- 4. DROP INDEXES ON USER_PROFILES
DROP INDEX IF EXISTS idx_user_profiles_id;

-- 5. SAFELY DROP THE USER_PROFILES TABLE
DROP TABLE IF EXISTS public.user_profiles CASCADE;

COMMIT;

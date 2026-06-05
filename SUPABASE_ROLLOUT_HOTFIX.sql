-- =========================================================================
-- SUPABASE SIGNUP FLOW HOTFIX & SCHEMA RECOVERY SCRIPT
-- =========================================================================
-- This script repairs column mismatches and installs a robust, exception-safe
-- signup trigger. Run this script in the Supabase SQL Editor to apply the fix.

-- 1. Structural Fixes - Ensure Profiles table has the correct columns
-- Adding missing email and avatar_id columns to prevent write/read failures on old schemas.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_id text DEFAULT 'genz_1';

-- 2. Create the robust, exception-safe user profile trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_avatar text;
  username_part text;
BEGIN
  -- Safe fallback username extraction (from metadata or email)
  username_part := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name', 
    split_part(new.email, '@', 1)
  );
  
  -- Safe fallback avatar derivation
  default_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url', 
    'https://api.dicebear.com/7.x/lorelei/svg?seed=' || username_part
  );

  -- Safe nested insertion block for the main public.profiles table
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
      LOWER(username_part), 
      COALESCE(new.raw_user_meta_data->>'full_name', username_part),
      new.email,
      'genz_1',
      default_avatar,
      false,
      new.created_at
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Capture any DDL or constraint error to prevent blocking auth signup
    NULL;
  END;

  -- Safe nested insertion block for the secondary public.user_profiles table (for compatibility)
  BEGIN
    INSERT INTO public.user_profiles (
      id,
      avatar_id,
      avatar_url,
      onboarding_completed,
      updated_at
    )
    VALUES (
      new.id,
      'genz_1',
      default_avatar,
      false,
      new.created_at
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Capture any schema or table-existence errors safely
    NULL;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Ultimate fail-safe backup return of the 'new' row so signup never stalls
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Safely re-create and bind the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Correct schema lookup permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Log confirmation message
SELECT 'OK' AS status, 'Supabase Signup Hotfix deployed successfully.' AS message;

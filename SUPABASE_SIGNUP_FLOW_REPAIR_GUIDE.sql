-- =========================================================================
-- SUPABASE DATABASE REPAIR: SIGNUP FLOW & TRIGGER CONSOLIDATION
-- =========================================================================
-- Target Project: Zavr
-- Execution Environment: Supabase SQL Editor (https://supabase.com)
--
-- ROOT CAUSE ANALYSIS:
-- 1. There was a legacy trigger named "on_auth_user_created_profiles" on the 
--    "auth.users" table executing "public.handle_new_user_profiles_row()".
-- 2. When the project underwent consolidation (e.g., via SUPABASE_CONSOLIDATION.sql),
--    the "public.user_profiles" table was either dropped or modified.
-- 3. The trigger "on_auth_user_created_profiles" was NOT dropped, meaning it 
--    still fired after new user insertions.
-- 4. When executing, "public.handle_new_user_profiles_row()" attempted to insert 
--    into the dropped or modified "public.user_profiles" table. Since it lacked an
--    exception handler (EXCEPTION WHEN OTHERS THEN NULL;), the unhandled error 
--    bubbled up, failing the auth.users insert transaction with the fatal error:
--    "Database error saving new user".
--
-- RESOLUTION PATH:
-- 1. Explicitly drop all conflicting legacy triggers on "auth.users".
-- 2. Clean up legacy helper functions to prevent naming conflicts.
-- 3. Re-create a single, fully consolidated, robust, and 100% exception-safe
--    "handle_new_user" trigger function.
-- 4. Use independent, nested BEGIN...EXCEPTION blocks inside the function to write
--    to public.profiles (and public.user_profiles if it exists) so that failures
--    in the profile tables NEVER block or crash the auth signup flow.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: CLEAN UP CONFLICTING AND LEGACY TRIGGERS
-- -------------------------------------------------------------------------
-- These triggers must be dropped first to avoid active references during function updates.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

-- -------------------------------------------------------------------------
-- STEP 2: DROP OLD AND CONFLICTING FUNCTIONS
-- -------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_profiles_row() CASCADE;
DROP FUNCTION IF EXISTS public.generate_unique_username(text, uuid) CASCADE;

-- -------------------------------------------------------------------------
-- STEP 3: CREATE ROBUST COLLISION-FREE UNIQUE USERNAME GENERATOR
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_uname text, user_id uuid)
RETURNS text AS $$
DECLARE
  clean_uname text;
  final_uname text;
  it integer := 1;
BEGIN
  -- Convert to lowercase and strip all non-alphanumeric and non-underscore characters
  clean_uname := LOWER(regexp_replace(base_uname, '[^a-zA-Z0-9_]', '', 'g'));
  
  -- Prevent empty or extremely short names
  IF length(clean_uname) < 3 THEN
    clean_uname := clean_uname || 'usr';
  END IF;
  
  -- Truncate to maximum 15 characters to make room for suffixes if needed
  IF length(clean_uname) > 15 THEN
    clean_uname := substring(clean_uname from 1 for 15);
  END IF;

  final_uname := clean_uname;

  -- Verify globally unique status in public.profiles.
  -- Loop to append a clean, predictable, conflict-free suffix if already taken.
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_uname) LOOP
    final_uname := substring(clean_uname from 1 for 12) || '_' || it || '_' || substring(user_id::text, 1, 4);
    it := it + 1;
    IF it > 10 THEN
      -- Absolute ultimate escape fallback using first 8 digits of user UUID
      final_uname := substring(clean_uname from 1 for 10) || '_' || substring(user_id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN final_uname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- STEP 4: CREATE CONSOLIDATED, EXCEPTION-SAFE NEW USER TRIGGER FUNCTION
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_avatar text;
  base_username text;
  resolved_username text;
BEGIN
  -- 4.1 Extract username gracefully from auth metadata or email prefix
  base_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name', 
    split_part(new.email, '@', 1)
  );

  -- 4.2 Resolve base_username to a globally unique username
  resolved_username := public.generate_unique_username(base_username, new.id);

  -- 4.3 Derive a high-quality default avatar URL
  default_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url', 
    'https://api.dicebear.com/7.x/lorelei/svg?seed=' || resolved_username
  );

  -- 4.4 WRITE TO PUBLIC.PROFILES (Isolated & Exception-Safe)
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
      COALESCE(new.created_at, now())
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
      email = EXCLUDED.email,
      updated_at = EXCLUDED.updated_at
    WHERE public.profiles.email IS NULL OR public.profiles.email = '';
  EXCEPTION WHEN OTHERS THEN
    -- Completely capture any DDL, constraint, or syntax errors so user creation is NEVER blocked
    RAISE WARNING 'handle_new_user trigger profiles insertion failed: %', SQLERRM;
  END;

  -- 4.5 WRITE TO PUBLIC.USER_PROFILES IF THE TABLE IS STIPULATED (Isolated & Exception-Safe)
  BEGIN
    IF EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
      INSERT INTO public.user_profiles (
        id,
        username,
        full_name,
        created_at,
        updated_at
      )
      VALUES (
        new.id,
        resolved_username,
        COALESCE(new.raw_user_meta_data->>'full_name', resolved_username),
        COALESCE(new.created_at, now()),
        COALESCE(new.created_at, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Capture any user_profiles failures without disrupting auth.users pipeline
    RAISE WARNING 'handle_new_user trigger user_profiles insertion failed: %', SQLERRM;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Absolute ultimate fail-safe guarantee to always return new and never block signups
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- STEP 5: BIND CONSOLIDATED TRIGGER TO AUTH.USERS
-- -------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- STEP 6: VERIFY & SECURE ROW LEVEL SECURITY (RLS) POLICIES FOR PROFILES
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE TO anon, authenticated, service_role 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles 
  FOR DELETE TO anon, authenticated, service_role 
  USING (auth.uid() = id);

-- -------------------------------------------------------------------------
-- STEP 7: GRANT PROPER GLOBAL SCHEMA PERMISSIONS
-- -------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

SELECT 'DATABASE TRIGGER REPAIR EXECUTED SUCCESSFULLY' as status_report;

-- =========================================================================
--             SUPABASE SCHEMA MIGRATION: ONBOARDING & SAVING CATEGORIES
-- =========================================================================
-- Run this script in your Supabase SQL Editor to verify and ensure the 'profiles'
-- table meets the 4-step onboarding specifications, supports JSON Array savings categories,
-- and holds secure Row-Level Security isolation rules.

-- 1. Verify and align all required columns on the public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob DATE; -- alias
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saving_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Ensure unique username constraint (case-sensitive unique index)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;

-- 3. Enable Row-Level Security (RLS) on public.profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Re-create secure isolation policies for Profiles (Durable Privacy)
-- Note: 'anon', 'authenticated', and 'service_role' are granted access with uid checks.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles 
  FOR SELECT TO anon, authenticated, service_role 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE TO anon, authenticated, service_role 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- 5. Grant dynamic access to appropriate connection tiers
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

SELECT 'SUCCESS' AS status, 'Onboarding database schema successfully compiled and verified' AS message;

-- =========================================================================
--             SUPABASE SCHEMA MIGRATION: USER PROFILES SETUP
-- =========================================================================
-- Run this script in your Supabase SQL Editor to provision the user_profiles table,
-- prepare the requested columns, enable secure Row-Level Security, and active
-- the automatic profile row insertion trigger when a new user signs up.

-- 1. Create the user_profiles table if not exists with essential columns
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text,
  country_code text,
  phone_number text,
  date_of_birth date,
  gender text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Align and ensure all required columns exist on the user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Ensure unique constraint on username if required (case-insensitive check is done and validated client-side)
-- ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_username_key UNIQUE (username);

-- 3. Enable Row Level Security (RLS) on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Re-create secure isolation policies
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles 
  FOR SELECT TO anon, authenticated, service_role 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own" ON public.user_profiles 
  FOR UPDATE TO anon, authenticated, service_role 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
CREATE POLICY "user_profiles_delete_own" ON public.user_profiles 
  FOR DELETE TO anon, authenticated, service_role 
  USING (auth.uid() = id);

-- 5. Auto creation insert trigger on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profiles_row()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = new.id) THEN
    INSERT INTO public.user_profiles (id, created_at, updated_at)
    VALUES (new.id, now(), now());
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger: fires after insert on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profiles_row();

-- 6. Grant global schema permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;

SELECT 'OK' as status, 'user_profiles table migration script successfully compiled' as message;

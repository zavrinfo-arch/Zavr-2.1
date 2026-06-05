-- ZAVR SUPABASE COMPLETE SCHEMA & POLICY SETUP
-- Run this script in your Supabase SQL Editor to enable Row-Level Security,
-- provision tables with precise column mappings, configure data isolation policies,
-- and set up the automatic profile creation trigger safely.

-- =========================================================================
-- 1. EXTENSIONS & SCHEMA CONFIGURATION
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. TABLE PROVISIONING (Primacy fields supporting Neo-Luxury Fintech features)
-- =========================================================================

-- Profiles table (primary account schema)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  email text,
  dob date,
  birth_date date,
  gender text,
  phone text,
  location text,
  avatar_url text,
  avatar_id text DEFAULT 'genz_1',
  onboarding_completed boolean DEFAULT false,
  streak integer DEFAULT 0,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  streak_freeze_count integer DEFAULT 0,
  interests text[] DEFAULT '{}',
  badges jsonb DEFAULT '[]',
  preferences jsonb DEFAULT '{
    "currency": "INR",
    "notificationsEnabled": true,
    "reminders": {"enabled": true, "time": "20:00", "frequency": "daily"}
  }',
  created_at timestamp with time zone DEFAULT now(),
  last_login_date timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

-- Solo goals saving schema
CREATE TABLE IF NOT EXISTS public.solo_goals (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  deadline date,
  category text,
  frequency text DEFAULT 'weekly',
  created_at timestamp with time zone DEFAULT now(),
  completed boolean DEFAULT false
);

-- Emergency buffer goals saving schema
CREATE TABLE IF NOT EXISTS public.emergency_goals (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Group goals saving schema
CREATE TABLE IF NOT EXISTS public.group_goals (
  id text PRIMARY KEY,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  deadline date,
  category text,
  description text,
  code text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  completed boolean DEFAULT false
);

-- Members mapped to group save goals
CREATE TABLE IF NOT EXISTS public.group_goal_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id text REFERENCES public.group_goals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  contribution numeric DEFAULT 0,
  UNIQUE(goal_id, user_id)
);

-- Ledger transactions schema
CREATE TABLE IF NOT EXISTS public.transactions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  amount numeric NOT NULL,
  type text NOT NULL, -- 'deposit', 'withdrawal', 'transfer', 'settlement'
  category text,
  description text,
  goal_id text,
  timestamp timestamp with time zone DEFAULT now()
);

-- In-app notifications schema
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title text NOT NULL,
  message text,
  type text,
  read boolean DEFAULT false,
  timestamp timestamp with time zone DEFAULT now()
);

-- Friends (social hub) schema
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Zettl Group expense-splitting groups schema
CREATE TABLE IF NOT EXISTS public.group_zettls (
  id text PRIMARY KEY,
  name text NOT NULL,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now()
);

-- Personal bills/debts tracking schema
CREATE TABLE IF NOT EXISTS public.personal_zettls (
  id text PRIMARY KEY,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  debtor_email text NOT NULL,
  amount numeric NOT NULL,
  description text,
  status text DEFAULT 'unsettled', -- 'unsettled', 'settled'
  created_at timestamp with time zone DEFAULT now()
);

-- =========================================================================
-- 3. ENABLE ROW-LEVEL SECURITY (RLS) FOR DATA BOUNDARY ENFORCEMENT
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_goal_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_zettls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_zettls ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 4. CONSOLIDATE ROW LEVEL SECURITY POLICIES
-- =========================================================================

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated 
  USING (true); -- Allows Gen Z users to search potential group partners or friends

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Solo Goals Policies
DROP POLICY IF EXISTS "solo_goals_isolation" ON public.solo_goals;
CREATE POLICY "solo_goals_isolation" ON public.solo_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Emergency Goals Policies
DROP POLICY IF EXISTS "emergency_goals_isolation" ON public.emergency_goals;
CREATE POLICY "emergency_goals_isolation" ON public.emergency_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "transactions_isolation" ON public.transactions;
CREATE POLICY "transactions_isolation" ON public.transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications Policies
DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;
CREATE POLICY "notifications_isolation" ON public.notifications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Group Goals Policies
DROP POLICY IF EXISTS "group_goals_select" ON public.group_goals;
CREATE POLICY "group_goals_select" ON public.group_goals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM public.group_goal_members m
      WHERE m.goal_id = group_goals.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_goals_insert" ON public.group_goals;
CREATE POLICY "group_goals_insert" ON public.group_goals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "group_goals_update" ON public.group_goals;
CREATE POLICY "group_goals_update" ON public.group_goals
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Group Members Policies
DROP POLICY IF EXISTS "group_goal_members_all" ON public.group_goal_members;
CREATE POLICY "group_goal_members_all" ON public.group_goal_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = user_id);

-- Friends Policies
DROP POLICY IF EXISTS "friends_isolation" ON public.friends;
CREATE POLICY "friends_isolation" ON public.friends
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id);

-- Personal Zettls Policies
DROP POLICY IF EXISTS "personal_zettls_isolation" ON public.personal_zettls;
CREATE POLICY "personal_zettls_isolation" ON public.personal_zettls
  FOR ALL TO authenticated
  USING (
    auth.uid() = creator_id OR 
    debtor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (auth.uid() = creator_id);

-- =========================================================================
-- 5. AUTOMATIC PROFILE CREATION TRIGGER (resilient to schema boundaries)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_avatar text;
  username_part text;
BEGIN
  -- Safe fallback extractions
  username_part := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name', 
    split_part(new.email, '@', 1)
  );
  default_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url', 
    'https://api.dicebear.com/7.x/lorelei/svg?seed=' || username_part
  );

  -- 1. Safe nested insertion block for Profiles
  BEGIN
    INSERT INTO public.profiles (
      id, 
      username, 
      full_name, 
      onboarding_completed,
      avatar_url
    )
    VALUES (
      new.id, 
      LOWER(username_part), 
      COALESCE(new.raw_user_meta_data->>'full_name', username_part),
      false,
      default_avatar
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent failures in profiles from blocking the trigger and user creation
    NULL;
  END;

  -- 2. Safe nested insertion block for User Profiles (if table exists)
  BEGIN
    INSERT INTO public.user_profiles (
      id,
      avatar_id,
      avatar_url,
      onboarding_completed
    )
    VALUES (
      new.id,
      'genz_1',
      default_avatar,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent failures in user_profiles from blocking the trigger and user creation
    NULL;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Final general safeguard: always return new to prevent blocking auth signup loop
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to authenticated insertions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 6. SCHEMA PERMISSIONS
-- =========================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Setup confirmation notice
SELECT 'ZAVR INITIALIZATION COMPLETED SUCCESSFUL' as confirmation_report;

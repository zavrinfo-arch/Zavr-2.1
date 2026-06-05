-- SQL Migration for Avatar System
-- Adds avatar_id to user_profiles and creates a secondary 'profiles' table as requested

-- 1. Ensure user_profiles has avatar_id
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_id text;

-- 2. Create 'profiles' table with full schema required by the application
CREATE TABLE IF NOT EXISTS profiles (
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

-- 3. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user to insert their own profile" ON profiles;
CREATE POLICY "Allow user to insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Public profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. Trigger to automatically create a profile for new auth users
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
  -- We catch errors to prevent the auth signup from failing completely 
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Ensure schema permissions are correct
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

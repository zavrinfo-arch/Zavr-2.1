-- SQL Migration for Avatar System
-- Adds avatar_id to user_profiles and creates a secondary 'profiles' table as requested

-- 1. Ensure user_profiles has avatar_id
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_id text;

-- 2. Create 'profiles' table exactly as requested in specifications
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id text,
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
  FOR ALL USING (auth.uid() = id);

-- 5. Trigger to sync profiles to user_profiles if needed (optional, keeping it simple for now)

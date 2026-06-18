-- =========================================================================
-- ZAVR LOGIN UPGRADE MIGRATION SQL
-- Supports Login with Email OR Username & login timestamp tracking
-- =========================================================================

-- 1. ADD TIMESTAMPTZ TRACKING COLUMN TO PROFILES FOR SECURE LOGIN TIMESTAMPS
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. CREATE HIGH-PERFORMANCE INDEXES FOR RAPID USER LOOKUP ON SIGNIFICANT FIELDS
CREATE INDEX IF NOT EXISTS idx_profiles_username
ON public.profiles(username);

CREATE INDEX IF NOT EXISTS idx_profiles_email
ON public.profiles(email);

-- 3. RESET AND CONFIGURE ROBUST ROW LEVEL SECURITY (RLS) FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Allows authenticated users to view profiles (e.g. searching for friends or checking active users)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated 
  USING (true);

-- Policy 2: INSERT - Allows new users to create their own profiles
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = id);

-- Policy 3: UPDATE - Allows authenticated users to update their own profiles (including last_login_at)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. GRANT SCHEMA PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

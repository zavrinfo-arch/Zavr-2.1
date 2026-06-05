-- =========================================================================
--             SUPABASE ENTERPRISE ROLLBACK SCRIPT
-- =========================================================================
-- Target Project: Zavr
-- Execution Environment: Supabase SQL Editor
-- Description:
--   Safely reverts triggers, functions, and policies to their original state.
--   Note: Does not destroy table structures or user data to preserve data integrity.
-- =========================================================================

-- 1. Revert triggers and triggers functions to simple basic versions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, onboarding_completed)
  VALUES (
    new.id, 
    LOWER(split_part(new.email, '@', 1)), 
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, onboarding_completed)
  VALUES (
    new.id,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clear helper functions
DROP FUNCTION IF EXISTS public.generate_unique_username(text, uuid);

-- 2. Restore basic RLS Policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;

CREATE POLICY "user_profiles_select_own" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "user_profiles_update_own" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Delete performance-oriented indexes safely if desired
DROP INDEX IF EXISTS idx_profiles_username;
DROP INDEX IF EXISTS idx_profiles_id;
DROP INDEX IF EXISTS idx_user_profiles_id;
DROP INDEX IF EXISTS idx_solo_goals_user_id;
DROP INDEX IF EXISTS idx_emergency_goals_user_id;
DROP INDEX IF EXISTS idx_group_goals_creator_id;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_notifications_user_id;

-- Log rollback status
SELECT 'OK' AS status, 'Supabase Enterprise Rollback applied successfully.' AS message;

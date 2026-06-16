-- =========================================================================
-- SUPABASE ZETTL GOAL SYSTEM SCHEMA RECOVERY & ALIGNMENT SCRIPT
-- =========================================================================
-- This hotfix script alters physical database tables to add missing columns
-- required by the frontend application service layers (Solo, Group, and Emergency Goals).
--
-- INSTRUCTIONS:
-- 1. Log into your Supabase Dashboard (https://supabase.com).
-- 2. Navigate to the "SQL Editor" page.
-- 3. Click "New Query".
-- 4. Paste this entire script into the editor.
-- 5. Click "Run" (or command/ctrl + Enter) to execute.
-- =========================================================================

-- 1. Repair and align the 'emergency_goals' table schema
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS category text DEFAULT 'Emergency';
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'weekly';
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS routine_amount numeric DEFAULT 100;
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
ALTER TABLE public.emergency_goals ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 2. Repair and align the 'group_goals' table schema
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS members jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS total_collected numeric DEFAULT 0;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'weekly';
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS current_amount numeric DEFAULT 0;
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS category text DEFAULT 'Social';
ALTER TABLE public.group_goals ADD COLUMN IF NOT EXISTS description text;

-- 3. Run a schema cache refresh notification (notifies PostgREST to update its column caching maps immediately)
NOTIFY pgrst, 'reload schema';

-- 4. Confirmation logs
SELECT 'SUCCESS' AS status, 'Altered table structures and notified schema cache reloader successfully.' AS message;

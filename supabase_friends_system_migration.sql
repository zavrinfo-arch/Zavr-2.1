-- ====================================================
-- SUPABASE PRODUCTION-SAFE SQL MIGRATION FOR FRIEND SYSTEM
-- ====================================================
-- This migration fixes the entire Friend System by:
-- 1. Structuring 'friend_requests' for pending invitations.
-- 2. Structuring 'friends' for active friendships (without a 'status' column).
-- 3. Safely migrating legacy data to prevent any friendship loss.
-- 4. Setting up robust Row Level Security (RLS) policies.
-- 5. Creating high-performance indexes.

BEGIN;

-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create friend_requests table if not exists
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- 3. Create friends table if not exists (Ensure no 'status' column in active friendships)
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 4. DATA MIGRATION: Safely migrate legacy data before dropping status column

-- Move pending friendships from 'friends' (if the column exists) to 'friend_requests'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'friends' 
      AND column_name = 'status'
  ) THEN
    -- Migrate pending requests
    INSERT INTO public.friend_requests (sender_id, receiver_id, status, created_at)
    SELECT user_id, friend_id, 'pending', created_at
    FROM public.friends
    WHERE status = 'pending'
    ON CONFLICT (sender_id, receiver_id) DO NOTHING;

    -- Migrate accepted connections and ensure bidirectional rows exist
    -- Row 1: user_id -> friend_id
    INSERT INTO public.friends (user_id, friend_id, created_at)
    SELECT user_id, friend_id, created_at
    FROM public.friends
    WHERE status = 'accepted'
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    -- Row 2: friend_id -> user_id (bidirectional)
    INSERT INTO public.friends (user_id, friend_id, created_at)
    SELECT friend_id, user_id, created_at
    FROM public.friends
    WHERE status = 'accepted'
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    -- Remove pending rows from friends table (since friends table is only for accepted/active friendships now)
    DELETE FROM public.friends WHERE status = 'pending';

    -- Drop the status column from public.friends table as it is no longer needed
    ALTER TABLE public.friends DROP COLUMN status;
  END IF;
END $$;

-- 5. Ensure bidirectional friendships exist for all rows currently in 'friends'
INSERT INTO public.friends (user_id, friend_id, created_at)
SELECT friend_id, user_id, created_at
FROM public.friends
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 6. Add Indexes for high-performance searches and joins
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);

-- 7. Enable Row Level Security (RLS) on both tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 8. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own sent/received requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can insert their own friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can update/respond to their own received requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can delete their own requests" ON public.friend_requests;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can insert their own friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friends;

-- 9. Re-create robust, bulletproof RLS policies

-- FRIEND REQUESTS RLS POLICIES
CREATE POLICY "Users can view their own sent/received requests" 
  ON public.friend_requests FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own friend requests" 
  ON public.friend_requests FOR INSERT 
  WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

CREATE POLICY "Users can update/respond to their own received requests" 
  ON public.friend_requests FOR UPDATE 
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Users can delete their own requests" 
  ON public.friend_requests FOR DELETE 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- FRIENDS (ACTIVE FRIENDSHIPS) RLS POLICIES
CREATE POLICY "Users can view their own friendships" 
  ON public.friends FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert their own friendships" 
  ON public.friends FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND user_id <> friend_id);

CREATE POLICY "Users can delete their own friendships" 
  ON public.friends FOR DELETE 
  USING (auth.uid() = user_id);

COMMIT;

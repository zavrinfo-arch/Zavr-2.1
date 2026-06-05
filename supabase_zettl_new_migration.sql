-- SQL Migration Script for Google Pay-style Zettl tracking

-- 1. Extend Profiles table with personal_details_filled column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_details_filled BOOLEAN DEFAULT FALSE;

-- Sync any existing profiles to have personal_details_filled true if they completed onboarding
UPDATE public.profiles SET personal_details_filled = TRUE WHERE onboarding_completed = TRUE;

-- 2. Create friendships table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS on friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Set up isolation policies for friendships
DROP POLICY IF EXISTS "friendships_isolation" ON public.friendships;
CREATE POLICY "friendships_isolation" ON public.friendships
  FOR ALL
  TO authenticated, service_role
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 3. Create friend_requests_notifications table
CREATE TABLE IF NOT EXISTS public.friend_requests_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.friendships(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE public.friend_requests_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_notifications_isolation" ON public.friend_requests_notifications;
CREATE POLICY "friend_notifications_isolation" ON public.friend_requests_notifications
  FOR ALL
  TO authenticated, service_role
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Create debts, debt_participants, and debt_settlements tables
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('duo', 'group')),
  group_name TEXT,
  total_amount NUMERIC NOT NULL,
  settled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.debt_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_owed NUMERIC NOT NULL,
  paid_status BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(debt_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.debt_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  paid_to UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on debts tables
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_settlements ENABLE ROW LEVEL SECURITY;

-- Set up isolation policies for debts
DROP POLICY IF EXISTS "debts_isolation" ON public.debts;
CREATE POLICY "debts_isolation" ON public.debts
  FOR ALL
  TO authenticated, service_role
  USING (auth.uid() = creator_id OR id IN (SELECT debt_id FROM public.debt_participants WHERE user_id = auth.uid()))
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "participants_isolation" ON public.debt_participants;
CREATE POLICY "participants_isolation" ON public.debt_participants
  FOR ALL
  TO authenticated, service_role
  USING (user_id = auth.uid() OR debt_id IN (SELECT id FROM public.debts WHERE creator_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR debt_id IN (SELECT id FROM public.debts WHERE creator_id = auth.uid()));

DROP POLICY IF EXISTS "settlements_isolation" ON public.debt_settlements;
CREATE POLICY "settlements_isolation" ON public.debt_settlements
  FOR ALL
  TO authenticated, service_role
  USING (paid_by = auth.uid() OR paid_to = auth.uid())
  WITH CHECK (paid_by = auth.uid() OR paid_to = auth.uid());

-- 5. Extend Personal Zettls table with additional tracking columns for backward compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'personal_zettls' AND column_name = 'message'
    ) THEN
        ALTER TABLE personal_zettls ADD COLUMN message TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'personal_zettls' AND column_name = 'seen_at'
    ) THEN
        ALTER TABLE personal_zettls ADD COLUMN seen_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'personal_zettls' AND column_name = 'reminded_at'
    ) THEN
        ALTER TABLE personal_zettls ADD COLUMN reminded_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'personal_zettls' AND column_name = 'transaction_id'
    ) THEN
        ALTER TABLE personal_zettls ADD COLUMN transaction_id TEXT;
    END IF;
END $$;

-- 6. Create activities table for visual chronological feed
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  debt_id UUID, -- links to personal_zettls or debts
  group_debt_id UUID, -- table group placeholder reference
  action TEXT NOT NULL, -- 'requested' | 'paid' | 'reminded' | 'settled' | 'created_group'
  amount NUMERIC NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Setup for activities
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
CREATE POLICY "Users can view their own activities" ON activities
  FOR ALL
  TO authenticated, service_role
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Extend or create notifications table if not exists with unified schema
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'request' | 'payment' | 'reminder' | 'group' | 'streak' | 'goal' | 'achievement' | 'motivational'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- store debt_id, amount, etc.
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT -- compatibility
);

-- Enable RLS on notifications if not enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Setup for notifications
DROP POLICY IF EXISTS "notifications_user_isolation" ON notifications;
CREATE POLICY "notifications_user_isolation" ON notifications
  FOR ALL
  TO authenticated, service_role
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

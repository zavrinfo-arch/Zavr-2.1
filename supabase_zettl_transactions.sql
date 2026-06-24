-- Migration: Set up zettl_transactions table for Zavr split system
-- Run this SQL in your Supabase SQL Editor.

-- 1. Create the zettl_transactions table
CREATE TABLE IF NOT EXISTS public.zettl_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric DEFAULT 0,
  type text NOT NULL CHECK (type in ('owe_you', 'you_owe_me', 'text_only')),
  message_text text,
  deadline timestamp with time zone,
  is_settled boolean DEFAULT false,
  settled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.zettl_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Set up access policies for isolation
DROP POLICY IF EXISTS "zettl_transactions_isolation" ON public.zettl_transactions;
CREATE POLICY "zettl_transactions_isolation" ON public.zettl_transactions
  FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 4. Enable realtime for zettl_transactions
-- Check if the publication 'supabase_realtime' exists, and add table to it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zettl_transactions;
  END IF;
END $$;

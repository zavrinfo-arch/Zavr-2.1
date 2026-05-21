-- SQL Migration Script for Google Pay-style Zettl tracking

-- 1. Extend Personal Zettls table with additional tracking columns
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

-- 2. Create activities table for visual chronological feed
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  debt_id UUID, -- links to personal_zettls
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

-- 3. Extend of create notifications table if not exists with unified schema
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 4. Sample Queries Implementation Reference:
-- Get dashboard summary for current user:
-- SELECT SUM(amount) FILTER (WHERE to_user_id = auth.uid() AND is_settled = false) AS total_lent,
--        SUM(amount) FILTER (WHERE from_user_id = auth.uid() AND is_settled = false) AS total_borrowed
-- FROM personal_zettls;

-- Get all pending requests (money owed TO me):
-- SELECT * FROM personal_zettls WHERE to_user_id = auth.uid() AND is_settled = false;

-- Get all pending payments (money I owe):
-- SELECT * FROM personal_zettls WHERE from_user_id = auth.uid() AND is_settled = false;

-- Get activity timeline:
-- SELECT * FROM activities WHERE user_id = auth.uid() ORDER BY created_at DESC;

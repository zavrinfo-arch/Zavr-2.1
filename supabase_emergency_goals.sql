
-- Emergency Goals Table
CREATE TABLE IF NOT EXISTS emergency_goals (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_amount DECIMAL DEFAULT 0,
  target_amount DECIMAL DEFAULT 0,
  frequency TEXT,
  routine_amount DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  category TEXT DEFAULT 'Emergency'
);

-- Enable RLS
ALTER TABLE emergency_goals ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own emergency goals" ON emergency_goals;
CREATE POLICY "Users can manage their own emergency goals" 
ON emergency_goals FOR ALL 
USING (auth.uid() = user_id);

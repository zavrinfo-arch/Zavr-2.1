-- Migration: Goal and Transaction Management Hardening
-- Date: 2026-04-23

-- 1. Hardening Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to delete their own transactions
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
CREATE POLICY "Users can delete their own transactions" 
ON transactions FOR DELETE 
USING (auth.uid() = user_id);

-- Allow clear all
DROP POLICY IF EXISTS "Users can clear their own history" ON transactions;
CREATE POLICY "Users can clear their own history" 
ON transactions FOR DELETE 
USING (auth.uid() = user_id);


-- 2. Hardening Solo Goals
ALTER TABLE solo_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own solo goals" ON solo_goals;
CREATE POLICY "Users can delete their own solo goals" 
ON solo_goals FOR DELETE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can reset their solo goals" ON solo_goals;
CREATE POLICY "Users can reset their solo goals" 
ON solo_goals FOR UPDATE 
USING (auth.uid() = user_id);


-- 3. Hardening Group Goals
ALTER TABLE group_goals ENABLE ROW LEVEL SECURITY;

-- Allow admins to delete
DROP POLICY IF EXISTS "Admins can delete group goals" ON group_goals;
CREATE POLICY "Admins can delete group goals" 
ON group_goals FOR DELETE 
USING (auth.uid() = creator_id);

-- Allow members to leave (updates the 'members' column)
DROP POLICY IF EXISTS "Members can leave group goals" ON group_goals;
CREATE POLICY "Members can leave group goals" 
ON group_goals FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.goal_id = group_goals.id AND t.user_id = auth.uid()
  )
  OR auth.uid() = creator_id
);

-- Note: The junction table group_goal_members also needs policies
ALTER TABLE group_goal_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can leave group_member records" ON group_goal_members;
CREATE POLICY "Users can leave group_member records" 
ON group_goal_members FOR DELETE 
USING (auth.uid() = user_id);

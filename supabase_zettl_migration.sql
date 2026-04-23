-- Zettl Feature Tables Migration

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Friends Table
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Zettl Groups
CREATE TABLE IF NOT EXISTS zettl_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zettl Group Members
CREATE TABLE IF NOT EXISTS zettl_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES zettl_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Personal Zettls (Debts)
CREATE TABLE IF NOT EXISTS personal_zettls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL, -- who owes
  to_user_id UUID NOT NULL, -- who is owed
  amount INTEGER NOT NULL, -- smallest currency unit
  currency TEXT DEFAULT 'INR',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  reminder_last_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0
);

-- Group Expenses
CREATE TABLE IF NOT EXISTS zettl_group_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES zettl_groups(id) ON DELETE CASCADE NOT NULL,
  paid_by_user_id UUID NOT NULL,
  total_amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Splits
CREATE TABLE IF NOT EXISTS zettl_expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES zettl_group_expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL, -- who owes
  amount_owed INTEGER NOT NULL,
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ
);

-- Reminders Log
CREATE TABLE IF NOT EXISTS zettl_reminders_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zettl_id UUID REFERENCES personal_zettls(id) ON DELETE CASCADE,
  expense_split_id UUID REFERENCES zettl_expense_splits(id) ON DELETE CASCADE,
  reminded_to_user_id UUID NOT NULL,
  reminded_at TIMESTAMPTZ DEFAULT NOW(),
  reminder_type TEXT CHECK (reminder_type IN ('manual', 'auto')),
  notification_sent BOOLEAN DEFAULT TRUE
);

-- Enable RLS on all tables
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE zettl_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE zettl_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_zettls ENABLE ROW LEVEL SECURITY;
ALTER TABLE zettl_group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE zettl_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE zettl_reminders_log ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (simplified for developer account, should be hardened in production)
-- For the sake of this implementation, we'll allow authenticated users to see their own data
CREATE POLICY "Users can see their own friend list" ON friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage their friends" ON friends FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can see groups they belong to" ON zettl_groups FOR SELECT USING (EXISTS (SELECT 1 FROM zettl_group_members WHERE group_id = id AND user_id = auth.uid()));
CREATE POLICY "Users can create groups" ON zettl_groups FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Group members can see other members" ON zettl_group_members FOR SELECT USING (EXISTS (SELECT 1 FROM zettl_group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Users can join/add to groups" ON zettl_group_members FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can see their personal zettls" ON personal_zettls FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can create personal zettls" ON personal_zettls FOR INSERT WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can update their own zettls" ON personal_zettls FOR UPDATE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Group members can see group expenses" ON zettl_group_expenses FOR SELECT USING (EXISTS (SELECT 1 FROM zettl_group_members WHERE group_id = zettl_group_expenses.group_id AND user_id = auth.uid()));
CREATE POLICY "Group members can add expenses" ON zettl_group_expenses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM zettl_group_members WHERE group_id = zettl_group_expenses.group_id AND user_id = auth.uid()));

CREATE POLICY "Group members can see splits" ON zettl_expense_splits FOR SELECT USING (EXISTS (SELECT 1 FROM zettl_group_expenses e JOIN zettl_group_members gm ON e.group_id = gm.group_id WHERE e.id = expense_id AND gm.user_id = auth.uid()));
CREATE POLICY "Group members can update splits" ON zettl_expense_splits FOR UPDATE USING (EXISTS (SELECT 1 FROM zettl_group_expenses e JOIN zettl_group_members gm ON e.group_id = gm.group_id WHERE e.id = expense_id AND gm.user_id = auth.uid()));

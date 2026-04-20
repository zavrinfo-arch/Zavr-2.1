import { supabase } from '../lib/supabase';
import { User, SoloGoal, GroupGoal, Transaction, Notification, StreakData } from '../types';

export const supabaseService = {
  // Helpers
  async ensureSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('Invalid session: Please log in again.');
    return session;
  },

  // Profiles
  async updateProfile(userId: string, updates: Partial<User>) {
    await this.ensureSession();
    // Map camelCase to snake_case for DB
    const dbUpdates: any = { id: userId };
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.dob) dbUpdates.dob = updates.dob;
    if (updates.location) dbUpdates.location = updates.location;
    if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
    if (updates.interests) dbUpdates.interests = updates.interests;
    if (updates.badges) dbUpdates.badges = updates.badges;
    if (updates.lastLoginDate) dbUpdates.last_login_date = updates.lastLoginDate;
    if (updates.preferences) dbUpdates.preferences = updates.preferences;
    if (updates.streakFreezeCount !== undefined) dbUpdates.streak_freeze_count = updates.streakFreezeCount;
    // avatar_id and avatar are omitted as requested because they are missing in the schema

    // Try a safe update: if it fails due to missing columns, we try to update what we can
    // This is more complex for a single upsert, but we can catch the error and suggest fixes
    const { data, error } = await supabase
      .from('profiles')
      .upsert(dbUpdates)
      .select()
      .single();

    if (error && error.code === 'PGRST204') {
       console.warn('Update failed due to missing columns. Attempting minimal update for essential fields.', error.message);
       // Retry with just common fields
       const minimalUpdates: any = { id: userId };
       if (updates.username) minimalUpdates.username = updates.username;
       if (updates.fullName) minimalUpdates.full_name = updates.fullName;
       
       return await supabase
         .from('profiles')
         .upsert(minimalUpdates)
         .select()
         .single();
    }

    return { data, error };
  },

  async getProfile(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      // Map snake_case to camelCase for App
      const user: User = {
        id: data.id,
        fullName: data.full_name,
        username: data.username,
        email: data.email || '', // Fallback if missing
        phone: data.phone,
        dob: data.dob,
        location: data.location,
        avatar: `https://api.dicebear.com/7.x/lorelei/svg?seed=${data.username}`, // Fallback as avatar column is missing
        avatarId: 1, // Fallback as avatar_id column is missing
        streak: data.streak,
        onboardingCompleted: data.onboarding_completed ?? true, // Default to true if missing in DB
        interests: data.interests || [],
        badges: data.badges || [],
        createdAt: data.created_at,
        lastLoginDate: data.last_login_date,
        streakFreezeCount: data.streak_freeze_count,
        xp: data.xp,
        level: data.level,
        preferences: data.preferences
      };
      return { data: user, error };
    }
    return { data, error };
  },

  // Solo Goals
  async getSoloGoals(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('solo_goals')
      .select('*')
      .eq('user_id', userId);
    
    if (data) {
      const mapped = data.map((g: any) => ({
        id: g.id,
        userId: g.user_id,
        name: g.name,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        deadline: g.deadline,
        category: g.category,
        frequency: g.frequency,
        createdAt: g.created_at,
        completed: g.completed,
        completedAt: g.completed_at
      }));
      return { data: mapped, error };
    }
    return { data, error };
  },

  async saveSoloGoal(goal: SoloGoal) {
    await this.ensureSession();
    const dbGoal: any = {
      id: goal.id,
      user_id: goal.userId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: goal.currentAmount,
      deadline: goal.deadline,
      category: goal.category,
      frequency: goal.frequency,
      created_at: goal.createdAt,
      completed: goal.completed,
      completed_at: goal.completedAt
    };

    const { data, error } = await supabase
      .from('solo_goals')
      .upsert(dbGoal)
      .select()
      .single();
    return { data, error };
  },

  async deleteSoloGoal(goalId: string) {
    await this.ensureSession();
    const { error } = await supabase
      .from('solo_goals')
      .delete()
      .eq('id', goalId);
    return { error };
  },

  // Group Goals
  async getGroupGoals() {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('group_goals')
      .select('*');
    
    if (data) {
      const mapped = data.map((g: any) => ({
        id: g.id,
        groupId: g.group_id,
        name: g.name,
        targetAmount: g.target_amount,
        memberCount: g.member_count,
        password: g.password,
        creatorId: g.creator_id,
        members: g.members,
        totalCollected: g.total_collected,
        createdAt: g.created_at,
        deadline: g.deadline,
        frequency: g.frequency,
        completed: g.completed,
        completedAt: g.completed_at
      }));
      return { data: mapped, error };
    }
    return { data, error };
  },

  async saveGroupGoal(goal: GroupGoal) {
    await this.ensureSession();
    const dbGoal: any = {
      id: goal.id,
      group_id: goal.groupId,
      name: goal.name,
      target_amount: goal.targetAmount,
      member_count: goal.memberCount,
      password: goal.password,
      creator_id: goal.creatorId,
      members: goal.members,
      total_collected: goal.totalCollected,
      created_at: goal.createdAt,
      deadline: goal.deadline,
      frequency: goal.frequency,
      completed: goal.completed,
      completed_at: goal.completedAt
    };

    const { data, error } = await supabase
      .from('group_goals')
      .upsert(dbGoal)
      .select()
      .single();
    return { data, error };
  },

  // Transactions
  async getTransactions(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`user_id.eq.${userId},goal_id.in.(select goal_id from group_goal_members where user_id.eq.${userId})`);
    
    if (data) {
      const mapped = data.map((t: any) => ({
        id: t.id,
        goalId: t.goal_id,
        goalName: t.goal_name,
        amount: t.amount,
        type: t.type,
        goalType: t.goal_type,
        timestamp: t.timestamp,
        category: t.category,
        userId: t.user_id
      }));
      return { data: mapped, error };
    }
    return { data, error };
  },

  async saveTransaction(transaction: any) {
    await this.ensureSession();
    const dbTransaction: any = {
      id: transaction.id,
      goal_id: transaction.goalId,
      goal_name: transaction.goalName,
      amount: transaction.amount,
      type: transaction.type,
      goal_type: transaction.goalType,
      timestamp: transaction.timestamp,
      category: transaction.category,
      user_id: transaction.userId
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(dbTransaction)
      .select()
      .single();
    return { data, error };
  },

  // Notifications
  async getNotifications(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });
    
    if (data) {
      const mapped = data.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        timestamp: n.timestamp
      }));
      return { data: mapped, error };
    }
    return { data, error };
  },

  async saveNotification(notification: any) {
    await this.ensureSession();
    const dbNotification: any = {
      id: notification.id,
      user_id: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      timestamp: notification.timestamp
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(dbNotification)
      .select()
      .single();
    return { data, error };
  },

  async markNotificationRead(notificationId: string) {
    await this.ensureSession();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    return { error };
  },

  async markNotificationsRead(userId: string) {
    await this.ensureSession();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);
    return { error };
  }
};

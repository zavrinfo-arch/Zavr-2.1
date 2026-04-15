import { supabase } from '../lib/supabase';
import { User, SoloGoal, GroupGoal, Transaction, Notification, StreakData } from '../types';

export const supabaseService = {
  // Profiles
  async updateProfile(userId: string, updates: Partial<User>) {
    // Map camelCase to snake_case for DB
    const dbUpdates: any = { id: userId };
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.dob) dbUpdates.dob = updates.dob;
    if (updates.location) dbUpdates.location = updates.location;
    if (updates.avatarId) dbUpdates.avatar_id = updates.avatarId;
    if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
    if (updates.interests) dbUpdates.interests = updates.interests;
    if (updates.badges) dbUpdates.badges = updates.badges;
    if (updates.lastLoginDate) dbUpdates.last_login_date = updates.lastLoginDate;
    if (updates.preferences) dbUpdates.preferences = updates.preferences;
    if (updates.streakFreezeCount !== undefined) dbUpdates.streak_freeze_count = updates.streakFreezeCount;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(dbUpdates)
      .select()
      .single();
    return { data, error };
  },

  async getProfile(userId: string) {
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
        avatar: data.avatar,
        avatarId: data.avatar_id,
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
    const { data, error } = await supabase
      .from('solo_goals')
      .select('*')
      .eq('userId', userId);
    return { data, error };
  },

  async saveSoloGoal(goal: SoloGoal) {
    const { data, error } = await supabase
      .from('solo_goals')
      .upsert(goal)
      .select()
      .single();
    return { data, error };
  },

  async deleteSoloGoal(goalId: string) {
    const { error } = await supabase
      .from('solo_goals')
      .delete()
      .eq('id', goalId);
    return { error };
  },

  // Group Goals
  async getGroupGoals() {
    const { data, error } = await supabase
      .from('group_goals')
      .select('*');
    return { data, error };
  },

  async saveGroupGoal(goal: GroupGoal) {
    const { data, error } = await supabase
      .from('group_goals')
      .upsert(goal)
      .select()
      .single();
    return { data, error };
  },

  // Transactions
  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`userId.eq.${userId},goalId.in.(select goalId from group_goal_members where userId.eq.${userId})`);
    return { data, error };
  },

  async saveTransaction(transaction: Transaction) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    return { data, error };
  },

  // Notifications
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .order('timestamp', { ascending: false });
    return { data, error };
  },

  async saveNotification(notification: Notification) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    return { data, error };
  },

  async markNotificationRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    return { error };
  },

  async markNotificationsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('userId', userId);
    return { error };
  }
};

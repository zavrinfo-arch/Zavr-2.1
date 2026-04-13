import { supabase } from '../lib/supabase';
import { User, SoloGoal, GroupGoal, Transaction, Notification, StreakData } from '../types';

export const supabaseService = {
  // Profiles
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateProfile(userId: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .single();
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

  async markNotificationsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('userId', userId);
    return { error };
  }
};

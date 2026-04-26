import { supabase } from '../lib/supabaseClient';
import { User, SoloGoal, GroupGoal, Transaction, Notification, StreakData } from '../types';

export const supabaseService = {
  // Helpers
  async ensureSession() {
    // Attempt to get session from store first to avoid unnecessary gotrue calls
    // which can trigger "Lock stolen" errors in some environments
    try {
      // Use dynamic import to avoid potential circular dependencies
      const { useStore } = await import('../store/useStore');
      const state = useStore.getState();
      const storeSession = state.session;
      
      // Check if session exists and is not expired (buffer of 60 seconds)
      if (storeSession && storeSession.expires_at) {
        const now = Math.floor(Date.now() / 1000);
        const isExpired = storeSession.expires_at <= (now + 60);
        if (!isExpired) {
          return storeSession;
        }
      }
    } catch (e) {
      console.warn('[SUPABASE-SVC] Store session fetch failed, falling back to auth.getSession()', e);
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('Invalid session: Please log in again.');
    return session;
  },

  // Profiles
  async updateProfile(userId: string, updates: Partial<User>) {
    await this.ensureSession();
    console.log('[SUPABASE-SVC] Updating profile for:', userId, updates);
    // Map camelCase to snake_case for DB
    const dbUpdates: any = { id: userId };
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.dob) dbUpdates.dob = updates.dob;
    if (updates.location) dbUpdates.location = updates.location;
    if (updates.avatar) dbUpdates.avatar_url = updates.avatar;
    if (updates.avatarId) dbUpdates.avatar_id = updates.avatarId;
    if (updates.onboardingCompleted !== undefined) dbUpdates.onboarding_completed = updates.onboardingCompleted;
    
    // Always update the timestamp
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) console.error('[SUPABASE-SVC] Update profile error:', error);
    return { data, error };
  },

  async getProfile(userId: string) {
    await this.ensureSession();
    console.log('[SUPABASE-SVC] Gathering profile for:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) console.error('[SUPABASE-SVC] Get profile error:', error);
    
    if (data) {
      console.log('[SUPABASE-SVC] Profile data found:', data.onboarding_completed);
      // Map snake_case to camelCase for App
      const user: User = {
        id: data.id,
        fullName: data.full_name,
        username: data.username,
        email: data.email || '',
        phone: data.phone,
        dob: data.dob,
        location: data.location,
        avatar: data.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${data.username}`,
        avatarId: data.avatar_id,
        streak: data.streak || 0,
        onboardingCompleted: data.onboarding_completed,
        interests: data.interests || [],
        badges: data.badges || [],
        createdAt: data.created_at,
        lastLoginDate: data.last_login_date,
        streakFreezeCount: data.streak_freeze_count || 0,
        xp: data.xp || 0,
        level: data.level || 1,
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

  // Emergency Goals
  async getEmergencyGoals(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('emergency_goals')
      .select('*')
      .eq('user_id', userId);
    
    if (data) {
      const mapped = data.map((g: any) => ({
        id: g.id,
        userId: g.user_id,
        name: g.name,
        currentAmount: g.current_amount,
        frequency: g.frequency,
        routineAmount: g.routine_amount,
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
      .maybeSingle();
    return { data, error };
  },

  async saveEmergencyGoal(goal: any) {
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
      completed_at: goal.completedAt,
      routine_amount: goal.routineAmount
    };

    const { data, error } = await supabase
      .from('emergency_goals') 
      .upsert(dbGoal)
      .select()
      .maybeSingle();
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

  async deleteEmergencyGoal(goalId: string) {
    await this.ensureSession();
    const { error } = await supabase
      .from('emergency_goals') 
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
      .maybeSingle();
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
      .maybeSingle();
    return { data, error };
  },

  async deleteGroupGoal(goalId: string) {
    await this.ensureSession();
    // 1. Delete transactions
    await supabase.from('transactions').delete().eq('goal_id', goalId);
    // 2. Delete the goal (cascades or manual member cleanup)
    const { error } = await supabase.from('group_goals').delete().eq('id', goalId);
    return { error };
  },

  async leaveGroup(goalId: string, userId: string) {
    await this.ensureSession();
    // 1. Fetch current goal state
    const { data: goal } = await supabase.from('group_goals').select('*').eq('id', goalId).maybeSingle();
    if (!goal) throw new Error('Goal not found');

    // 2. Update members array (JSONB)
    const updatedMembers = goal.members.filter((m: any) => m.userId !== userId);
    const { error } = await supabase
      .from('group_goals')
      .update({ members: updatedMembers })
      .eq('id', goalId);

    // 3. Remove from junction table if exists
    await supabase.from('group_goal_members').delete().eq('goal_id', goalId).eq('user_id', userId);

    return { error };
  },

  async transferAdminRole(goalId: string, newAdminId: string) {
    await this.ensureSession();
    const { error } = await supabase
      .from('group_goals')
      .update({ creator_id: newAdminId })
      .eq('id', goalId);
    return { error };
  },

  async deleteTransaction(transactionId: string) {
    await this.ensureSession();
    // 1. Get info
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).maybeSingle();
    if (!tx) throw new Error('Transaction not found');

    const { amount, type, goal_id, goal_type } = tx;

    // 2. Update balance
    const table = goal_type === 'solo' ? 'solo_goals' : goal_type === 'group' ? 'group_goals' : 'emergency_goals';
    const field = goal_type === 'group' ? 'total_collected' : 'current_amount';

    const { data: goal } = await supabase.from(table).select(field).eq('id', goal_id).maybeSingle();
    if (goal) {
      const adjustment = type === 'deposit' ? -amount : amount;
      await supabase.from(table).update({ [field]: goal[field] + adjustment }).eq('id', goal_id);
    }

    // 3. Delete
    const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
    return { error };
  },

  async clearAllTransactions(userId: string) {
    await this.ensureSession();
    // 1. Delete all transactions
    const { error } = await supabase.from('transactions').delete().eq('user_id', userId);
    if (error) return { error };

    // 2. Reset balances
    await supabase.from('solo_goals').update({ current_amount: 0 }).eq('user_id', userId);
    await supabase.from('emergency_goals').update({ current_amount: 0 }).eq('user_id', userId);
    
    // For group goals, we usually only reset the specific creator's collected if we want to be aggressive,
    // but the user said "reset all goal balances to zero".
    await supabase.from('group_goals').update({ total_collected: 0 }).eq('creator_id', userId);

    return { error: null };
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
      .maybeSingle();
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

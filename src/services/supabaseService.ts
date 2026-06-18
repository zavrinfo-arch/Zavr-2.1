import { supabase } from '../lib/supabaseClient';
import { User, SoloGoal, GroupGoal, Transaction, Notification, StreakData } from '../types';

let cachedUseStore: any = null;
let getProfileCache: { userId: string; timestamp: number; data: any; error: any } | null = null;

export const supabaseService = {
  // Helpers
  async ensureSession() {
    // Attempt to get session from store first to avoid unnecessary gotrue calls
    // which can trigger "Lock stolen" errors in some environments
    try {
      if (!cachedUseStore) {
        // Cache the dynamic store import to run once in application lifecycle
        const { useStore } = await import('../store/useStore');
        cachedUseStore = useStore;
      }
      const state = cachedUseStore.getState();
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
    getProfileCache = null; // Invalidate profile cache upon updates
    const session = await this.ensureSession();
    console.log('[SUPABASE-SVC] Updating profile for:', userId, updates);
    
    try {
      const user = session?.user;

      // If no user, stop execution
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Prepare updates to profiles table
      const profilesUpdates: any = { 
        id: userId,
        updated_at: new Date().toISOString()
      };
      
      const cleaningUsername = updates.username ? updates.username.toLowerCase().trim() : undefined;
      
      if (updates.fullName !== undefined) profilesUpdates.full_name = updates.fullName;
      if (cleaningUsername !== undefined) profilesUpdates.username = cleaningUsername;
      
      // Map email from updates or active session user to guarantee it is NEVER null in profiles
      if (updates.email) {
        profilesUpdates.email = updates.email;
      } else if (user.email) {
        profilesUpdates.email = user.email;
      }
      
      if (updates.phone !== undefined) profilesUpdates.phone = updates.phone;
      if (updates.dob !== undefined) {
        profilesUpdates.birth_date = updates.dob;
        profilesUpdates.dob = updates.dob;
      }
      if (updates.gender !== undefined) profilesUpdates.gender = updates.gender;
      if (updates.avatar !== undefined) profilesUpdates.avatar_url = updates.avatar;
      
      if (updates.location !== undefined) profilesUpdates.location = updates.location;
      if (updates.avatarId !== undefined) profilesUpdates.avatar_id = updates.avatarId;
      if (updates.onboardingCompleted !== undefined) profilesUpdates.onboarding_completed = updates.onboardingCompleted;
      if (updates.personalDetailsFilled !== undefined) profilesUpdates.personal_details_filled = updates.personalDetailsFilled;
      if ((updates as any).savingCategories !== undefined) profilesUpdates.saving_categories = (updates as any).savingCategories;

      let profilesError = null;
      let data = null;
      let maxAttempts = 3;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;
        console.log(`[SUPABASE-SVC] Executing upsert on profiles (attempt ${attempt}):`, profilesUpdates);
        const res = await supabase
          .from('profiles')
          .upsert({ ...profilesUpdates })
          .select()
          .maybeSingle();

        if (!res.error) {
          data = res.data;
          profilesError = null;
          break;
        }

        profilesError = res.error;
        console.warn(`[SUPABASE-SVC] profiles upsert attempt ${attempt} failed:`, profilesError.message);

        // Code 42703 is Postgres "undefined_column" - clean and retry
        if (profilesError.code === '42703' || profilesError.message?.includes('column')) {
          const match = profilesError.message.match(/column "(.*?)"/) || profilesError.message.match(/column '(.*?)'/);
          if (match && match[1]) {
            const missingCol = match[1];
            console.warn(`[SUPABASE-SVC] Purging missing column "${missingCol}" from profiles payload and retrying...`);
            delete profilesUpdates[missingCol];
          } else {
            if (profilesUpdates.personal_details_filled !== undefined) {
              delete profilesUpdates.personal_details_filled;
            } else if (profilesUpdates.avatar_id !== undefined) {
              delete profilesUpdates.avatar_id;
            } else {
              break;
            }
          }
        } else {
          break;
        }
      }

      if (profilesError) {
        console.warn('[SUPABASE-SVC] Warning: profiles update reported error:', profilesError);
      }

      return { data, error: profilesError };
    } catch (err: any) {
      console.error('[SUPABASE-SVC] Unexpected error in updateProfile:', err);
      return { data: null, error: err };
    }
  },

  setProfileCache(userId: string, data: any) {
    getProfileCache = {
      userId,
      timestamp: Date.now(),
      data,
      error: null
    };
  },

  async getProfile(userId: string) {
    const now = Date.now();
    if (getProfileCache && getProfileCache.userId === userId && (now - getProfileCache.timestamp < 10000)) {
      console.log('[SUPABASE-SVC] Returning cached profile for:', userId);
      return { data: getProfileCache.data, error: getProfileCache.error };
    }

    await this.ensureSession();
    console.log('[SUPABASE-SVC] Gathering profile for:', userId);
    let { data, error } = await supabase
      .from('profiles')
      .select('id,full_name,username,email,phone,birth_date,dob,location,avatar_url,avatar_id,streak,onboarding_completed,interests,badges,created_at,last_login_date,streak_freeze_count,xp,level,preferences')
      .eq('id', userId)
      .maybeSingle();
    
    // Fallback if some columns are missing from the DB schema
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      console.warn('[SUPABASE-SVC] Profiles column missing error, falling back to verified columns query...');
      const fallbackQuery = await supabase
        .from('profiles')
        .select('id,full_name,username,email,phone,birth_date,dob,avatar_url,avatar_id,onboarding_completed,created_at,last_login_at')
        .eq('id', userId)
        .maybeSingle();
      
      if (fallbackQuery.data) {
        data = {
          ...fallbackQuery.data,
          location: '',
          streak: 0,
          xp: 0,
          level: 1,
          streak_freeze_count: 0,
          interests: [],
          badges: [],
          preferences: {
            currency: "INR",
            notificationsEnabled: true,
            reminders: {enabled: true, time: "20:00", frequency: "daily"}
          },
          last_login_date: (fallbackQuery.data as any).last_login_at
        };
        error = null;
      } else {
        error = fallbackQuery.error || error;
      }
    }
    
    if (error) {
      console.error('[SUPABASE-SVC] Get profile error:', error);
      return { data: null, error };
    }
    
    if (data) {
      console.log('[SUPABASE-SVC] Profile data found:', data.onboarding_completed);
      // Map snake_case to camelCase for App
      const user: User = {
        id: data.id,
        fullName: data.full_name,
        username: data.username,
        email: data.email || '',
        phone: data.phone,
        dob: data.birth_date || data.dob,
        location: data.location,
        avatar: data.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${data.username}`,
        avatarId: data.avatar_id,
        streak: data.streak || 0,
        onboardingCompleted: data.onboarding_completed,
        interests: data.interests || [],
        badges: data.badges || [],
        createdAt: data.created_at,
        lastLoginDate: data.last_login_date || (data as any).last_login_at,
        streakFreezeCount: data.streak_freeze_count || 0,
        xp: data.xp || 0,
        level: data.level || 1,
        preferences: data.preferences
      };
      // Save to cache
      getProfileCache = {
        userId,
        timestamp: now,
        data: user,
        error: null
      };
      return { data: user, error: null };
    }

    return { data: null, error: null };
  },

  // Solo Goals
  async getSoloGoals(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('solo_goals')
      .select('id,user_id,name,target_amount,current_amount,deadline,category,frequency,created_at,completed,completed_at')
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
    let { data, error } = await supabase
      .from('emergency_goals')
      .select('id,user_id,name,target_amount,current_amount,category,frequency,created_at,completed,completed_at,routine_amount')
      .eq('user_id', userId);
    
    // Fallback if columns like category/routine_amount are missing from database
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      console.warn('[SUPABASE] Emergency goals column missing error, using minimal fallback query...');
      const fallbackQuery = await supabase
        .from('emergency_goals')
        .select('id,user_id,name,target_amount,current_amount,created_at')
        .eq('user_id', userId);
      
      if (fallbackQuery.data) {
        data = fallbackQuery.data.map((g: any) => ({
          ...g,
          category: 'Emergency',
          frequency: 'weekly',
          routine_amount: 100,
          completed: false,
          completed_at: null
        }));
        error = null;
      } else {
        error = fallbackQuery.error;
      }
    }

    if (data) {
      const mapped = data.map((g: any) => ({
        id: g.id,
        userId: g.user_id,
        name: g.name,
        currentAmount: g.current_amount || 0,
        frequency: g.frequency || 'weekly',
        routineAmount: g.routine_amount || 100,
        createdAt: g.created_at,
        completed: g.completed || false,
        completedAt: g.completed_at || null
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
    const fullDbGoal: any = {
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

    let { data, error } = await supabase
      .from('emergency_goals') 
      .upsert(fullDbGoal)
      .select()
      .maybeSingle();

    // Fallback if columns are missing
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      console.warn('[SUPABASE] Save emergency goal failed due to column mismatch, falling back to minimal schema insertion...');
      const minimalDbGoal = {
        id: goal.id,
        user_id: goal.userId,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        created_at: goal.createdAt
      };
      const fallback = await supabase
        .from('emergency_goals')
        .upsert(minimalDbGoal)
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
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
    let { data, error } = await supabase
      .from('group_goals')
      .select('id,group_id,name,target_amount,member_count,password,creator_id,members,total_collected,created_at,deadline,frequency,completed,completed_at');
    
    // Fallback if columns like group_id or members are missing
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      console.warn('[SUPABASE] Group goals column missing error, using minimal fallback query...');
      const fallbackQuery = await supabase
        .from('group_goals')
        .select('id,name,target_amount,current_amount,deadline,created_at,completed');
      
      if (fallbackQuery.data) {
        data = fallbackQuery.data.map((g: any) => ({
          id: g.id,
          group_id: g.code || `ZAVR-${g.id.substring(0,6).toUpperCase()}`,
          name: g.name,
          target_amount: g.target_amount,
          member_count: 1,
          password: '',
          creator_id: null,
          members: [],
          total_collected: g.current_amount || 0,
          created_at: g.created_at,
          deadline: g.deadline,
          frequency: 'weekly',
          completed: g.completed,
          completed_at: null
        }));
        error = null;
      } else {
        error = fallbackQuery.error;
      }
    }

    if (data) {
      const mapped = data.map((g: any) => ({
        id: g.id,
        groupId: g.group_id || g.groupId || `ZAVR-${g.id.substring(0,6).toUpperCase()}`,
        name: g.name,
        targetAmount: g.target_amount,
        memberCount: g.member_count || 1,
        password: g.password || '',
        creatorId: g.creator_id || null,
        members: g.members || [],
        totalCollected: g.total_collected || g.current_amount || 0,
        createdAt: g.created_at,
        deadline: g.deadline,
        frequency: g.frequency || 'weekly',
        completed: g.completed || false,
        completedAt: g.completed_at || null
      }));
      return { data: mapped, error };
    }
    return { data, error };
  },

  async saveGroupGoal(goal: GroupGoal) {
    await this.ensureSession();
    const fullDbGoal: any = {
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

    let { data, error } = await supabase
      .from('group_goals')
      .upsert(fullDbGoal)
      .select()
      .maybeSingle();

    // Fallback if columns are missing
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      console.warn('[SUPABASE] Save group goal failed due to column mismatch, falling back to minimal original columns...');
      const minimalDbGoal = {
        id: goal.id,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.totalCollected,
        deadline: goal.deadline,
        code: goal.groupId || `ZAVR-${goal.id.substring(0,6).toUpperCase()}`,
        created_at: goal.createdAt,
        completed: goal.completed
      };
      const fallback = await supabase
        .from('group_goals')
        .upsert(minimalDbGoal)
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    return { data, error };
  },

  // Transactions
  async getTransactions(userId: string) {
    await this.ensureSession();
    const { data, error } = await supabase
      .from('transactions')
      .select('id,goal_id,goal_name,amount,type,goal_type,timestamp,category,user_id')
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
      .select('id,user_id,title,message,type,read,timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session } from '@supabase/supabase-js';
import { 
  User, SoloGoal, GroupGoal, Transaction, Notification, 
  WeeklyChallenge, StreakData, Currency, Badge, EmergencyGoal,
  Quest, FocusSession, Friend, ZettlGroup, PersonalZettl
} from '../types';
import { isSameDay, differenceInHours, parseISO, startOfWeek, isAfter, format } from 'date-fns';
import { supabaseService } from '../services/supabaseService';
import { supabase, isConfigured } from '../lib/supabaseClient';
import { fetchWithRetry } from '../lib/utils';
import { setOnboardingCookie } from '../../lib/onboarding';

interface AppState {
  users: User[];
  currentUser: User | null;
  session: Session | null;
  soloGoals: SoloGoal[];
  groupGoals: GroupGoal[];
  emergencyGoals: EmergencyGoal[];
  transactions: Transaction[];
  notifications: Notification[];
  streakData: StreakData;
  weeklyChallenge: WeeklyChallenge | null;
  theme: 'light' | 'dark';
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  focusSessions: FocusSession[];
  isAuthLoading: boolean;
  
  // Zettl State
  zettlFriends: Friend[];
  zettlGroups: ZettlGroup[];
  personalZettls: PersonalZettl[];
  
  // Zettl Actions
  fetchZettlData: () => Promise<void>;
  searchZettlUsers: (query: string) => Promise<User[]>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  respondToFriendRequest: (requestId: string, status: 'accepted' | 'declined') => Promise<void>;
  createZettlGroup: (name: string, memberIds: string[]) => Promise<void>;
  createPersonalZettl: (data: { friendId: string, amount: number, note: string, dueDate?: string, direction: 'lent' | 'borrowed' }) => Promise<void>;
  settleZettl: (id: string) => Promise<void>;
  remindZettl: (id: string) => Promise<void>;
  addGroupExpense: (data: { groupId: string, amount: number, description: string, splits: { userId: string, amountOwed: number }[] }) => Promise<void>;

  // Auth Actions
  setCurrentUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  addUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  checkAuth: (isInitial?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => void;
  
  // Goal Actions
  addSoloGoal: (goal: SoloGoal) => void;
  updateSoloGoal: (id: string, updates: Partial<SoloGoal>) => void;
  deleteSoloGoal: (id: string) => void;
  addEmergencyGoal: (goal: EmergencyGoal) => void;
  updateEmergencyGoal: (id: string, updates: Partial<EmergencyGoal>) => void;
  deleteEmergencyGoal: (id: string) => void;
  addGroupGoal: (goal: GroupGoal) => void;
  updateGroupGoal: (id: string, updates: Partial<GroupGoal>) => void;
  deleteGroupGoal: (id: string) => Promise<void>;
  joinGroupGoal: (groupId: string, password?: string) => { success: boolean; message: string };
  leaveGroupGoal: (id: string) => Promise<void>;
  transferAdminRole: (goalId: string, userId: string) => Promise<void>;
  removeGroupMember: (goalId: string, userId: string) => void;
  
  // Transaction & Contribution
  addContribution: (goalId: string, amount: number, type: 'solo' | 'group' | 'emergency') => void;
  withdrawMoney: (goalId: string, amount: number, type: 'solo' | 'group' | 'emergency') => void;
  deleteTransaction: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  
  // Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  
  // Streak & Badges
  checkStreak: () => void;
  
  // Weekly Challenge
  resetWeeklyChallenge: () => void;
  updateChallengeProgress: (amount: number) => void;

  // Reminders & Motivation
  checkReminders: () => void;
  triggerMotivation: () => void;
  refreshData: () => Promise<void>;
  nudgeGroup: (goalId: string) => void;
  clearGoalHistory: (goalId: string, type: 'solo' | 'group' | 'emergency') => Promise<void>;
  
  // New Gaming Actions
  addXP: (amount: number) => void;
  updateQuestProgress: (questId: string, amount: number) => void;
  buyStreakFreeze: () => { success: boolean; message: string };
  startFocusSession: (type: 'study' | 'break', duration: number) => void;
  completeFocusSession: (id: string) => void;
}

const CHALLENGES = [
  { id: '1', title: '3-Day Streak', description: 'Maintain a 3-day saving streak', target: 3, rewardXP: 100 },
  { id: '2', title: 'Save ₹500', description: 'Save a total of ₹500 this week', target: 500, rewardXP: 150 },
  { id: '3', title: '5 Transactions', description: 'Make 5 separate contributions', target: 5, rewardXP: 120 },
  { id: '4', title: 'Group Contribution', description: 'Contribute to any group goal', target: 1, rewardXP: 200 },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      session: null,
      soloGoals: [],
      groupGoals: [],
      emergencyGoals: [],
      transactions: [],
      notifications: [],
      streakData: {
        currentStreak: 0,
        lastContributionDate: null,
        streakHistory: [],
        tier: 'Bronze',
        multiplier: 1.0,
      },
      weeklyChallenge: null,
      theme: 'dark',
      dailyQuests: [
        { id: 'd1', title: 'Daily Login', description: 'Log in today', target: 1, progress: 0, rewardXP: 25, type: 'daily', completed: false },
        { id: 'd2', title: 'Bell Ringer', description: 'Click notification bell 3 times', target: 3, progress: 0, rewardXP: 15, type: 'daily', completed: false },
        { id: 'd3', title: 'Streak Check', description: 'Check your streak', target: 1, progress: 0, rewardXP: 10, type: 'daily', completed: false },
        { id: 'd4', title: 'Share the Love', description: 'Share app with 1 friend', target: 1, progress: 0, rewardXP: 50, type: 'daily', completed: false },
      ],
      weeklyQuests: [
        { id: 'w1', title: 'Streak Master', description: 'Maintain streak all week', target: 7, progress: 0, rewardXP: 200, type: 'weekly', completed: false },
        { id: 'w2', title: 'Active Listener', description: 'Reach 5 notification clicks', target: 5, progress: 0, rewardXP: 75, type: 'weekly', completed: false },
        { id: 'w3', title: 'Level Up!', description: 'Level up twice', target: 2, progress: 0, rewardXP: 150, type: 'weekly', completed: false },
      ],
      focusSessions: [],
      isAuthLoading: true,
      
      // Zettl Initial State
      zettlFriends: [],
      zettlGroups: [],
      personalZettls: [],

      // Zettl Actions
      fetchZettlData: async () => {
        try {
          const [friends, groups, zettls, dashboard] = await Promise.all([
            fetchWithRetry('/api/friends/list', { credentials: 'include' }).then(r => r.json()).catch(() => []),
            fetchWithRetry('/api/zettl/groups/my', { credentials: 'include' }).then(r => r.json()).catch(() => []),
            fetchWithRetry('/api/zettl/personal/list', { credentials: 'include' }).then(r => r.json()).catch(() => []),
            fetchWithRetry('/api/zettl/dashboard', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
          ]);
          
          set({ 
            zettlFriends: Array.isArray(friends) ? friends.map((f: any) => ({
              id: f.id,
              userId: f.user_id,
              friendId: f.friend_id,
              friendUsername: f.friend.username,
              friendFullName: f.friend.full_name,
              friendAvatar: f.friend.avatar_url,
              status: f.status,
              createdAt: f.created_at,
              type: f.type
            })) : [],
            zettlGroups: Array.isArray(groups) ? groups.map((g: any) => ({
              ...g,
              memberCount: g.members?.length || 0,
              myBalance: 0 // Will be calculated by summary if needed
            })) : [],
            personalZettls: Array.isArray(zettls) ? zettls.map((z: any) => ({
              id: z.id,
              fromUserId: z.from_user_id,
              toUserId: z.to_user_id,
              fromUsername: z.from_profile?.username || 'Unknown',
              toUsername: z.to_profile?.username || 'Unknown',
              amount: z.amount,
              currency: z.currency,
              note: z.note,
              createdAt: z.created_at,
              dueDate: z.due_date,
              isSettled: z.is_settled,
              settledAt: z.settled_at,
              reminderLastSentAt: z.reminder_last_sent_at,
              reminderCount: z.reminder_count
            })) : []
          });
        } catch (err) {
          console.error('Fetch Zettl data failed:', err);
          // Ensure state remains consistent even on partial failure
          set({ zettlFriends: [], zettlGroups: [], personalZettls: [] });
        }
      },

      searchZettlUsers: async (query) => {
        try {
          const res = await fetchWithRetry(`/api/users/search?q=${query}`, { credentials: 'include' });
          return await res.json();
        } catch (err) {
          return [];
        }
      },

      sendFriendRequest: async (friendId) => {
        await fetchWithRetry('/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendId }),
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      respondToFriendRequest: async (requestId, status) => {
        const path = status === 'accepted' ? `/api/friends/accept/${requestId}` : `/api/friends/decline/${requestId}`;
        await fetchWithRetry(path, {
          method: 'POST',
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      createZettlGroup: async (name, memberIds) => {
        await fetchWithRetry('/api/zettl/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, memberIds }),
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      createPersonalZettl: async (data) => {
        await fetchWithRetry('/api/zettl/personal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      settleZettl: async (id) => {
        await fetchWithRetry(`/api/zettl/personal/${id}/settle`, {
          method: 'PUT',
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      remindZettl: async (id) => {
        const res = await fetchWithRetry(`/api/zettl/personal/${id}/remind`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        await get().fetchZettlData();
      },

      addGroupExpense: async (data) => {
        await fetchWithRetry(`/api/zettl/groups/${data.groupId}/expense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });
        await get().fetchZettlData();
      },

      setCurrentUser: (user) => {
        set({ currentUser: user });
        if (user) {
          get().refreshData();
          get().checkStreak();
        }
      },

      setSession: (session) => {
        set({ session });
      },
         checkAuth: async (isInitial = false) => {
        // Debounce concurrent calls
        if ((window as any).__authCheckInProgress) {
          console.log('[AUTH] Auth check already in progress, skipping concurrent call.');
          return;
        }
        (window as any).__authCheckInProgress = true;

        // Prevent clearing loading state too early if another check is in progress
        set({ isAuthLoading: true });
        console.log('[AUTH] Checking authentication status...');
        
        try {
          // 1. Get session directly from Supabase client for highest accuracy
          const { data: { session: sbSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('[AUTH] Session error:', sessionError.message);
            throw sessionError;
          }
          
          if (sbSession) {
            console.log('[AUTH] Session found for user:', sbSession.user.id);
            set({ session: sbSession });

            // 2. Fetch profile from user_profiles table - use maybeSingle() to avoid throwing on empty
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', sbSession.user.id)
              .maybeSingle();

            console.log('[AUTH] Raw Profile from DB:', profile);
            console.log('[AUTH] Profile Error:', profileError);

            if (profileError) {
              console.error('[AUTH] Profile fetch error:', profileError.message);
              // Don't throw here, just set user to null so onboarding can happen
              set({ currentUser: null });
            } else if (profile) {
              // Map snake_case to camelCase
              const mappedUser: User = {
                id: profile.id,
                fullName: profile.full_name,
                username: profile.username,
                email: profile.email || sbSession.user.email || '',
                phone: profile.phone,
                dob: profile.dob,
                location: profile.location,
                avatar: profile.avatar_url,
                avatarId: profile.avatar_id,
                onboardingCompleted: profile.onboarding_completed,
                interests: profile.interests || [],
                xp: profile.xp || 0,
                level: profile.level || 1,
                badges: profile.badges || [],
                streak: profile.streak || 0,
                createdAt: profile.created_at,
                lastLoginDate: profile.last_login_date,
                streakFreezeCount: profile.streak_freeze_count || 0,
                preferences: profile.preferences || {
                  currency: 'INR',
                  notificationsEnabled: true,
                  reminders: { enabled: true, time: '20:00', frequency: 'daily' }
                }
              };
              set({ currentUser: mappedUser });
              console.log('[AUTH] User set in store. Onboarding completed:', mappedUser.onboardingCompleted);
            } else {
              console.log('[AUTH] No profile found in DB for user ID:', sbSession.user.id);
              set({ currentUser: null });
            }
          } else {
            console.log('[AUTH] No session found.');
            set({ currentUser: null, session: null });
          }
        } catch (error: any) {
          console.error('[AUTH] Critical auth check failure:', error);
          set({ currentUser: null, session: null });
        } finally {
          console.log('[AUTH] Auth verification complete.');
          (window as any).__authCheckInProgress = false;
          set({ isAuthLoading: false });
        }
      },

      signOut: async () => {
        console.log('Starting signOut process...');
        try {
          await fetchWithRetry('/api/auth/signout', { method: 'POST', credentials: 'include' });
          await supabase.auth.signOut();
          set({ currentUser: null, session: null });
        } catch (error) {
          console.error('Sign out failed:', error);
          set({ currentUser: null });
        }
      },
      
      initializeAuth: () => {
        if (!isConfigured) {
          console.log('[AUTH] Supabase not configured, skipping initializeAuth');
          set({ isAuthLoading: false });
          return;
        }

        if ((window as any).__supabaseInitialAuthHandled) {
          console.log('[AUTH] initializeAuth already handled, skipping');
          return;
        }
        (window as any).__supabaseInitialAuthHandled = true;

        console.log('[AUTH] Initializing global auth monitoring...');
        
        // Initial check - ensure it runs and clears loading state
        get().checkAuth(true).catch(err => {
          console.error('[AUTH] Initial check failed:', err);
          set({ isAuthLoading: false });
        });

        // Set up listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          console.log(`[AUTH] Global Security Event: ${event}`, session?.user?.id || 'No User');
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (session) {
              // Only re-trigger full check if session changed or was missing
              const currentSession = get().session;
              if (!currentSession || currentSession.access_token !== session.access_token || event === 'SIGNED_IN') {
                set({ session });
                await get().checkAuth();
              }
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] User signed out, clearing state.');
            set({ currentUser: null, session: null, isAuthLoading: false });
          }
        });

        // Safety timeout: If still loading after 8 seconds, clear it to prevent perpetual splash
        setTimeout(() => {
          if (get().isAuthLoading) {
            console.warn('[AUTH] Safety timeout triggered: clearing hang loading state.');
            set({ isAuthLoading: false });
          }
        }, 8000);
      },

      addUser: async (user) => {
        set((state) => ({ users: [...state.users, user] }));
        await supabaseService.updateProfile(user.id, user);
      },
      
      updateUser: async (updates) => {
        const state = get();
        let baseUser = state.currentUser;
        
        if (!baseUser) {
          if (state.session?.user) {
            console.log('[STORE] No currentUser found, but session exists. Initializing skeleton user from session metadata.');
            const u = state.session.user;
            baseUser = {
              id: u.id,
              email: u.email || '',
              fullName: u.user_metadata?.full_name || '',
              username: u.user_metadata?.user_name || '',
              avatar: u.user_metadata?.avatar_url || '',
              avatarId: '',
              onboardingCompleted: false,
              xp: 0,
              level: 1,
              badges: [],
              streak: 0,
              interests: [],
              createdAt: new Date().toISOString(),
              preferences: {
                currency: 'INR',
                notificationsEnabled: true,
                reminders: { enabled: true, time: '20:00', frequency: 'daily' }
              }
            } as any;
          } else {
            console.error('[STORE] Cannot update user: no currentUser in state and no session found');
            return;
          }
        }
        
        console.log('[STORE] Updating user profile with:', updates);
        const updatedUser = { ...baseUser, ...updates };
        
        // Level up logic - every 500 XP
        let newLevel = updatedUser.level;
        const xpForNextLevel = (newLevel || 1) * 500;
        if (updatedUser.xp >= xpForNextLevel) {
          newLevel = (newLevel || 1) + 1;
          get().addNotification({
            userId: updatedUser.id,
            title: 'Level Up!',
            message: `Congratulations! You've reached Level ${newLevel}!`,
            type: 'achievement'
          });
          // Update quest progress for weekly level up quest
          get().updateQuestProgress('w3', 1);
        }

        const finalUser = { ...updatedUser, level: newLevel };
        
        // SYNC COOKIE IF ONBOARDING COMPLETED
        if (updates.onboardingCompleted === true) {
          console.log('[STORE] Onboarding complete detected. Syncing cookies for middleware.');
          setOnboardingCookie(finalUser.avatarId || '1');
        }

        console.log('[STORE] Setting local state for currentUser:', finalUser.onboardingCompleted);
        set({
          currentUser: finalUser,
          users: state.users.map(u => u.id === finalUser.id ? finalUser : u)
        });

        console.log('[STORE] Calling remote updateProfile...');
        const { error } = await supabaseService.updateProfile(finalUser.id, {
          ...updates,
          updated_at: new Date()
        } as any);

        if (error) {
          console.error('[STORE] Remote sync failed, but local state preserved:', error);
        } else {
          // Re-fetch to ensure sync with server
          console.log('[STORE] Profile updated on server, re-verifying auth state...');
          await get().checkAuth();
          console.log('[STORE] Auth state re-verified. Final completion state:', get().currentUser?.onboardingCompleted);
        }
      },

      // Escape hatch: Force completion if UI gets stuck
      forceCompleteOnboarding: () => {
        const state = get();
        if (!state.currentUser) return;
        console.warn('[ESCAPE HATCH] Forcing onboarding completion');
        state.updateUser({ onboardingCompleted: true });
      },

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      addSoloGoal: async (goal) => {
        set((state) => ({ soloGoals: [...state.soloGoals, goal] }));
        await supabaseService.saveSoloGoal(goal);
      },
      
      updateSoloGoal: async (id, updates) => {
        set((state) => ({
          soloGoals: state.soloGoals.map(g => g.id === id ? { ...g, ...updates } : g)
        }));
        const updatedGoal = get().soloGoals.find(g => g.id === id);
        if (updatedGoal) {
          await supabaseService.saveSoloGoal(updatedGoal);
        }
      },

      deleteSoloGoal: async (id) => {
        set((state) => ({
          soloGoals: state.soloGoals.filter(g => g.id !== id)
        }));
        await supabaseService.deleteSoloGoal(id);
      },

      addEmergencyGoal: async (goal) => {
        set((state) => ({ emergencyGoals: [...state.emergencyGoals, goal] }));
        await supabaseService.saveEmergencyGoal(goal);
      },

      updateEmergencyGoal: async (id, updates) => {
        set((state) => ({
          emergencyGoals: state.emergencyGoals.map(g => g.id === id ? { ...g, ...updates } : g)
        }));
        const updatedGoal = get().emergencyGoals.find(g => g.id === id);
        if (updatedGoal) {
          await supabaseService.saveEmergencyGoal(updatedGoal);
        }
      },

      deleteEmergencyGoal: async (id) => {
        set((state) => ({
          emergencyGoals: state.emergencyGoals.filter(g => g.id !== id)
        }));
        await supabaseService.deleteEmergencyGoal(id);
      },

      addGroupGoal: async (goal) => {
        set((state) => ({ groupGoals: [...state.groupGoals, goal] }));
        await supabaseService.saveGroupGoal(goal);
      },

      updateGroupGoal: async (id, updates) => {
        set((state) => ({
          groupGoals: state.groupGoals.map(g => g.id === id ? { ...g, ...updates } : g)
        }));
        const updatedGoal = get().groupGoals.find(g => g.id === id);
        if (updatedGoal) {
          await supabaseService.saveGroupGoal(updatedGoal);
        }
      },

      deleteGroupGoal: async (id) => {
        set((state) => ({
          groupGoals: state.groupGoals.filter(g => g.id !== id)
        }));
        await supabaseService.deleteGroupGoal(id);
        await get().refreshData();
      },

      joinGroupGoal: (groupId, password) => {
        const state = get();
        const goal = state.groupGoals.find(g => g.groupId === groupId);
        
        if (!goal) return { success: false, message: 'Group not found' };
        if (goal.password && goal.password !== password) return { success: false, message: 'Incorrect password' };
        if (goal.members.some(m => m.userId === state.currentUser?.id)) return { success: false, message: 'Already a member' };

        const newMember = {
          userId: state.currentUser!.id,
          name: state.currentUser!.fullName,
          avatar: state.currentUser!.avatar,
          contributed: 0,
          joinedAt: new Date().toISOString(),
        };

        set((state) => ({
          groupGoals: state.groupGoals.map(g => 
            g.groupId === groupId ? { ...g, members: [...g.members, newMember] } : g
          )
        }));

        get().addNotification({
          userId: state.currentUser!.id,
          title: 'Joined Group',
          message: `You joined the group goal: ${goal.name}`,
          type: 'group'
        });

        return { success: true, message: 'Joined successfully' };
      },

      leaveGroupGoal: async (id) => {
        const state = get();
        if (!state.currentUser) return;

        set((state) => ({
          groupGoals: state.groupGoals.map(g => {
            if (g.id === id) {
              return { ...g, members: g.members.filter(m => m.userId !== state.currentUser?.id) };
            }
            return g;
          }).filter(g => g.members.length > 0)
        }));

        await supabaseService.leaveGroup(id, state.currentUser.id);
        await get().refreshData();
      },

      transferAdminRole: async (goalId, userId) => {
        await supabaseService.transferAdminRole(goalId, userId);
        set((state) => ({
          groupGoals: state.groupGoals.map(g => 
            g.id === goalId ? { ...g, creatorId: userId } : g
          )
        }));
        await get().refreshData();
      },

      removeGroupMember: (goalId, userId) => set((state) => ({
        groupGoals: state.groupGoals.map(g => 
          g.id === goalId ? { ...g, members: g.members.filter(m => m.userId !== userId) } : g
        )
      })),

      addContribution: (goalId, amount, type) => {
        const state = get();
        const now = new Date();
        const timestamp = now.toISOString();
        const userId = state.currentUser?.id;

        if (!userId) return;

        let goalName = '';
        let category = 'General';

        if (type === 'solo') {
          const goal = state.soloGoals.find(g => g.id === goalId);
          if (!goal) return;
          goalName = goal.name;
          category = goal.category;
          
          const newAmount = goal.currentAmount + amount;
          const isCompleted = newAmount >= goal.targetAmount;
          
          set((state) => ({
            soloGoals: state.soloGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                currentAmount: newAmount, 
                completed: isCompleted,
                completedAt: isCompleted ? timestamp : g.completedAt
              } : g
            )
          }));

          const updatedGoal = get().soloGoals.find(g => g.id === goalId);
          if (updatedGoal) supabaseService.saveSoloGoal(updatedGoal);

          if (isCompleted) {
            get().addNotification({
              userId,
              title: 'Goal Completed!',
              message: `Congratulations! You reached your target for ${goalName}.`,
              type: 'goal'
            });
          }
        } else if (type === 'emergency') {
          const goal = state.emergencyGoals.find(g => g.id === goalId);
          if (!goal) return;
          goalName = goal.name;
          category = 'Emergency';
          
          const newAmount = goal.currentAmount + amount;
          
          set((state) => ({
            emergencyGoals: state.emergencyGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                currentAmount: newAmount
              } : g
            )
          }));
        } else {
          const goal = state.groupGoals.find(g => g.id === goalId);
          if (!goal) return;
          goalName = goal.name;
          
          const updatedMembers = goal.members.map(m => 
            m.userId === userId ? { ...m, contributed: m.contributed + amount } : m
          );
          const newTotal = goal.totalCollected + amount;
          const isCompleted = newTotal >= goal.targetAmount;

          set((state) => ({
            groupGoals: state.groupGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                members: updatedMembers,
                totalCollected: newTotal,
                completed: isCompleted,
                completedAt: isCompleted ? timestamp : g.completedAt
              } : g
            )
          }));

          const updatedGoal = get().groupGoals.find(g => g.id === goalId);
          if (updatedGoal) supabaseService.saveGroupGoal(updatedGoal);

          if (isCompleted) {
            goal.members.forEach(m => {
              get().addNotification({
                userId: m.userId,
                title: 'Group Goal Completed!',
                message: `The group goal ${goalName} has been fully funded!`,
                type: 'goal'
              });
            });
          }
        }

        // Add Transaction
        const newTransaction: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          goalId,
          goalName,
          amount,
          type: 'deposit',
          goalType: type,
          timestamp,
          category,
          userId
        };

        set((state) => ({
          transactions: [newTransaction, ...state.transactions]
        }));
        supabaseService.saveTransaction(newTransaction);

        // Update Streak
        const { currentStreak, lastContributionDate, streakHistory } = state.streakData;
        let newStreak = currentStreak;
        let newHistory = [...streakHistory];
        let xpGained = 50; // Base XP for contribution

        if (!lastContributionDate) {
          newStreak = 1;
          newHistory.push(timestamp);
        } else {
          const lastDate = parseISO(lastContributionDate);
          const hoursDiff = differenceInHours(now, lastDate);

          if (isSameDay(now, lastDate)) {
            // Already contributed today, no streak change
            xpGained = 10; // Less XP for multiple contributions same day
          } else if (hoursDiff <= 48) {
            newStreak += 1;
            newHistory.push(timestamp);
            xpGained = 50 + (newStreak * 10); // Bonus XP for streak
          } else {
            newStreak = 1;
            newHistory = [timestamp];
          }
        }

        // Determine Tier and Multiplier
        let tier: StreakData['tier'] = 'Bronze';
        let multiplier = 1.0;

        if (newStreak >= 100) { tier = 'Godlike'; multiplier = 3.0; }
        else if (newStreak >= 60) { tier = 'Diamond'; multiplier = 2.5; }
        else if (newStreak >= 30) { tier = 'Platinum'; multiplier = 2.0; }
        else if (newStreak >= 14) { tier = 'Gold'; multiplier = 1.5; }
        else if (newStreak >= 7) { tier = 'Silver'; multiplier = 1.2; }

        xpGained = Math.round(xpGained * multiplier);

        set({
          streakData: {
            currentStreak: newStreak,
            lastContributionDate: timestamp,
            streakHistory: newHistory,
            tier,
            multiplier
          }
        });

        // Add XP to user
        if (state.currentUser) {
          get().updateUser({ xp: state.currentUser.xp + xpGained });
        }

        // Check for badges
        const thresholds = [3, 7, 14, 30, 60, 100];
        if (thresholds.includes(newStreak)) {
          const badgeNames = {
            3: 'Spark',
            7: 'Silver Flame',
            14: 'Golden Phoenix',
            30: 'Platinum Dragon',
            60: 'Diamond Titan',
            100: 'God of Savings'
          };
          
          const badge: Badge = {
            id: `streak-${newStreak}`,
            name: badgeNames[newStreak as keyof typeof badgeNames],
            icon: newStreak >= 30 ? '👑' : '🔥',
            description: `Maintained a ${newStreak} day saving streak!`,
            unlockedAt: timestamp
          };
          
          const currentBadges = state.currentUser?.badges || [];
          if (!currentBadges.some(b => b.id === badge.id)) {
            get().updateUser({ badges: [...currentBadges, badge] });
            get().addNotification({
              userId,
              title: 'New Badge Unlocked!',
              message: `You've earned the ${badge.name} badge!`,
              type: 'streak'
            });
          }
        }

        // Update Weekly Challenge
        get().updateChallengeProgress(amount);
      },

      withdrawMoney: (goalId, amount, type) => {
        const state = get();
        const now = new Date();
        const timestamp = now.toISOString();
        const userId = state.currentUser?.id;

        if (!userId) return;

        let goalName = '';
        let category = 'General';

        if (type === 'solo') {
          const goal = state.soloGoals.find(g => g.id === goalId);
          if (!goal) return;
          if (goal.currentAmount < amount) return; // Cannot withdraw more than available
          
          goalName = goal.name;
          category = goal.category;
          
          const newAmount = goal.currentAmount - amount;
          
          set((state) => ({
            soloGoals: state.soloGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                currentAmount: newAmount, 
                completed: newAmount >= g.targetAmount
              } : g
            )
          }));

          const updatedGoal = get().soloGoals.find(g => g.id === goalId);
          if (updatedGoal) supabaseService.saveSoloGoal(updatedGoal);
        } else if (type === 'emergency') {
          const goal = state.emergencyGoals.find(g => g.id === goalId);
          if (!goal) return;
          if (goal.currentAmount < amount) return;
          
          goalName = goal.name;
          category = 'Emergency';
          
          const newAmount = goal.currentAmount - amount;
          
          set((state) => ({
            emergencyGoals: state.emergencyGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                currentAmount: newAmount
              } : g
            )
          }));
        } else {
          const goal = state.groupGoals.find(g => g.id === goalId);
          if (!goal) return;
          
          const member = goal.members.find(m => m.userId === userId);
          if (!member || member.contributed < amount) return; // Cannot withdraw more than contributed
          
          goalName = goal.name;
          
          const updatedMembers = goal.members.map(m => 
            m.userId === userId ? { ...m, contributed: m.contributed - amount } : m
          );
          const newTotal = goal.totalCollected - amount;

          set((state) => ({
            groupGoals: state.groupGoals.map(g => 
              g.id === goalId ? { 
                ...g, 
                members: updatedMembers,
                totalCollected: newTotal,
                completed: newTotal >= g.targetAmount
              } : g
            )
          }));

          const updatedGoal = get().groupGoals.find(g => g.id === goalId);
          if (updatedGoal) supabaseService.saveGroupGoal(updatedGoal);
        }

        // Add Transaction (Negative amount for withdrawal)
        const newTransaction: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          goalId,
          goalName,
          amount: -amount,
          type: 'withdrawal',
          goalType: type,
          timestamp,
          category,
          userId
        };

        set((state) => ({
          transactions: [newTransaction, ...state.transactions]
        }));
        supabaseService.saveTransaction(newTransaction);

        get().addNotification({
          userId,
          title: 'Withdrawal Successful',
          message: `You withdrew ₹${amount} from ${goalName}`,
          type: 'goal'
        });
      },

      deleteTransaction: async (id) => {
        await supabaseService.deleteTransaction(id);
        await get().refreshData();
      },

      clearAllHistory: async () => {
        const state = get();
        if (!state.currentUser) return;
        await supabaseService.clearAllTransactions(state.currentUser.id);
        await get().refreshData();
      },

      checkReminders: () => {
        const state = get();
        if (!state.currentUser || !state.currentUser.preferences) return;

        const reminders = state.currentUser.preferences.reminders;
        if (!reminders?.enabled) return;

        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        const currentDay = format(now, 'EEEE');
        const currentDate = now.getDate();

        // Check if it's the right time
        if (currentTime !== reminders.time) return;

        // Check frequency constraints
        if (reminders.frequency === 'weekly' && reminders.day !== currentDay) return;
        if (reminders.frequency === 'monthly' && reminders.date !== currentDate) return;

        const lastReminderKey = `last_reminder_${state.currentUser.id}_${reminders.frequency}`;
        const lastReminder = localStorage.getItem(lastReminderKey);
        
        if (lastReminder) {
          const lastDate = parseISO(lastReminder);
          if (isSameDay(now, lastDate)) return;
        }

        const goals = [...state.soloGoals, ...state.groupGoals];
        const activeGoals = goals.filter(g => !g.completed);

        if (activeGoals.length > 0) {
          const goal = activeGoals[Math.floor(Math.random() * activeGoals.length)];
          get().addNotification({
            userId: state.currentUser.id,
            title: 'Savings Reminder ⏰',
            message: `Time for your ${reminders.frequency} contribution! Don't forget "${goal.name}".`,
            type: 'reminder'
          });
          localStorage.setItem(lastReminderKey, now.toISOString());
        }
      },

      triggerMotivation: () => {
        const state = get();
        if (!state.currentUser) return;

        const quotes = [
          "Every small saving is a step towards a big dream! 🚀",
          "Don't give up! Your future self will thank you for today's discipline. 💪",
          "Consistency is the key to financial freedom. Keep going! ✨",
          "You're doing great! Even ₹10 counts. 💰",
          "Small drops make a mighty ocean. Keep saving! 🌊",
          "Focus on the goal, not the obstacle. You got this! 🎯",
          "Your streak is looking fire! Don't let it cool down. 🔥"
        ];

        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        get().addNotification({
          userId: state.currentUser.id,
          title: 'Stay Motivated! ✨',
          message: quote,
          type: 'streak'
        });
      },

      refreshData: async () => {
        const state = get();
        if (!state.currentUser || !isConfigured) return;

        try {
          // Fetch from Supabase
          const [
            { data: profile },
            { data: soloGoals },
            { data: groupGoals },
            { data: emergencyGoals },
            { data: notifications },
            { data: transactions }
          ] = await Promise.all([
            supabaseService.getProfile(state.currentUser.id).catch(e => { console.warn('Profile fetch failed:', e); return { data: null }; }),
            supabaseService.getSoloGoals(state.currentUser.id).catch(e => { console.warn('Solo goals fetch failed:', e); return { data: null }; }),
            supabaseService.getGroupGoals().catch(e => { console.warn('Group goals fetch failed:', e); return { data: null }; }),
            supabaseService.getEmergencyGoals(state.currentUser.id).catch(e => { console.warn('Emergency goals fetch failed:', e); return { data: null }; }),
            supabaseService.getNotifications(state.currentUser.id).catch(e => { console.warn('Notifications fetch failed:', e); return { data: null }; }),
            supabaseService.getTransactions(state.currentUser.id).catch(e => { console.warn('Transactions fetch failed:', e); return { data: null }; })
          ]);

          set({
            currentUser: profile ? { ...state.currentUser, ...profile } : state.currentUser,
            soloGoals: soloGoals || state.soloGoals,
            groupGoals: groupGoals || state.groupGoals,
            emergencyGoals: emergencyGoals || state.emergencyGoals,
            notifications: notifications || state.notifications,
            transactions: transactions || state.transactions
          });

          get().checkStreak();
          get().checkReminders();
          await get().fetchZettlData();
        } catch (err) {
          console.error('Data refresh unsuccessful:', err);
        }
      },

      nudgeGroup: (goalId) => {
        const state = get();
        const goal = state.groupGoals.find(g => g.id === goalId);
        if (!goal) return;

        const inactiveMembers = goal.members.filter(m => m.contributed === 0);
        const inactiveNames = inactiveMembers.map(m => m.name).join(', ');

        goal.members.forEach(member => {
          get().addNotification({
            userId: member.userId,
            title: `Group Nudge: ${goal.name} 🚀`,
            message: inactiveMembers.length > 0 
              ? `Hey team! Let's get moving. ${inactiveNames} haven't started saving yet. We can do this!`
              : `Great job everyone! We're all contributing. Let's keep the momentum going!`,
            type: 'group'
          });
        });
      },

      clearGoalHistory: async (goalId, type) => {
        const state = get();
        if (!state.currentUser) return;

        try {
          // Delete transactions for this goal in DB
          const { error } = await supabase.from('transactions').delete().eq('goal_id', goalId);
          if (error) throw error;

          // Reset balance in Goal
          if (type === 'solo') {
            const goal = state.soloGoals.find(g => g.id === goalId);
            if (goal) {
              const updatedGoal = { ...goal, currentAmount: 0 };
              await supabaseService.saveSoloGoal(updatedGoal);
            }
          } else if (type === 'group') {
            const goal = state.groupGoals.find(g => g.id === goalId);
            if (goal) {
              const updatedMembers = goal.members.map(m => ({ ...m, contributed: 0 }));
              const updatedGoal = { ...goal, totalCollected: 0, members: updatedMembers };
              await supabaseService.saveGroupGoal(updatedGoal);
            }
          } else if (type === 'emergency') {
            const goal = state.emergencyGoals.find(g => g.id === goalId);
            if (goal) {
              const updatedGoal = { ...goal, currentAmount: 0 };
              await supabaseService.saveEmergencyGoal(updatedGoal);
            }
          }

          // Refresh store data
          await get().refreshData();
        } catch (err) {
          console.error('Failed to clear history:', err);
          throw err;
        }
      },

      addNotification: async (n) => {
        const newNotification = {
          ...n,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          read: false
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications]
        }));
        await supabaseService.saveNotification(newNotification);
      },

      markNotificationRead: async (id) => {
        set((state) => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
        }));
        await supabaseService.markNotificationRead(id);
      },

      markAllNotificationsRead: async () => {
        const state = get();
        if (!state.currentUser) return;
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true }))
        }));
        await supabaseService.markNotificationsRead(state.currentUser.id);
      },

      clearNotifications: async () => {
        const state = get();
        if (!state.currentUser) return;
        set({ notifications: [] });
        // Optionally clear in Supabase too
      },

      checkStreak: () => {
        const state = get();
        if (!state.currentUser) return;
        
        const now = new Date();
        const lastLogin = state.currentUser.lastLoginDate ? parseISO(state.currentUser.lastLoginDate) : null;
        
        if (!lastLogin) {
          get().updateUser({ lastLoginDate: now.toISOString(), streak: 1 });
          get().addXP(25); // Daily login XP
          get().updateQuestProgress('d1', 1);
          return;
        }

        if (isSameDay(now, lastLogin)) return;

        const hoursDiff = differenceInHours(now, lastLogin);
        
        if (hoursDiff <= 48) {
          const newStreak = (state.currentUser.streak || 0) + 1;
          get().updateUser({ lastLoginDate: now.toISOString(), streak: newStreak });
          get().addXP(25);
          get().updateQuestProgress('d1', 1);
          get().updateQuestProgress('w1', 1);

          // Streak Bonuses
          if (newStreak === 3) {
            get().addXP(50);
            get().addNotification({ userId: state.currentUser.id, title: 'Streak Bonus!', message: '+50 XP, badge "Rising Star"', type: 'achievement' });
          } else if (newStreak === 7) {
            get().addXP(150);
            get().addNotification({ userId: state.currentUser.id, title: 'Streak Bonus!', message: '+150 XP, badge "On Fire 🔥"', type: 'achievement' });
          } else if (newStreak === 14) {
            get().addXP(300);
            get().addNotification({ userId: state.currentUser.id, title: 'Streak Bonus!', message: '+300 XP, badge "Unstoppable"', type: 'achievement' });
          } else if (newStreak === 30) {
            get().addXP(1000);
            get().addNotification({ userId: state.currentUser.id, title: 'Streak Bonus!', message: '+1000 XP, badge "LEGEND 👑"', type: 'achievement' });
          }
        } else {
          // Check for streak freeze
          if (state.currentUser.streakFreezeCount > 0) {
            get().updateUser({ 
              lastLoginDate: now.toISOString(), 
              streakFreezeCount: state.currentUser.streakFreezeCount - 1 
            });
            get().addNotification({ 
              userId: state.currentUser.id, 
              title: 'Streak Saved!', 
              message: 'A streak freeze was used to save your progress! ❄️', 
              type: 'streak' 
            });
          } else {
            get().updateUser({ lastLoginDate: now.toISOString(), streak: 1 });
            get().addNotification({ 
              userId: state.currentUser.id, 
              title: 'Streak Lost!', 
              message: 'Streak Lost! Start again tomorrow 💪', 
              type: 'streak' 
            });
          }
          get().addXP(25);
          get().updateQuestProgress('d1', 1);
        }
      },

      addXP: (amount) => {
        const state = get();
        if (state.currentUser) {
          get().updateUser({ xp: state.currentUser.xp + amount });
        }
      },

      updateQuestProgress: (questId, amount) => {
        set((state) => {
          const updateQuests = (quests: Quest[]) => quests.map(q => {
            if (q.id === questId && !q.completed) {
              const newProgress = q.progress + amount;
              const completed = newProgress >= q.target;
              if (completed) {
                get().addXP(q.rewardXP);
                get().addNotification({
                  userId: state.currentUser!.id,
                  title: 'Quest Completed!',
                  message: `You earned ${q.rewardXP} XP for completing: ${q.title}`,
                  type: 'achievement'
                });
              }
              return { ...q, progress: Math.min(newProgress, q.target), completed };
            }
            return q;
          });

          return {
            dailyQuests: updateQuests(state.dailyQuests),
            weeklyQuests: updateQuests(state.weeklyQuests)
          };
        });
      },

      buyStreakFreeze: () => {
        const state = get();
        if (!state.currentUser) return { success: false, message: 'Not logged in' };
        if (state.currentUser.xp < 500) return { success: false, message: 'Not enough XP (Need 500)' };

        get().updateUser({ 
          xp: state.currentUser.xp - 500, 
          streakFreezeCount: (state.currentUser.streakFreezeCount || 0) + 1 
        });
        return { success: true, message: 'Streak Freeze purchased! ❄️' };
      },

      startFocusSession: (type, duration) => {
        const state = get();
        if (!state.currentUser) return;

        const newSession: FocusSession = {
          id: Math.random().toString(36).substr(2, 9),
          userId: state.currentUser.id,
          startTime: new Date().toISOString(),
          duration,
          type,
          completed: false
        };

        set((state) => ({
          focusSessions: [...state.focusSessions, newSession]
        }));
      },

      completeFocusSession: (id) => {
        const state = get();
        set((state) => ({
          focusSessions: state.focusSessions.map(s => {
            if (s.id === id && !s.completed) {
              if (s.type === 'study') {
                get().addXP(10);
                get().addNotification({
                  userId: state.currentUser!.id,
                  title: 'Focus Session Complete!',
                  message: 'You earned +10 XP for your study session! 🎯',
                  type: 'achievement'
                });
              }
              return { ...s, completed: true };
            }
            return s;
          })
        }));
      },

      resetWeeklyChallenge: () => {
        const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        set({
          weeklyChallenge: {
            ...randomChallenge,
            progress: 0,
            lastResetDate: new Date().toISOString()
          }
        });
      },

      updateChallengeProgress: (amount) => set((state) => {
        if (!state.weeklyChallenge) return state;
        
        let newProgress = state.weeklyChallenge.progress;
        if (state.weeklyChallenge.id === '2') {
          newProgress += amount;
        } else if (state.weeklyChallenge.id === '3' || state.weeklyChallenge.id === '4') {
          newProgress += 1;
        } else if (state.weeklyChallenge.id === '1') {
          newProgress = state.streakData.currentStreak;
        }

        const isCompleted = newProgress >= state.weeklyChallenge.target && state.weeklyChallenge.progress < state.weeklyChallenge.target;
        
        if (isCompleted) {
          get().addNotification({
            userId: state.currentUser!.id,
            title: 'Challenge Completed!',
            message: `You've completed the weekly challenge: ${state.weeklyChallenge.title}`,
            type: 'streak'
          });
        }

        return {
          weeklyChallenge: {
            ...state.weeklyChallenge,
            progress: Math.min(newProgress, state.weeklyChallenge.target)
          }
        };
      }),
    }),
    {
      name: 'zavr-storage',
    }
  )
);

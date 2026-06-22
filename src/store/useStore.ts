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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000, errorMsg: string = 'Network request timed out'): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let activeCheckAuthPromise: Promise<void> | null = null;
let activeRefreshDataPromise: Promise<void> | null = null;

export function mapDbProfileToUser(prof: any, emailFallback?: string): User {
  return {
    id: prof.id,
    fullName: prof.full_name || prof.fullName || '',
    username: prof.username || '',
    email: prof.email || emailFallback || '',
    phone: prof.phone || prof.phone_number || prof.phone || '',
    dob: prof.birth_date || prof.date_of_birth || prof.dob || '',
    gender: prof.gender || '',
    location: prof.location || '',
    avatar: prof.avatar_url || prof.avatar || '',
    avatarId: prof.avatar_id || prof.avatarId || '',
    onboardingCompleted: !!(prof.onboarding_completed || prof.onboardingCompleted),
    personalDetailsFilled: !!(prof.onboarding_completed || prof.onboardingCompleted),
    savingCategories: prof.saving_categories || prof.savingCategories || [],
    interests: prof.interests || [],
    xp: prof.xp !== undefined ? prof.xp : 0,
    level: prof.level !== undefined ? prof.level : 1,
    badges: prof.badges || [],
    streak: prof.streak !== undefined ? prof.streak : 0,
    createdAt: prof.created_at || prof.createdAt,
    lastLoginDate: prof.last_login_date || prof.lastLoginDate,
    streakFreezeCount: prof.streak_freeze_count !== undefined ? prof.streak_freeze_count : (prof.streakFreezeCount !== undefined ? prof.streakFreezeCount : 0),
    preferences: prof.preferences || {
      currency: 'INR',
      notificationsEnabled: true,
      reminders: { enabled: true, time: '20:00', frequency: 'daily' }
    }
  };
}

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
  sendFriendRequestByUsername: (username: string) => Promise<void>;
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
  checkAuth: (isInitial?: boolean, prefetchedProfile?: any) => Promise<void>;
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
              friendUsername: f.friend?.username || 'user',
              friendFullName: f.friend?.full_name || 'Zettl Friend',
              friendAvatar: f.friend?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${f.friend_id || 'default'}`,
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
          const res = await fetchWithRetry(`/api/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
          if (!res.ok) {
            const errData = await res.json();
            console.error('[STORE] Search API error:', errData);
            return [];
          }
          return await res.json();
        } catch (err) {
          console.error('[STORE] Search failed:', err);
          return [];
        }
      },

      sendFriendRequest: async (friendId) => {
        const res = await fetchWithRetry('/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendId }),
          credentials: 'include'
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to send request');
        }
        await get().fetchZettlData();
      },

      sendFriendRequestByUsername: async (username) => {
        const res = await fetchWithRetry('/api/friends/request-by-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
          credentials: 'include'
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to send request');
        }
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
      checkAuth: async (isInitial = false, prefetchedProfile: any = null) => {
        if (activeCheckAuthPromise) {
          console.log('[AUTH] Reuse active checkAuth promise to collapse concurrent check.');
          return activeCheckAuthPromise;
        }

        activeCheckAuthPromise = (async () => {
          // Prevent clearing loading state too early if check is in progress
          set({ isAuthLoading: true });
          console.log('[AUTH] Checking authentication status...', { isInitial });
          
          try {
            let sbSession: Session | null = null;

            // 1. First lookup session locally (instantaneous and highly reliable)
            try {
              const sessionResult = await supabase.auth.getSession();
              if (sessionResult.error) {
                console.warn('[AUTH] getSession error status:', sessionResult.error.message);
                if (sessionResult.error.message?.includes('Refresh Token Not Found') || sessionResult.error.message?.includes('Invalid Refresh Token')) {
                  localStorage.removeItem('zavr-auth-token');
                }
              }
              sbSession = sessionResult.data?.session || null;
              
              // Sync with server cookies in the background, non-blocking
              if (sbSession) {
                fetchWithRetry('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ session: sbSession }),
                  credentials: 'include'
                }).catch(syncErr => {
                  console.warn('[AUTH] Background session cookie sync warning:', syncErr);
                });
              }
            } catch (localErr: any) {
              console.warn('[AUTH] Local session check warning:', localErr);
              if (localErr?.message?.includes('Refresh Token Not Found') || localErr?.message?.includes('Invalid Refresh Token')) {
                localStorage.removeItem('zavr-auth-token');
              }
            }

            // 2. If no local session and isInitial load, fallback to server cookie-sync first
            if (!sbSession && isInitial) {
              try {
                const syncRes = await fetchWithRetry('/api/auth/session', { credentials: 'include' });
                if (syncRes.ok) {
                  const syncData = await syncRes.json();
                  if (syncData.session) {
                    sbSession = syncData.session;
                    // Hydrate local SDK to keep them in sync
                    try {
                      const { data: { session: localSession } } = await supabase.auth.getSession();
                      if (!localSession || localSession.access_token !== sbSession.access_token) {
                        const { error: setSessionErr } = await supabase.auth.setSession(sbSession);
                        if (setSessionErr) {
                          console.warn('[AUTH] setSession hydrated error:', setSessionErr.message);
                          if (setSessionErr.message?.includes('Refresh Token Not Found') || setSessionErr.message?.includes('Invalid Refresh Token')) {
                            localStorage.removeItem('zavr-auth-token');
                            sbSession = null;
                          }
                        }
                      }
                    } catch (hydrateErr: any) {
                      console.warn('[AUTH] Session hydration failed safely:', hydrateErr);
                      if (hydrateErr?.message?.includes('Refresh Token Not Found') || hydrateErr?.message?.includes('Invalid Refresh Token')) {
                        localStorage.removeItem('zavr-auth-token');
                        sbSession = null;
                      }
                    }
                  }
                }
              } catch (syncErr) {
                console.warn('[AUTH] Cookie sync fallback check failed:', syncErr);
              }
            }
            
            if (sbSession) {
              console.log('[AUTH] Session found for user:', sbSession.user.id);
              set({ session: sbSession });

              const mapProfileToUser = (prof: any): User => mapDbProfileToUser(prof, sbSession.user.email);

              // Construct an optimistic fallback as the default so the UI works as fallback
              const metadata = sbSession.user.user_metadata || {};
              const optimisticUser: User = {
                id: sbSession.user.id,
                fullName: metadata.full_name || '',
                username: metadata.username || sbSession.user.email?.split('@')[0] || 'user',
                email: sbSession.user.email || '',
                phone: metadata.phone || '',
                dob: metadata.dob || '',
                gender: metadata.gender || '',
                location: metadata.location || '',
                avatar: metadata.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${sbSession.user.id}`,
                avatarId: metadata.avatar_id || '1',
                onboardingCompleted: false,
                personalDetailsFilled: false,
                savingCategories: [],
                interests: [],
                xp: metadata.xp || 0,
                level: metadata.level || 1,
                badges: [],
                streak: 0,
                createdAt: sbSession.user.created_at,
                lastLoginDate: new Date().toISOString(),
                streakFreezeCount: 0,
                preferences: { currency: 'INR', notificationsEnabled: true, reminders: { enabled: true, time: '20:00', frequency: 'daily' } }
              };

              // Satisfy budget of <200ms after auth session is available
              // Instantly load the optimistic layout options in <15ms
              set({ currentUser: optimisticUser, isAuthLoading: false });

              if (prefetchedProfile) {
                try {
                  const mappedUser = mapProfileToUser(prefetchedProfile);
                  console.log('[AUTH] Instant pre-fetched profile load, bypassing DB query:', mappedUser.id, 'completeness:', mappedUser.onboardingCompleted);
                  supabaseService.setProfileCache(sbSession.user.id, mappedUser);
                  set({ currentUser: mappedUser, isAuthLoading: false });
                  get().refreshData().catch(e => console.warn('[AUTH] refreshData after prefetchedProfile failed:', e));
                  activeCheckAuthPromise = null;
                  return;
                } catch (pe) {
                  console.warn('[AUTH] Failed to map prefetchedProfile:', pe);
                }
              }

              let profileFetched = false;

              // Synchronously fetch the user profile ONLY from profiles table (Single Source of Truth)
              try {
                console.log('[AUTH] Fetching user profile from profiles table...', sbSession.user.id);
                // First check supabaseService cache before executing query to eliminate duplicate fetches
                const cached = await supabaseService.getProfile(sbSession.user.id);
                if (cached?.data) {
                  const mappedUser = cached.data;
                  set({ currentUser: mappedUser, isAuthLoading: false });
                  console.log('[AUTH] Loaded from memory/service profile cache, layout ready!');
                  profileFetched = true;
                  get().refreshData().catch(e => console.warn('[AUTH] refreshData after cached profile load failed:', e));
                } else {
                  const profilePromise = Promise.resolve(supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', sbSession.user.id)
                    .maybeSingle()
                  );

                  const { data: profile, error: profileError } = await withTimeout<any>(profilePromise, 8000, 'Profiles table fetch timed out');

                  if (profileError) {
                    console.error('[AUTH] Profiles table fetch error:', profileError.message);
                  }

                  if (profile) {
                    const mappedUser = mapProfileToUser(profile);
                    supabaseService.setProfileCache(sbSession.user.id, mappedUser);
                    set({ currentUser: mappedUser, isAuthLoading: false });
                    console.log('[AUTH] Sync profile loaded from Supabase profiles, layout ready:', mappedUser.id, 'completeness:', mappedUser.onboardingCompleted);
                    profileFetched = true;
                    get().refreshData().catch(e => console.warn('[AUTH] refreshData after checkAuth failed:', e));
                  } else {
                    // Profile is missing from profiles - auto-create it now
                    console.log('[AUTH] profiles row missing, auto-creating a new row...', sbSession.user.id);
                    try {
                      const fallbackUsername = (sbSession.user.email?.split('@')[0] || `user_${sbSession.user.id.substring(0, 8)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
                      const newProfileRow = {
                        id: sbSession.user.id,
                        email: sbSession.user.email || '',
                        username: fallbackUsername,
                        full_name: sbSession.user.user_metadata?.full_name || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      };

                      const insertPromise = Promise.resolve(supabase
                        .from('profiles')
                        .insert(newProfileRow)
                      );

                      const { error: insError } = await withTimeout<any>(insertPromise, 8000, 'Profiles auto-insert timed out');

                      if (insError) {
                        console.warn('[AUTH] Auto-insertion in profiles failed:', insError.message);
                      }
                    } catch (insEx: any) {
                      console.warn('[AUTH] Exception auto-inserting profiles:', insEx.message || insEx);
                    }

                    const defaultUserObject = {
                      id: sbSession.user.id,
                      username: (sbSession.user.email?.split('@')[0] || `user_${sbSession.user.id.substring(0, 8)}`).toLowerCase().replace(/[^a-z0-9_]/g, ''),
                      full_name: sbSession.user.user_metadata?.full_name || '',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };

                    const mappedUser = mapProfileToUser(defaultUserObject);
                    supabaseService.setProfileCache(sbSession.user.id, mappedUser);
                    set({ currentUser: mappedUser, isAuthLoading: false });
                    profileFetched = true;
                    get().refreshData().catch(e => console.warn('[AUTH] refreshData after fallback setup failed:', e));
                  }
                }
              } catch (err: any) {
                console.error('[AUTH] Profile check query failed:', err);
              }

              // Absolute fallback to optimistic user representation
              if (!profileFetched) {
                console.log('[AUTH] Falling back to optimistic metadata layout.');
                set({ currentUser: optimisticUser, isAuthLoading: false });
              }

              return;
            } else {
              console.log('[AUTH] No session found.');
              set({ currentUser: null, session: null });
            }
          } catch (error: any) {
            console.error('[AUTH] Critical auth check failure:', error);
            set({ currentUser: null, session: null });
          } finally {
            console.log('[AUTH] Auth verification complete.');
            set({ isAuthLoading: false });
          }
        })();

        try {
          await activeCheckAuthPromise;
        } finally {
          activeCheckAuthPromise = null;
        }
      },

      signOut: async () => {
        console.log('Starting signOut process...');
        
        // 1. Fire off the server and Supabase signout tasks in parallel without blocking each other.
        // We use standard fetch instead of fetchWithRetry to prevent slow retry loops during logout.
        const serverSignout = fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })
          .then(res => res.json().catch(() => ({})))
          .catch(e => console.warn('[STORE-SIGNOUT] Server cookie signout failed:', e));

        const sdkSignout = supabase.auth.signOut()
          .catch(e => console.warn('[STORE-SIGNOUT] Supabase SDK signout failed:', e));

        // 2. Wrap them with a fast 500ms timeout. If either is slow, we proceed anyway.
        const signoutTimeout = new Promise(resolve => setTimeout(resolve, 500));

        try {
          await Promise.race([
            Promise.all([serverSignout, sdkSignout]),
            signoutTimeout
          ]);
        } catch (e) {
          console.warn('[STORE-SIGNOUT] Racing during signout:', e);
        }
        
        // 3. Clear all application states in Local / Session Storage
        localStorage.clear();
        sessionStorage.clear();
        
        // 4. Completely reset ALL user data on the frontend to prevent residual rendering
        set({
          currentUser: null,
          session: null,
          soloGoals: [],
          groupGoals: [],
          emergencyGoals: [],
          transactions: [],
          notifications: [],
          users: [],
          weeklyChallenge: null,
          isAuthLoading: false,
          streakData: {
            currentStreak: 0,
            lastContributionDate: null,
            streakHistory: [],
            tier: 'Bronze',
            multiplier: 1.0,
          }
        });
        
        // 5. Clear any dynamic in-memory cached responses (failsafe in case clear() missed items or values was populated asynchronously)
        const keysToRemove = Object.keys(localStorage);
        for (const k of keysToRemove) {
          if (k.startsWith('zavr-')) {
            localStorage.removeItem(k);
          }
        }

        // 6. Force relocate to authenticate layout immediately
        window.location.href = '/auth';
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
              // Only re-trigger full check if session changed or was missing (avoid infinite trigger loop)
              const currentSession = get().session;
              if (!currentSession || currentSession.access_token !== session.access_token) {
                set({ session, isAuthLoading: true });
                await get().checkAuth();
              }
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] User signed out, clearing state.');
            localStorage.clear();
            sessionStorage.clear();
            set({
              currentUser: null,
              session: null,
              soloGoals: [],
              groupGoals: [],
              emergencyGoals: [],
              transactions: [],
              notifications: [],
              users: [],
              weeklyChallenge: null,
              isAuthLoading: false,
              streakData: {
                currentStreak: 0,
                lastContributionDate: null,
                streakHistory: [],
                tier: 'Bronze',
                multiplier: 1.0,
              }
            });
            window.location.href = '/auth';
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
              username: u.user_metadata?.username || u.user_metadata?.user_name || '',
              avatar: u.user_metadata?.avatar_url || '',
              avatarId: '',
              onboardingCompleted: !!u.user_metadata?.onboarding_completed,
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



        console.log('[STORE] Calling remote updateProfile in background...');
        supabaseService.updateProfile(finalUser.id, {
          ...updates,
          updated_at: new Date()
        } as any).then(({ error }) => {
          if (error) {
            console.error('[STORE] Remote sync failed, but local state preserved:', error);
          } else {
            console.log('[STORE] Remote profile write completed successfully.');
          }
        }).catch(err => {
          console.error('[STORE] Unexpected failure in background remote profile write:', err);
        });
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
        get().refreshData();
      },

      joinGroupGoal: (groupId, password) => {
        const state = get();
        if (!state.currentUser) return { success: false, message: 'Not logged in' };
        
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
        get().refreshData();
      },

      transferAdminRole: async (goalId, userId) => {
        await supabaseService.transferAdminRole(goalId, userId);
        set((state) => ({
          groupGoals: state.groupGoals.map(g => 
            g.id === goalId ? { ...g, creatorId: userId } : g
          )
        }));
        get().refreshData();
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
          id: generateUUID(),
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
          id: generateUUID(),
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
        set((state) => ({
          transactions: state.transactions.filter(t => t.id !== id)
        }));
        await supabaseService.deleteTransaction(id);
        get().refreshData();
      },

      clearAllHistory: async () => {
        const state = get();
        if (!state.currentUser) return;
        set({ transactions: [] });
        await supabaseService.clearAllTransactions(state.currentUser.id);
        get().refreshData();
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
        if (activeRefreshDataPromise) {
          console.log('[STORE] Reusing active refreshData promise to collapse concurrent queries.');
          return activeRefreshDataPromise;
        }

        const state = get();
        if (!state.currentUser || !isConfigured) return;

        console.time("dashboard-load");
        const startTime = performance.now();

        activeRefreshDataPromise = (async () => {
          try {
            console.time("profile-load");
            console.time("goals-load");
            console.time("notifications-load");

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

            console.timeEnd("profile-load");
            console.timeEnd("goals-load");
            console.timeEnd("notifications-load");

            set({
              currentUser: profile ? mapDbProfileToUser(profile, state.currentUser.email) : state.currentUser,
              soloGoals: soloGoals || state.soloGoals,
              groupGoals: groupGoals || state.groupGoals,
              emergencyGoals: emergencyGoals || state.emergencyGoals,
              notifications: notifications || state.notifications,
              transactions: transactions || state.transactions
            });

            get().checkStreak();
            get().checkReminders();
            get().fetchZettlData().catch(e => console.warn('[STORE] Lazy-load Zettl data failed:', e));
          } catch (err) {
            console.error('Data refresh unsuccessful:', err);
          } finally {
            console.timeEnd("dashboard-load");
            const endTime = performance.now();
            console.log(`[Dashboard Load Profile] all data refreshed in ${(endTime - startTime).toFixed(2)}ms`);
          }
        })();

        try {
          await activeRefreshDataPromise;
        } finally {
          activeRefreshDataPromise = null;
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
          id: generateUUID(),
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
                if (state.currentUser) {
                  get().addNotification({
                    userId: state.currentUser.id,
                    title: 'Quest Completed!',
                    message: `You earned ${q.rewardXP} XP for completing: ${q.title}`,
                    type: 'achievement'
                  });
                }
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
          id: generateUUID(),
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
                if (state.currentUser) {
                  get().addNotification({
                    userId: state.currentUser.id,
                    title: 'Focus Session Complete!',
                    message: 'You earned +10 XP for your study session! 🎯',
                    type: 'achievement'
                  });
                }
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
        
        if (isCompleted && state.currentUser) {
          get().addNotification({
            userId: state.currentUser.id,
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
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

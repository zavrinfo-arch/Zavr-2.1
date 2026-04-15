/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  User, SoloGoal, GroupGoal, Transaction, Notification, 
  WeeklyChallenge, StreakData, Currency, Badge, EmergencyGoal,
  Quest, FocusSession
} from '../types';
import { isSameDay, differenceInHours, parseISO, startOfWeek, isAfter, format } from 'date-fns';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

interface AppState {
  users: User[];
  currentUser: User | null;
  soloGoals: SoloGoal[];
  groupGoals: GroupGoal[];
  emergencyGoals: EmergencyGoal[];
  transactions: Transaction[];
  notifications: Notification[];
  streakData: StreakData;
  weeklyChallenge: WeeklyChallenge | null;
  isChatOpen: boolean;
  theme: 'light' | 'dark';
  chatMessages: { id: string; text: string; sender: 'user' | 'ai'; timestamp: string }[];
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  focusSessions: FocusSession[];
  isAuthLoading: boolean;
  
  // Auth Actions
  setCurrentUser: (user: User | null) => void;
  addUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  
  // Goal Actions
  addSoloGoal: (goal: SoloGoal) => void;
  updateSoloGoal: (id: string, updates: Partial<SoloGoal>) => void;
  deleteSoloGoal: (id: string) => void;
  addEmergencyGoal: (goal: EmergencyGoal) => void;
  updateEmergencyGoal: (id: string, updates: Partial<EmergencyGoal>) => void;
  deleteEmergencyGoal: (id: string) => void;
  addGroupGoal: (goal: GroupGoal) => void;
  updateGroupGoal: (id: string, updates: Partial<GroupGoal>) => void;
  joinGroupGoal: (groupId: string, password?: string) => { success: boolean; message: string };
  leaveGroupGoal: (id: string) => void;
  removeGroupMember: (goalId: string, userId: string) => void;
  
  // Transaction & Contribution
  addContribution: (goalId: string, amount: number, type: 'solo' | 'group' | 'emergency') => void;
  withdrawMoney: (goalId: string, amount: number, type: 'solo' | 'group' | 'emergency') => void;
  
  // Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  
  // Streak & Badges
  checkStreak: () => void;
  setIsChatOpen: (isOpen: boolean) => void;
  sendChatMessage: (text: string) => void;
  
  // Weekly Challenge
  resetWeeklyChallenge: () => void;
  updateChallengeProgress: (amount: number) => void;

  // Reminders & Motivation
  checkReminders: () => void;
  triggerMotivation: () => void;
  refreshData: () => Promise<void>;
  nudgeGroup: (goalId: string) => void;
  
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
      isChatOpen: false,
      theme: 'dark',
      chatMessages: [
        {
          id: '1',
          text: "Hi! I'm Zavr, your financial assistant. How can I help you with your budget or salary splitting today?",
          sender: 'ai',
          timestamp: new Date().toISOString(),
        }
      ],
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

      setCurrentUser: (user) => {
        set({ currentUser: user });
        if (user) {
          get().refreshData();
          get().checkStreak();
        }
      },
      
      checkAuth: async () => {
        set({ isAuthLoading: true });
        console.log('Checking authentication status...');
        try {
          const response = await fetch('/api/auth/me', { credentials: 'include' });
          if (response.ok) {
            const { profile, session, user } = await response.json();
            console.log('Auth check successful. User ID:', user?.id);
            if (session) {
              await supabase.auth.setSession(session);
              console.log('Supabase session synchronized.');
            }
            if (profile) {
              set({ currentUser: profile });
            }
          } else {
            console.log('Auth check failed: Not authenticated.');
            set({ currentUser: null });
          }
        } catch (error) {
          console.error('Auth check error:', error);
          set({ currentUser: null });
        } finally {
          set({ isAuthLoading: false });
        }
      },

      signOut: async () => {
        console.log('Starting signOut process...');
        try {
          // 1. Call backend to clear cookies
          await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
          
          // 2. Clear client-side Supabase session
          await supabase.auth.signOut();
          
          // 3. Clear store state
          set({ currentUser: null });
          
          // 4. Clear local storage for this store to be extra safe
          // localStorage.removeItem('zavr-storage'); // Optional, but might be too aggressive
          
          console.log('Sign out successful');
        } catch (error) {
          console.error('Sign out failed:', error);
          // Still clear local state even if server call fails
          set({ currentUser: null });
        }
      },
      
      addUser: async (user) => {
        set((state) => ({ users: [...state.users, user] }));
        await supabaseService.updateProfile(user.id, user);
      },
      
      updateUser: async (updates) => {
        const state = get();
        if (!state.currentUser) return;
        
        const updatedUser = { ...state.currentUser, ...updates };
        
        // Level up logic - every 500 XP
        let newLevel = updatedUser.level;
        const xpForNextLevel = newLevel * 500;
        if (updatedUser.xp >= xpForNextLevel) {
          newLevel += 1;
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
        set({
          currentUser: finalUser,
          users: state.users.map(u => u.id === finalUser.id ? finalUser : u)
        });

        await supabaseService.updateProfile(finalUser.id, finalUser);
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
        // await supabaseService.saveEmergencyGoal(goal); // Add this to service later if needed
      },

      updateEmergencyGoal: async (id, updates) => {
        set((state) => ({
          emergencyGoals: state.emergencyGoals.map(g => g.id === id ? { ...g, ...updates } : g)
        }));
      },

      deleteEmergencyGoal: async (id) => {
        set((state) => ({
          emergencyGoals: state.emergencyGoals.filter(g => g.id !== id)
        }));
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

      leaveGroupGoal: (id) => set((state) => ({
        groupGoals: state.groupGoals.map(g => {
          if (g.id === id) {
            return { ...g, members: g.members.filter(m => m.userId !== state.currentUser?.id) };
          }
          return g;
        }).filter(g => g.members.length > 0)
      })),

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
          category
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
          category
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
        if (!state.currentUser) return;

        // Fetch from Supabase
        const [
          { data: profile },
          { data: soloGoals },
          { data: groupGoals },
          { data: notifications },
          { data: transactions }
        ] = await Promise.all([
          supabaseService.getProfile(state.currentUser.id),
          supabaseService.getSoloGoals(state.currentUser.id),
          supabaseService.getGroupGoals(),
          supabaseService.getNotifications(state.currentUser.id),
          supabaseService.getTransactions(state.currentUser.id)
        ]);

        set({
          currentUser: profile ? { ...state.currentUser, ...profile } : state.currentUser,
          soloGoals: soloGoals || state.soloGoals,
          groupGoals: groupGoals || state.groupGoals,
          notifications: notifications || state.notifications,
          transactions: transactions || state.transactions
        });

        get().checkStreak();
        get().checkReminders();
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

      setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

      sendChatMessage: (text) => {
        const newMessage = {
          id: Date.now().toString(),
          text,
          sender: 'user' as const,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, newMessage],
          isChatOpen: true,
        }));

        // Mock AI Response
        setTimeout(() => {
          const aiResponse = {
            id: (Date.now() + 1).toString(),
            text: "I've received your request! As your financial assistant, I recommend focusing on consistent savings and minimizing high-interest debt. Is there anything specific about your finances you'd like to dive into?",
            sender: 'ai' as const,
            timestamp: new Date().toISOString(),
          };
          set((state) => ({
            chatMessages: [...state.chatMessages, aiResponse],
          }));
        }, 1500);
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

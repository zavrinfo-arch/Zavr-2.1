/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Currency = 'INR' | 'USD' | 'EUR';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:mm
  frequency: SavingFrequency;
  day?: string; // For weekly
  date?: number; // For monthly
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  passwordHash?: string;
  phone: string;
  dob: string;
  avatar: string;
  avatarId: number;
  streak: number;
  onboardingCompleted: boolean;
  interests: string[];
  weeklyTarget: number;
  badges: Badge[];
  createdAt: string;
  lastLoginDate: string | null;
  streakFreezeCount: number;
  xp: number;
  level: number;
  preferences: {
    currency: Currency;
    notificationsEnabled: boolean;
    reminders: ReminderSettings;
  };
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
}

export interface Transaction {
  id: string;
  goalId: string;
  goalName: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  goalType: 'solo' | 'group' | 'emergency';
  timestamp: string;
  category: string;
}

export type SavingFrequency = 'daily' | 'weekly' | 'monthly';

export interface SoloGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
  frequency: SavingFrequency;
  createdAt: string;
  completed: boolean;
  completedAt?: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  avatar: string;
  contributed: number;
  joinedAt: string;
}

export interface GroupGoal {
  id: string;
  groupId: string; // ZAVR-XXXXXX
  name: string;
  targetAmount: number;
  memberCount: number; // Planned number of members
  password?: string;
  creatorId: string;
  members: GroupMember[];
  totalCollected: number;
  createdAt: string;
  deadline: string;
  frequency: SavingFrequency;
  completed: boolean;
  completedAt?: string;
}

export interface EmergencyGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  frequency: SavingFrequency;
  routineAmount: number;
  createdAt: string;
  completed: boolean;
  completedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'streak' | 'goal' | 'group' | 'reminder' | 'achievement' | 'motivational';
  read: boolean;
  timestamp: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXP: number;
  type: 'daily' | 'weekly';
  completed: boolean;
}

export interface FocusSession {
  id: string;
  userId: string;
  startTime: string;
  duration: number; // in minutes
  type: 'study' | 'break';
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXP: number;
  completed: boolean;
  type: 'daily' | 'weekly';
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXP: number;
  lastResetDate: string;
}

export interface StreakData {
  currentStreak: number;
  lastContributionDate: string | null;
  streakHistory: string[]; // Array of ISO dates
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Godlike';
  multiplier: number;
}

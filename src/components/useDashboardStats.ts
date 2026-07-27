import { useEffect, useMemo, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { subMonths, format, startOfMonth, endOfMonth, parseISO, isWithinInterval, isAfter } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { getAvatarUrl } from '../constants/avatars';
import toast from 'react-hot-toast';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';

export interface FriendDebtDetail {
  friendId: string;
  username: string;
  fullName: string;
  avatar: string;
  amount: number;
}

export interface RecentDebtActivity {
  id: string;
  description: string;
  amount: number;
  note?: string;
  isLent: boolean;
  isSettled: boolean;
  createdAt: string;
  friendName: string;
  friendAvatar: string;
}

export interface MonthlyTrendData {
  month: string;
  Lent: number;
  Borrowed: number;
}

export interface StatusDistribution {
  pendingCount: number;
  pendingPercent: number;
  overdueCount: number;
  overduePercent: number;
  paidCount: number;
  paidPercent: number;
  total: number;
}

export interface DebtSummaryStats {
  totalLent: number;
  totalBorrowed: number;
  netBalance: number;
  totalActiveDebts: number;
  whoOwesMe: FriendDebtDetail[];
  iOweThem: FriendDebtDetail[];
  recentActivity: RecentDebtActivity[];
  monthlyTrend: MonthlyTrendData[];
  statusDistribution: StatusDistribution;
  loading: boolean;
  settleAll: () => Promise<void>;
  settleFriendDebts: (friendId: string) => Promise<void>;
}

export function useDashboardStats(): DebtSummaryStats {
  const { 
    currentUser, 
    personalZettls, 
    zettlFriends, 
    fetchZettlData, 
    settleZettl 
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);

  const fetchZettlDataRef = useRef(fetchZettlData);
  useEffect(() => {
    fetchZettlDataRef.current = fetchZettlData;
  }, [fetchZettlData]);

  // Fetch initial data & set up real-time subscription
  useEffect(() => {
    let active = true;
    
    async function loadData() {
      try {
        if (active) {
          setIsLoading(true);
          await fetchZettlDataRef.current();
        }
      } catch (e) {
        console.error('[STATS] Error fetching initial Zettl data:', e);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    if (shouldDisableHeavyFeatures()) {
      console.info('[PREVIEW] Bypassing dashboard stats real-time subscribe channel in preview mode.');
      return () => {
        active = false;
      };
    }

    // Subscribe to debts/personal_zettls table changes for real-time updates
    const channel = supabase
      .channel('personal_zettls_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'personal_zettls' 
      }, () => {
        console.log('[REALTIME] personal_zettls updated, refreshing dashboard stats...');
        fetchZettlDataRef.current();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const userId = currentUser?.id;
  const currency = currentUser?.preferences?.currency || 'INR';

  const stats = useMemo(() => {
    if (!userId) {
      return {
        totalLent: 0,
        totalBorrowed: 0,
        netBalance: 0,
        totalActiveDebts: 0,
        whoOwesMe: [],
        iOweThem: [],
        recentActivity: [],
        monthlyTrend: [],
        statusDistribution: {
          pendingCount: 0,
          pendingPercent: 0,
          overdueCount: 0,
          overduePercent: 0,
          paidCount: 0,
          paidPercent: 0,
          total: 0
        }
      };
    }

    // 1. Core Summary Metrics (Unsettled Debts)
    const activeDebts = personalZettls.filter(z => !z.isSettled);
    
    // Total Lent (Money others owe current user)
    const totalLent = activeDebts
      .filter(z => z.toUserId === userId)
      .reduce((sum, z) => sum + z.amount, 0);

    // Total Borrowed (Money current user owes others)
    const totalBorrowed = activeDebts
      .filter(z => z.fromUserId === userId)
      .reduce((sum, z) => sum + z.amount, 0);

    const netBalance = totalLent - totalBorrowed;
    const totalActiveDebts = activeDebts.length;

    // 2. Breakdown by Friend
    const whoOwesMeMap = new Map<string, FriendDebtDetail>();
    const iOweThemMap = new Map<string, FriendDebtDetail>();

    activeDebts.forEach(z => {
      if (z.toUserId === userId) {
        // Friend is fromUserId (borrower)
        const fId = z.fromUserId;
        const fName = z.fromUsername;
        const existing = whoOwesMeMap.get(fId) || {
          friendId: fId,
          username: fName,
          fullName: 'Zettl Friend',
          avatar: getAvatarUrl(undefined, fName),
          amount: 0
        };
        existing.amount += z.amount;

        const profile = zettlFriends.find(f => f.friendId === fId || f.userId === fId);
        if (profile) {
          existing.fullName = profile.friendFullName;
          existing.avatar = profile.friendAvatar;
        }
        whoOwesMeMap.set(fId, existing);
      } else if (z.fromUserId === userId) {
        // Friend is toUserId (creditor)
        const fId = z.toUserId;
        const fName = z.toUsername;
        const existing = iOweThemMap.get(fId) || {
          friendId: fId,
          username: fName,
          fullName: 'Zettl Friend',
          avatar: getAvatarUrl(undefined, fName),
          amount: 0
        };
        existing.amount += z.amount;

        const profile = zettlFriends.find(f => f.friendId === fId || f.userId === fId);
        if (profile) {
          existing.fullName = profile.friendFullName;
          existing.avatar = profile.friendAvatar;
        }
        iOweThemMap.set(fId, existing);
      }
    });

    const whoOwesMeList = Array.from(whoOwesMeMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const iOweThemList = Array.from(iOweThemMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 3. Activity Timeline (Recent 5 Debt events)
    const recentActivities: RecentDebtActivity[] = [...personalZettls]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(z => {
        const isLent = z.toUserId === userId;
        const friendId = isLent ? z.fromUserId : z.toUserId;
        const friendName = isLent ? z.fromUsername : z.toUsername;
        const noteText = z.note ? ` for "${z.note}"` : '';
        const verb = isLent ? 'lent' : 'borrowed';
        const prep = isLent ? 'to' : 'from';
        const formattedAmt = formatCurrency(z.amount, currency);

        const description = isLent
          ? `You lent ${formattedAmt} to @${friendName}${noteText}`
          : `You borrowed ${formattedAmt} from @${friendName}${noteText}`;

        const friendProfile = zettlFriends.find(f => f.friendId === friendId || f.userId === friendId);

        return {
          id: z.id,
          description,
          amount: z.amount,
          note: z.note,
          isLent,
          isSettled: z.isSettled,
          createdAt: z.createdAt,
          friendName,
          friendAvatar: friendProfile?.friendAvatar || getAvatarUrl(undefined, friendName)
        };
      });

    // 4. Monthly Trend Data (Last 6 Months: Lent vs Borrowed)
    const monthlyTrendList: MonthlyTrendData[] = Array.from({ length: 6 }).map((_, idx) => {
      const monthDate = subMonths(new Date(), 5 - idx);
      const monthName = format(monthDate, 'MMM');
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      let lentSum = 0;
      let borrowedSum = 0;

      personalZettls.forEach(z => {
        const createDate = parseISO(z.createdAt);
        if (isWithinInterval(createDate, { start, end })) {
          if (z.toUserId === userId) {
            lentSum += z.amount;
          } else if (z.fromUserId === userId) {
            borrowedSum += z.amount;
          }
        }
      });

      return {
        month: monthName,
        Lent: lentSum,
        Borrowed: borrowedSum
      };
    });

    // 5. Debt Status Distribution (Pending vs Paid vs Overdue)
    const allDebts = personalZettls.filter(z => z.toUserId === userId || z.fromUserId === userId);
    const total = allDebts.length;

    let pendingCount = 0;
    let overdueCount = 0;
    let paidCount = 0;

    const now = new Date();

    allDebts.forEach(z => {
      if (z.isSettled) {
        paidCount++;
      } else {
        if (z.dueDate && isAfter(now, parseISO(z.dueDate))) {
          overdueCount++;
        } else {
          pendingCount++;
        }
      }
    });

    const pendingPercent = total > 0 ? Math.round((pendingCount / total) * 100) : 0;
    const overduePercent = total > 0 ? Math.round((overdueCount / total) * 100) : 0;
    const paidPercent = total > 0 ? Math.round((paidCount / total) * 100) : 0;

    return {
      totalLent,
      totalBorrowed,
      netBalance,
      totalActiveDebts,
      whoOwesMe: whoOwesMeList,
      iOweThem: iOweThemList,
      recentActivity: recentActivities,
      monthlyTrend: monthlyTrendList,
      statusDistribution: {
        pendingCount,
        pendingPercent,
        overdueCount,
        overduePercent,
        paidCount,
        paidPercent,
        total
      }
    };
  }, [personalZettls, zettlFriends, userId, currency]);

  // Actions
  const settleAll = async () => {
    const pending = personalZettls.filter(z => !z.isSettled);
    if (pending.length === 0) {
      toast.error('No pending debts to settle.');
      return;
    }

    if (confirm(`Are you sure you want to settle all ${pending.length} outstanding Zettls? This cannot be undone.`)) {
      const toastId = toast.loading('Settling all debts...');
      try {
        await Promise.all(pending.map(z => settleZettl(z.id)));
        toast.success(`Success! Settle all ${pending.length} active debts complete. Check your points!`, { id: toastId });
      } catch (err) {
        console.error('[STATS] Error settling all:', err);
        toast.error('Failed to settle all debts. Please try again.', { id: toastId });
      }
    }
  };

  const settleFriendDebts = async (friendId: string) => {
    const pendingWithFriend = personalZettls.filter(
      z => !z.isSettled && 
      ((z.fromUserId === userId && z.toUserId === friendId) || 
       (z.toUserId === userId && z.fromUserId === friendId))
    );

    if (pendingWithFriend.length === 0) {
      toast.error('No pending debts with this friend.');
      return;
    }

    const friendName = pendingWithFriend[0].fromUserId === userId 
      ? pendingWithFriend[0].toUsername 
      : pendingWithFriend[0].fromUsername;

    if (confirm(`Settle all ${pendingWithFriend.length} active debts with @${friendName}?`)) {
      const toastId = toast.loading(`Settling debts with @${friendName}...`);
      try {
        await Promise.all(pendingWithFriend.map(z => settleZettl(z.id)));
        toast.success(`All debts with @${friendName} settled!`, { id: toastId });
      } catch (err) {
        console.error(`[STATS] Error settling debts with friend ${friendId}:`, err);
        toast.error('Failed to settle debts with friend.', { id: toastId });
      }
    }
  };

  return {
    ...stats,
    loading: isLoading,
    settleAll,
    settleFriendDebts
  };
}

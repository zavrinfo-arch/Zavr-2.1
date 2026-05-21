import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

export interface ZettlActivity {
  id: string;
  type: 'request_sent' | 'payment_sent' | 'reminder_sent' | 'group_created' | 'group_expense';
  title: string;
  body: string;
  amount?: number;
  timestamp: string;
  badge?: string;
}

export function useZettl() {
  const {
    currentUser,
    zettlFriends,
    zettlGroups,
    personalZettls,
    fetchZettlData,
    createPersonalZettl,
    settleZettl,
    remindZettl,
    createZettlGroup,
    addGroupExpense,
    addNotification,
    notifications
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ZettlActivity[]>([]);

  // Calculate Net Balances GPay Style
  const totalOwedToMe = personalZettls
    .filter(z => !z.isSettled && z.toUserId === currentUser?.id)
    .reduce((sum, z) => sum + z.amount, 0);

  const totalIOwe = personalZettls
    .filter(z => !z.isSettled && z.fromUserId === currentUser?.id)
    .reduce((sum, z) => sum + z.amount, 0);

  const netBalance = totalOwedToMe - totalIOwe;

  // Compile active requests (Where friends requested from current user, so current user owes)
  const activeRequests = personalZettls.filter(
    z => !z.isSettled && z.fromUserId === currentUser?.id && z.note?.toLowerCase().includes('request')
  );

  // Compile other payments current user owes
  const activePayments = personalZettls.filter(
    z => !z.isSettled && z.fromUserId === currentUser?.id
  );

  // Calculate Friend balances specifically
  const friendBalances = zettlFriends
    .filter(f => f.status === 'accepted')
    .map(friend => {
      // Amount current friend owes me
      const friendOwesMe = personalZettls
        .filter(z => !z.isSettled && z.toUserId === currentUser?.id && z.fromUserId === friend.friendId)
        .reduce((sum, z) => sum + z.amount, 0);

      // Amount I owe this friend
      const iOweFriend = personalZettls
        .filter(z => !z.isSettled && z.fromUserId === currentUser?.id && z.toUserId === friend.friendId)
        .reduce((sum, z) => sum + z.amount, 0);

      const bal = friendOwesMe - iOweFriend;

      return {
        ...friend,
        balance: bal,
        statusLabel: bal > 0 ? `Owes you ₹${bal}` : bal < 0 ? `You owe ₹${Math.abs(bal)}` : 'Settled up ✓'
      };
    });

  // Calculate activities timeline dynamically from personal zettls list, so it stays perfectly in sync offline/online!
  const generateActivities = useCallback(() => {
    const list: ZettlActivity[] = [];

    // Personal zettls as activities
    personalZettls.forEach((z: any) => {
      const isLender = z.toUserId === currentUser?.id;
      const otherUser = isLender ? z.fromUsername : z.toUsername;

      if (z.isSettled) {
        list.push({
          id: `act-settle-${z.id}`,
          type: 'payment_sent',
          title: isLender ? `Payment Received from @${otherUser}` : `Paid @${otherUser}`,
          body: `Settle for ${z.note || 'Zettl transaction'} finished successfully`,
          amount: z.amount,
          timestamp: z.settledAt || z.createdAt || new Date().toISOString(),
          badge: 'SETTLED'
        });
      } else {
        list.push({
          id: `act-avail-${z.id}`,
          type: 'request_sent',
          title: isLender ? `Requested ₹${z.amount} from @${otherUser}` : `@${otherUser} requested ₹${z.amount}`,
          body: z.note || 'Money Split',
          amount: z.amount,
          timestamp: z.createdAt || new Date().toISOString(),
          badge: 'PENDING'
        });

        // Add reminder history if sent
        if (z.reminderCount > 0) {
          list.push({
            id: `act-remind-${z.id}-${z.reminderCount}`,
            type: 'reminder_sent',
            title: `Reminder Sent to @${otherUser}`,
            body: `Gentle nudge to pay ₹${z.amount} for "${z.note || 'Debt'}"`,
            timestamp: z.reminderLastSentAt || new Date().toISOString(),
            badge: 'REMINDER'
          });
        }
      }
    });

    // Sort chronologically (newest first)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(list);
  }, [personalZettls, currentUser]);

  useEffect(() => {
    generateActivities();
  }, [personalZettls, generateActivities]);

  // Google Pay-style Smart Settlement Suggestions Solver
  const getSmartSuggestions = useCallback(() => {
    const suggestions: { id: string; title: string; subtitle: string; actionText: string; type: 'pay' | 'request' | 'simplify' }[] = [];

    // Suggest paying largest debt to Sarah, or requesting from John
    friendBalances.forEach(fb => {
      if (fb.balance < 0) {
        suggestions.push({
          id: `sug-pay-${fb.friendId}`,
          title: `Pay @${fb.friendUsername} ₹${Math.abs(fb.balance)}`,
          subtitle: `Settle your outstanding balance with @${fb.friendUsername} now.`,
          actionText: 'PAY NOW',
          type: 'pay'
        });
      } else if (fb.balance > 0) {
        suggestions.push({
          id: `sug-req-${fb.friendId}`,
          title: `Nudge @${fb.friendUsername} for ₹${fb.balance}`,
          subtitle: `@${fb.friendUsername} owes you money. Send a lazy UPI reminder.`,
          actionText: 'SEND REMINDER',
          type: 'request'
        });
      }
    });

    // Simplify Debts Suggestion logic placeholder
    if (suggestions.length >= 2) {
      const positive = suggestions.filter(s => s.type === 'request');
      const negative = suggestions.filter(s => s.type === 'pay');
      if (positive.length > 0 && negative.length > 0) {
        suggestions.unshift({
          id: 'sug-simplify-all',
          title: `Auto Optimization Active`,
          subtitle: `Simplify transfers with 1-click ledger netting algorithms.`,
          actionText: 'SIMPLIFY LEDGER',
          type: 'simplify'
        });
      }
    }

    return suggestions.slice(0, 3);
  }, [friendBalances]);

  // 1. REQUEST MONEY FLOW
  const requestMoney = async (friendId: string, amount: number, note: string, dueDate?: string) => {
    setLoading(true);
    try {
      // In a Request, 'I Lent' or 'isOwed' means User A (current user) is owed.
      // So current user is "toUserId", other user is "fromUserId" (who owes).
      // direction: 'lent' maps: toUserId = me, fromUserId = friend
      await createPersonalZettl({
        friendId,
        amount,
        note: `Request: ${note}`,
        dueDate,
        direction: 'lent'
      });

      // Add instant push-style UI notification 
      const friendObj = zettlFriends.find(f => f.friendId === friendId);
      addNotification({
        userId: currentUser?.id || "",
        title: '🔒 Money Request Sent',
        message: `You requested ₹${amount} from @${friendObj?.friendUsername || 'friend'} for ${note}`,
        type: 'reminder'
      });

      await fetchZettlData();
      toast.success('Request sent successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to request money');
    } finally {
      setLoading(false);
    }
  };

  // 2. SEND/PAY MONEY FLOW
  const sendMoney = async (friendId: string, amount: number, note: string) => {
    setLoading(true);
    try {
      // "I sent money" means 'I Borrowed' (fromUserId = me, toUserId = friend) and immediately marked as settled.
      // So we create the transaction item and then settle it, or we trigger direct API.
      // To keep it clean and robust, we can create it as 'borrowed' then immediately settle.
      // Let's create it - standard API supports direction: 'borrowed' directly.
      await createPersonalZettl({
        friendId,
        amount,
        note: `Sent: ${note}`,
        direction: 'borrowed'
      });

      // Add GPay success feedback and notification
      const friendObj = zettlFriends.find(f => f.friendId === friendId);
      addNotification({
        userId: currentUser?.id || "",
        title: '💸 Payment Sent Successfully',
        message: `Successfully transferred ₹${amount} to @${friendObj?.friendUsername || 'friend'} for "${note}"`,
        type: 'group'
      });

      await fetchZettlData();
      toast.success('Money sent successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send payments');
    } finally {
      setLoading(false);
    }
  };

  // 3. PAY / SETTLE SPECIFIC LAZY DEBT
  const payDebt = async (zettlId: string) => {
    setLoading(true);
    try {
      const item = personalZettls.find(z => z.id === zettlId);
      await settleZettl(zettlId);

      addNotification({
        userId: currentUser?.id || "",
        title: '✅ Transaction Completed',
        message: `Settle payment of ₹${item?.amount || 0} is fully complete!`,
        type: 'achievement'
      });

      await fetchZettlData();
      toast.success('Tally updated!');
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. REMIND FRIEND ABOUT OUTSTANDING DEBT
  const raiseReminder = async (zettlId: string) => {
    try {
      await remindZettl(zettlId);
      const item = personalZettls.find(z => z.id === zettlId);
      toast.success(`Lazy nudge sent for ₹${item?.amount || 0}`);
    } catch (err: any) {
      toast.error(err.message || 'Reminder alert failed');
    }
  };

  // 5. CREATE GROUP WITH AUTOMATIC SPLITS
  const createGroupZettl = async (name: string, members: string[]) => {
    setLoading(true);
    try {
      await createZettlGroup(name, members);
      toast.success(`"${name}" created with friends!`);
      await fetchZettlData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create circle');
    } finally {
      setLoading(false);
    }
  };

  // 6. RECORD GROUP BILL EXPENSE
  const postGroupExpense = async (groupId: string, amount: number, description: string, splits: { userId: string; amountOwed: number }[]) => {
    setLoading(true);
    try {
      await addGroupExpense({
        groupId,
        amount,
        description,
        splits
      });
      toast.success('Group expense added successfully!');
      await fetchZettlData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add group bill');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    totalOwedToMe,
    totalIOwe,
    netBalance,
    activeRequests,
    activePayments,
    friendBalances,
    activities,
    suggestions: getSmartSuggestions(),
    requestMoney,
    sendMoney,
    payDebt,
    raiseReminder,
    createGroupZettl,
    postGroupExpense,
    refresh: fetchZettlData
  };
}

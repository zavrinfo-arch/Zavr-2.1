import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Friend, User } from '../types';
import toast from 'react-hot-toast';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useSupabaseFriends() {
  const { currentUser } = useStore();
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper: Search users matching a username (case-insensitive)
  const searchUsers = useCallback(async (searchTerm: string): Promise<User[]> => {
    if (!searchTerm || searchTerm.trim() === '') return [];
    try {
      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchTerm.trim()}%`)
        .neq('id', currentUser?.id || '')
        .limit(10);

      if (searchError) throw searchError;

      return (data || []).map((p: any) => ({
        id: p.id,
        fullName: p.full_name || p.fullName || '',
        username: p.username,
        email: p.email || '',
        phone: p.phone || '',
        dob: p.birth_date || p.dob || '',
        location: p.location || '',
        avatar: p.avatar_url || p.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.username}`,
        avatarId: p.avatar_id || '',
        streak: p.streak || 0,
        onboardingCompleted: p.onboarding_completed || false,
        interests: p.interests || [],
        badges: p.badges || [],
        createdAt: p.created_at || '',
        lastLoginDate: p.last_login_date || null,
        streakFreezeCount: p.streak_freeze_count || 0,
        xp: p.xp || 0,
        level: p.level || 1,
        preferences: p.preferences || {
          currency: 'INR',
          notificationsEnabled: true,
          reminders: { enabled: false, time: '12:00', frequency: 'daily' }
        }
      }));
    } catch (err: any) {
      console.error('[useSupabaseFriends] searchUsers failed:', err);
      return [];
    }
  }, [currentUser?.id]);

  // Load friends and pending requests from Supabase
  const loadFriendData = useCallback(async () => {
    const activeUserId = currentUser?.id;
    if (!activeUserId) return;

    setLoading(true);
    setError(null);
    try {
      // 1. Fetch from 'friendships' table if exists, fallback to 'friends' table
      let rawFriends: any[] = [];
      let usedTable = 'friendships';
      
      const { data: friendshipsData, error: friendshipsErr } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${activeUserId},receiver_id.eq.${activeUserId}`);

      if (!friendshipsErr && friendshipsData) {
        rawFriends = friendshipsData;
      } else {
        // Fallback to legacy 'friends' table
        const { data: friendsData, error: friendsErr } = await supabase
          .from('friends')
          .select('*')
          .or(`user_id.eq.${activeUserId},friend_id.eq.${activeUserId}`);
        
        if (friendsErr) throw friendsErr;
        rawFriends = (friendsData || []).map((f: any) => ({
          id: f.id,
          sender_id: f.user_id,
          receiver_id: f.friend_id,
          status: f.status || 'accepted',
          created_at: f.created_at
        }));
        usedTable = 'friends';
      }

      if (rawFriends.length === 0) {
        setFriendsList([]);
        setPendingRequests([]);
        return;
      }

      // Gather distinct targets profile IDs
      const targetIds = Array.from(
        new Set(
          rawFriends.flatMap((f: any) => [f.sender_id, f.receiver_id])
        )
      ).filter(id => id !== activeUserId);

      if (targetIds.length === 0) {
        setFriendsList([]);
        setPendingRequests([]);
        return;
      }

      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', targetIds);

      if (profileErr) throw profileErr;

      const profilesMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => {
        profilesMap.set(p.id, p);
      });

      const mappedFriends: Friend[] = rawFriends.map((f: any) => {
        const isSender = f.sender_id === activeUserId;
        const targetId = isSender ? f.receiver_id : f.sender_id;
        const profile = profilesMap.get(targetId);

        return {
          id: f.id,
          userId: f.sender_id,
          friendId: targetId,
          friendUsername: profile?.username || 'user',
          friendFullName: profile?.full_name || profile?.fullName || 'Zettl Friend',
          friendAvatar: profile?.avatar_url || profile?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${profile?.username || targetId}`,
          status: f.status as 'pending' | 'accepted' | 'blocked',
          type: (isSender ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
          createdAt: f.created_at
        };
      });

      setFriendsList(mappedFriends.filter(f => f.status === 'accepted'));
      setPendingRequests(mappedFriends.filter(f => f.status === 'pending'));
    } catch (err: any) {
      console.error('[useSupabaseFriends] loadFriendData failed:', err);
      setError(err.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Send friend request by receiver's username
  const sendFriendRequest = useCallback(async (receiverUsername: string): Promise<void> => {
    const activeUserId = currentUser?.id;
    if (!activeUserId) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', receiverUsername.trim())
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile) {
        toast.error('User profile not found');
        return;
      }

      if (profile.id === activeUserId) {
        toast.error('You cannot link yourself');
        return;
      }

      // Check if relationship already exists in friendships
      const { data: existing, error: existErr } = await supabase
        .from('friendships')
        .select('*')
        .in('sender_id', [activeUserId, profile.id])
        .in('receiver_id', [activeUserId, profile.id])
        .maybeSingle();

      if (existing) {
        toast.error(existing.status === 'accepted' ? 'Already linked!' : 'A connection invitation is already pending');
        return;
      }

      // Insert into friendships
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          sender_id: activeUserId,
          receiver_id: profile.id,
          status: 'pending'
        });

      // Also support legacy friends table insertion if required
      try {
        await supabase
          .from('friends')
          .insert({
            user_id: activeUserId,
            friend_id: profile.id,
            status: 'pending'
          });
      } catch (err) {
        // Legacy insert error caught safely
      }

      if (insertError) throw insertError;

      // Log in notifications/activities
      try {
        const notifData = { senderId: activeUserId };
        await supabase.from('notifications').insert({
          id: generateUUID(),
          user_id: profile.id,
          type: 'reminder',
          title: '👥 Connection Invite',
          message: `@${currentUser?.username || 'A user'} wants to link with you. |||DATA:${JSON.stringify(notifData)}`,
          read: false
        });
      } catch (nErr) {
        // Safe logging
      }

      toast.success('Connection invite sent!');
      loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] sendFriendRequest failed:', err);
      toast.error(err.message || 'Failed to dispatch invite');
    }
  }, [currentUser?.id, currentUser?.username, loadFriendData]);

  // Accept incoming friend request
  const acceptFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    try {
      // Direct updates to both friendships and friends tables for complete synchronization
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      // Attempt to find the sender's profile for notification
      const { data: friendship } = await supabase
        .from('friendships')
        .select('sender_id')
        .eq('id', requestId)
        .maybeSingle();

      if (friendship?.sender_id) {
        try {
          await supabase.from('notifications').insert({
            id: generateUUID(),
            user_id: friendship.sender_id,
            type: 'achievement',
            title: '🤝 Connection Accepted',
            message: `@${currentUser?.username || 'Your friend'} accepted your link request!`,
            read: false
          });
        } catch {}
      }

      toast.success('Connection finalized!');
      loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] acceptFriendRequest failed:', err);
      toast.error('Accept operation failed');
    }
  }, [currentUser?.username, loadFriendData]);

  // Decline/Reject friend request
  const declineFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    try {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);

      await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      toast.success('Invite declined');
      loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] declineFriendRequest failed:', err);
      toast.error('Decline operation failed');
    }
  }, [loadFriendData]);

  // Automatically fetch on mount or profile change
  useEffect(() => {
    if (currentUser?.id) {
      loadFriendData();
    }
  }, [currentUser?.id, loadFriendData]);

  return {
    friendsList,
    pendingRequests,
    loading,
    error,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    refreshFriendData: loadFriendData
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { friendService, clearFriendsCache } from '../services/friendService';
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

  // Helper: Search users matching a username or full name (case-insensitive)
  const searchUsers = useCallback(async (searchTerm: string): Promise<User[]> => {
    if (!searchTerm || searchTerm.trim() === '') return [];
    try {
      return await friendService.searchUsers(searchTerm, currentUser?.id);
    } catch (err: any) {
      console.error('[useSupabaseFriends] searchUsers failed:', err);
      return [];
    }
  }, [currentUser?.id]);

  // Load friends and pending requests from Supabase
  const loadFriendData = useCallback(async () => {
    const activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) return;

    setLoading(true);
    setError(null);
    try {
      // 1. Fetch established friends from 'friends' table
      const { data: friendsData, error: friendsErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${activeUserId},friend_id.eq.${activeUserId}`);

      if (friendsErr) {
        console.warn('[useSupabaseFriends] Error loading friends table:', friendsErr.message);
      }

      // 2. Fetch pending requests from 'friend_requests' table
      const { data: requestsData, error: requestsErr } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${activeUserId},receiver_id.eq.${activeUserId}`)
        .eq('status', 'pending');

      if (requestsErr) {
        console.warn('[useSupabaseFriends] Error loading friend_requests table:', requestsErr.message);
      }

      const establishedRows = friendsData || [];
      const pendingRows = requestsData || [];

      // Collect target profile IDs
      const targetUserIds = new Set<string>();
      establishedRows.forEach((f: any) => {
        const targetId = f.user_id === activeUserId ? f.friend_id : f.user_id;
        if (targetId && targetId !== activeUserId) targetUserIds.add(targetId);
      });
      pendingRows.forEach((r: any) => {
        const targetId = r.sender_id === activeUserId ? r.receiver_id : r.sender_id;
        if (targetId && targetId !== activeUserId) targetUserIds.add(targetId);
      });

      const profileMap = new Map<string, any>();
      if (targetUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', Array.from(targetUserIds));

        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
      }

      // Build established friends
      const mappedFriends: Friend[] = establishedRows.map((f: any) => {
        const targetId = f.user_id === activeUserId ? f.friend_id : f.user_id;
        const profile = profileMap.get(targetId);
        const username = profile?.username || `user_${targetId.slice(0, 6)}`;
        return {
          id: f.id,
          userId: activeUserId,
          friendId: targetId,
          friendUsername: username,
          friendFullName: profile?.full_name || username || 'Zettl Friend',
          friendAvatar: profile?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`,
          status: 'accepted',
          type: 'outgoing',
          createdAt: f.created_at
        };
      });

      // Build pending requests
      const mappedPending: Friend[] = pendingRows.map((r: any) => {
        const isSender = r.sender_id === activeUserId;
        const targetId = isSender ? r.receiver_id : r.sender_id;
        const profile = profileMap.get(targetId);
        const username = profile?.username || `user_${targetId.slice(0, 6)}`;
        return {
          id: r.id,
          userId: r.sender_id,
          friendId: targetId,
          friendUsername: username,
          friendFullName: profile?.full_name || username || 'Zettl Friend',
          friendAvatar: profile?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`,
          status: 'pending',
          type: isSender ? 'outgoing' : 'incoming',
          createdAt: r.created_at
        };
      });

      setFriendsList(mappedFriends);
      setPendingRequests(mappedPending);
    } catch (err: any) {
      console.error('[useSupabaseFriends] loadFriendData failed:', err);
      setError(err.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Send friend request by receiver's username
  const sendFriendRequest = useCallback(async (receiverUsername: string): Promise<void> => {
    const activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    if (!activeUserId) {
      toast.error('Not authenticated');
      return;
    }

    try {
      await friendService.sendFriendRequestByUsername(receiverUsername);
      toast.success('Connection invite sent!');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] sendFriendRequest failed:', err);
      toast.error(err.message || 'Failed to dispatch invite');
    }
  }, [currentUser?.id, loadFriendData]);

  // Accept incoming friend request
  const acceptFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    const activeUserId = currentUser?.id || useStore.getState().session?.user?.id;
    try {
      await friendService.acceptFriendRequest(requestId, activeUserId);
      toast.success('Connection finalized!');
      clearFriendsCache();
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('friend-request-accepted', { detail: { requestId } }));
      }
      
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      await loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] acceptFriendRequest failed:', err);
      toast.error('Accept operation failed');
    }
  }, [currentUser?.id, loadFriendData]);

  // Decline/Reject friend request
  const declineFriendRequest = useCallback(async (requestId: string): Promise<void> => {
    try {
      await friendService.rejectFriendRequest(requestId);
      toast.success('Invite declined');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      await loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] declineFriendRequest failed:', err);
      toast.error('Decline operation failed');
    }
  }, [loadFriendData]);

  // Remove friend connection
  const removeFriendConnection = useCallback(async (friendId: string): Promise<void> => {
    try {
      await friendService.removeFriend(friendId);
      toast.success('Connection removed');
      clearFriendsCache();
      await useStore.getState().refreshFriendsForDropdown(true);
      await useStore.getState().refreshAllData();
      await loadFriendData();
    } catch (err: any) {
      console.error('[useSupabaseFriends] removeFriendConnection failed:', err);
      toast.error('Remove connection failed');
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
    removeFriendConnection,
    refreshFriendData: loadFriendData
  };
}

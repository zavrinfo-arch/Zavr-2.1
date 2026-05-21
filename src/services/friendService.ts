import { supabase } from '../lib/supabaseClient';
import { Friend, User } from '../types';

export const friendService = {
  /**
   * Search users by username (excluding current user)
   */
  async searchUsers(query: string, currentUserId?: string): Promise<User[]> {
    if (!query || query.trim() === '') return [];
    
    let dbQuery = supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query.trim()}%`);

    if (currentUserId) {
      dbQuery = dbQuery.neq('id', currentUserId);
    }

    const { data, error } = await dbQuery.limit(15);
    if (error) {
      console.error('[FRIEND-SERVICE] Search error:', error);
      throw error;
    }

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
  },

  /**
   * Send a friend request
   */
  async sendFriendRequest(friendId: string, currentUserId: string): Promise<void> {
    if (!currentUserId || !friendId) return;
    
    const { error } = await supabase
      .from('friends')
      .insert({
        user_id: currentUserId,
        friend_id: friendId,
        status: 'pending'
      });

    if (error) {
      console.error('[FRIEND-SERVICE] Send friend request failed:', error);
      throw error;
    }

    // Add a pending notification
    try {
      await supabase.from('notifications').insert({
        user_id: friendId,
        type: 'reminder',
        title: '👥 New Friend Link Request',
        body: `A user has sent you a connection request.`,
        data: JSON.stringify({ senderId: currentUserId }),
        read: false
      });
    } catch (nErr) {
      console.warn('[FRIEND-SERVICE] Warning building request notification:', nErr);
    }
  },

  /**
   * Accept friend request
   */
  async acceptFriendRequest(requestId: string, currentUserId?: string): Promise<void> {
    const { data: requestRecord } = await supabase
      .from('friends')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (error) {
      console.error('[FRIEND-SERVICE] Accept friend request failed:', error);
      throw error;
    }

    // Notify the other user that request is accepted
    if (requestRecord) {
      try {
        const sender = requestRecord.user_id;
        await supabase.from('notifications').insert({
          user_id: sender,
          type: 'achievement',
          title: '🤝 Connection Accepted',
          body: `Your friend link request was accepted! You are now interconnected.`,
          data: JSON.stringify({ accepterId: currentUserId }),
          read: false
        });
      } catch (nErr) {
        console.warn('[FRIEND-SERVICE] Warning building accept notification:', nErr);
      }
    }
  },

  /**
   * Reject friend request
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('[FRIEND-SERVICE] Reject friend request failed:', error);
      throw error;
    }
  },

  /**
   * List all friends of the current user
   */
  async getFriendList(userId: string): Promise<Friend[]> {
    if (!userId) return [];

    // Query both outgoing (user_id = userId) and incoming (friend_id = userId)
    const { data: rawFriends, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) {
      console.error('[FRIEND-SERVICE] Get friend list error:', error);
      throw error;
    }

    if (!rawFriends || rawFriends.length === 0) return [];

    // Gather distinct user IDs to fetch profile data in a scalable batch call
    const userIdsToFetch = Array.from(
      new Set(
        rawFriends.flatMap((f: any) => [f.user_id, f.friend_id])
      )
    ).filter(id => id !== userId);

    if (userIdsToFetch.length === 0) return [];

    const { data: rawProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIdsToFetch);

    if (profileError) {
      console.error('[FRIEND-SERVICE] Batch profiles load failed:', profileError);
      throw profileError;
    }

    const profilesMap = new Map<string, any>();
    (rawProfiles || []).forEach((p: any) => {
      profilesMap.set(p.id, p);
    });

    return rawFriends.map((f: any) => {
      const isSender = f.user_id === userId;
      const targetUserId = isSender ? f.friend_id : f.user_id;
      const targetProfile = profilesMap.get(targetUserId);

      return {
        id: f.id,
        userId: f.user_id,
        friendId: targetUserId,
        friendUsername: targetProfile?.username || 'user',
        friendFullName: targetProfile?.full_name || targetProfile?.fullName || 'Zettl Friend',
        friendAvatar: targetProfile?.avatar_url || targetProfile?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${targetProfile?.username || targetUserId}`,
        status: f.status as 'pending' | 'accepted' | 'blocked',
        type: isSender ? 'outgoing' : 'incoming',
        createdAt: f.created_at
      };
    });
  }
};

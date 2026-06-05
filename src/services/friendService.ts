import { Friend, User } from '../types';

export const friendService = {
  /**
   * Search users by username (excluding current user)
   */
  async searchUsers(query: string, currentUserId?: string): Promise<User[]> {
    if (!query || query.trim() === '') return [];
    
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) {
        throw new Error('Search request failed');
      }
      const data = await response.json();
      return (data || []).map((p: any) => ({
        id: p.id,
        fullName: p.fullName || p.full_name || '',
        username: p.username,
        email: p.email || '',
        phone: p.phone || '',
        dob: p.dob || '',
        location: p.location || '',
        avatar: p.avatar || p.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.username}`,
        avatarId: p.avatarId || p.avatar_id || '',
        streak: p.streak || 0,
        onboardingCompleted: p.onboardingCompleted || p.onboarding_completed || false,
        interests: p.interests || [],
        badges: p.badges || [],
        createdAt: p.createdAt || p.created_at || '',
        lastLoginDate: p.lastLoginDate || p.last_login_date || null,
        preferences: p.preferences || {
          currency: 'INR',
          notificationsEnabled: true,
          reminders: { enabled: false, time: '12:00', frequency: 'daily' }
        }
      }));
    } catch (err) {
      console.error('[FRIEND-SERVICE] Search error:', err);
      return [];
    }
  },

  /**
   * Send a friend request
   */
  async sendFriendRequest(friendId: string, currentUserId: string): Promise<void> {
    if (!friendId) return;
    
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ friendId })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to dispatch connection invitation');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Send friend request failed:', err);
      throw err;
    }
  },

  /**
   * Send a friend request by username
   */
  async sendFriendRequestByUsername(username: string): Promise<void> {
    if (!username) return;
    
    try {
      const response = await fetch('/api/friends/request-by-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send friend request');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Send friend request by username failed:', err);
      throw err;
    }
  },

  /**
   * Accept friend request
   */
  async acceptFriendRequest(requestId: string, currentUserId?: string): Promise<void> {
    if (!requestId) return;

    try {
      const response = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to finalize connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Accept friend request failed:', err);
      throw err;
    }
  },

  /**
   * Reject friend request
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    if (!requestId) return;

    try {
      const response = await fetch(`/api/friends/decline/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to decline connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Reject friend request failed:', err);
      throw err;
    }
  },

  /**
   * List all friends of the current user
   */
  async getFriendList(userId: string): Promise<Friend[]> {
    if (!userId) return [];

    try {
      const response = await fetch('/api/friends/list');
      if (!response.ok) {
        throw new Error('Failed to retrieve connections');
      }

      const rawFriends = await response.json();
      return (rawFriends || []).map((f: any) => ({
        id: f.id,
        userId: f.user_id,
        friendId: f.friend_id || f.friend?.id,
        friendUsername: f.friend?.username || 'user',
        friendFullName: f.friend?.full_name || f.friend?.fullName || 'Zavr Friend',
        friendAvatar: f.friend?.avatar_url || f.friend?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${f.friend?.username || f.friend_id}`,
        status: f.status as 'pending' | 'accepted' | 'blocked',
        type: f.type as 'outgoing' | 'incoming',
        createdAt: f.created_at
      }));
    } catch (err) {
      console.error('[FRIEND-SERVICE] getFriendList error:', err);
      return [];
    }
  }
};

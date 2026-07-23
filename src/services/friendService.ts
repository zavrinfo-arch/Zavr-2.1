import { Friend, User } from '../types';
import { supabase } from '../lib/supabaseClient';

const SEARCH_CACHE_PREFIX = 'user_search_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function mapUser(p: any): User {
  const username = p.username || 'user';
  return {
    id: p.id,
    fullName: p.fullName || p.full_name || username,
    username: username,
    email: p.email || '',
    phone: p.phone || '',
    dob: p.dob || p.birth_date || '',
    gender: p.gender || '',
    location: p.location || '',
    avatar: p.avatar || p.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`,
    avatarId: p.avatarId || p.avatar_id || '',
    streak: p.streak || 0,
    onboardingCompleted: p.onboardingCompleted || p.onboarding_completed || false,
    interests: p.interests || [],
    badges: p.badges || [],
    createdAt: p.createdAt || p.created_at || new Date().toISOString(),
    lastLoginDate: p.lastLoginDate || p.last_login_date || p.last_login_at || null,
    streakFreezeCount: p.streakFreezeCount || p.streak_freeze_count || 0,
    xp: p.xp || 0,
    level: p.level || 1,
    preferences: p.preferences || {
      currency: 'INR',
      notificationsEnabled: true,
      reminders: { enabled: true, time: '12:00', frequency: 'daily' }
    }
  };
}

export function mapUsers(items: any[]): User[] {
  if (!Array.isArray(items)) return [];
  return items.map(mapUser);
}

export function clearFriendsCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(SEARCH_CACHE_PREFIX) || key.includes('friend') || key.includes('dropdown'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('friends_dropdown_cache');
    }
    console.log('✅ Cleared friend search and dropdown caches');
  } catch (e) {
    console.warn('⚠️ Friend cache clear warning:', e);
  }
}

function getCachedSearchResults(query: string): User[] | null {
  try {
    const raw = localStorage.getItem(`${SEARCH_CACHE_PREFIX}${query.toLowerCase().trim()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return mapUsers(parsed.results);
    }
    localStorage.removeItem(`${SEARCH_CACHE_PREFIX}${query.toLowerCase().trim()}`);
  } catch (e) {
    console.warn('⚠️ Search cache error:', e);
  }
  return null;
}

function cacheSearchResults(query: string, results: User[]): void {
  if (!query || !results) return;
  try {
    localStorage.setItem(
      `${SEARCH_CACHE_PREFIX}${query.toLowerCase().trim()}`,
      JSON.stringify({
        timestamp: Date.now(),
        results,
      })
    );
  } catch (e) {
    console.warn('⚠️ Search cache write error:', e);
  }
}

export const friendService = {
  /**
   * Search users by username or full name
   */
  async searchUsers(query: string, currentUserId?: string, signal?: AbortSignal): Promise<User[]> {
    if (!query || query.trim() === '') return [];
    const cleanedQuery = query.trim().toLowerCase();

    // 1. Try primary API endpoint
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(cleanedQuery)}`, { signal });
      if (response.ok) {
        const data = await response.json();
        const users = mapUsers(data).filter(u => !currentUserId || u.id !== currentUserId);
        if (users.length > 0) {
          cacheSearchResults(cleanedQuery, users);
          return users;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return [];
      console.warn('⚠️ /api/users/search failed, falling back to direct Supabase query:', err.message || err);
    }

    // 2. Direct Supabase Query Fallback
    try {
      let dbQuery = supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${cleanedQuery}%,full_name.ilike.%${cleanedQuery}%`)
        .limit(20);

      if (currentUserId) {
        dbQuery = dbQuery.neq('id', currentUserId);
      }

      const { data: dbData, error: dbError } = await dbQuery;

      if (!dbError && dbData && dbData.length > 0) {
        const users = mapUsers(dbData);
        cacheSearchResults(cleanedQuery, users);
        return users;
      }
    } catch (err) {
      console.warn('⚠️ Direct Supabase user search failed:', err);
    }

    // 3. LocalStorage Cache Fallback
    const cached = getCachedSearchResults(cleanedQuery);
    if (cached) {
      return cached.filter(u => !currentUserId || u.id !== currentUserId);
    }

    return [];
  },

  /**
   * Send a friend request
   */
  async sendFriendRequest(friendId: string, currentUserId: string): Promise<void> {
    if (!friendId) return;
    
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send friend request');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Send friend request failed:', err);
      // Fallback: direct Supabase insert into friend_requests
      try {
        // Delete any existing declined request first
        await supabase
          .from('friend_requests')
          .delete()
          .in('sender_id', [currentUserId, friendId])
          .in('receiver_id', [currentUserId, friendId])
          .neq('status', 'accepted');

        const { error: dbErr } = await supabase.from('friend_requests').insert({
          sender_id: currentUserId,
          receiver_id: friendId,
          status: 'pending'
        });
        if (dbErr) throw dbErr;
        console.log('✅ Sent friend request via direct Supabase fallback');
      } catch (fallbackErr) {
        throw err;
      }
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
        headers: { 'Content-Type': 'application/json' },
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
  async acceptFriendRequest(
    requestId: string, 
    currentUserId?: string,
    onAcceptedCallback?: () => void | Promise<void>
  ): Promise<void> {
    if (!requestId) return;

    try {
      const response = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to accept connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Accept friend request failed, using direct Supabase fallback:', err);
      // Direct Supabase fallback
      try {
        const { data: reqData } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('id', requestId)
          .maybeSingle();

        await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (reqData) {
          const u1 = reqData.sender_id;
          const u2 = reqData.receiver_id;

          const { data: existing1 } = await supabase.from('friends').select('id').eq('user_id', u1).eq('friend_id', u2).maybeSingle();
          if (!existing1) await supabase.from('friends').insert({ user_id: u1, friend_id: u2 });

          const { data: existing2 } = await supabase.from('friends').select('id').eq('user_id', u2).eq('friend_id', u1).maybeSingle();
          if (!existing2) await supabase.from('friends').insert({ user_id: u2, friend_id: u1 });
        }
        console.log('✅ Accepted friend request via direct Supabase fallback');
      } catch (fallbackErr) {
        throw err;
      }
    } finally {
      // Invalidate cache and broadcast event
      clearFriendsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('friend-request-accepted', {
          detail: { requestId, currentUserId }
        }));
      }
      if (onAcceptedCallback) {
        try {
          await onAcceptedCallback();
        } catch (cbErr) {
          console.warn('[FRIEND-SERVICE] Callback execution warning:', cbErr);
        }
      }
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
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to decline connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Reject friend request failed:', err);
      try {
        await supabase.from('friend_requests').delete().eq('id', requestId);
      } catch (e) {
        throw err;
      }
    }
  },

  /**
   * List all friends & pending requests of the current user
   */
  async getFriendList(userId: string): Promise<Friend[]> {
    if (!userId) return [];

    try {
      const response = await fetch('/api/friends/list');
      if (response.ok) {
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
      }
    } catch (err) {
      console.warn('[FRIEND-SERVICE] API getFriendList failed, trying direct Supabase fallback:', err);
    }

    // Direct Supabase fallback
    try {
      // 1. Fetch established friends
      const { data: rawFriends } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      // 2. Fetch pending requests
      const { data: rawRequests } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('status', 'pending');

      const established = rawFriends || [];
      const pending = rawRequests || [];

      // Collect target profile IDs
      const targetUserIds = new Set<string>();
      established.forEach((f: any) => {
        const targetId = f.user_id === userId ? f.friend_id : f.user_id;
        if (targetId && targetId !== userId) targetUserIds.add(targetId);
      });
      pending.forEach((r: any) => {
        const targetId = r.sender_id === userId ? r.receiver_id : r.sender_id;
        if (targetId && targetId !== userId) targetUserIds.add(targetId);
      });

      const profileMap = new Map<string, any>();
      if (targetUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', Array.from(targetUserIds));

        (profiles || []).forEach(p => profileMap.set(p.id, p));
      }

      const mappedEstablished: Friend[] = established.map((f: any) => {
        const targetId = f.user_id === userId ? f.friend_id : f.user_id;
        const p = profileMap.get(targetId);
        return {
          id: f.id,
          userId: userId,
          friendId: targetId,
          friendUsername: p?.username || 'user',
          friendFullName: p?.full_name || p?.username || 'Zavr Friend',
          friendAvatar: p?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p?.username || targetId}`,
          status: 'accepted',
          type: 'outgoing',
          createdAt: f.created_at
        };
      });

      const mappedPending: Friend[] = pending.map((r: any) => {
        const isSender = r.sender_id === userId;
        const targetId = isSender ? r.receiver_id : r.sender_id;
        const p = profileMap.get(targetId);
        return {
          id: r.id,
          userId: r.sender_id,
          friendId: targetId,
          friendUsername: p?.username || 'user',
          friendFullName: p?.full_name || p?.username || 'Zavr Friend',
          friendAvatar: p?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p?.username || targetId}`,
          status: 'pending',
          type: isSender ? 'outgoing' : 'incoming',
          createdAt: r.created_at
        };
      });

      return [...mappedEstablished, ...mappedPending];
    } catch (e) {
      console.error('[FRIEND-SERVICE] getFriendList fallback error:', e);
      return [];
    }
  },

  /**
   * Remove/Delete a friendship connection
   */
  async removeFriend(friendId: string, currentUserId?: string): Promise<void> {
    if (!friendId) return;

    try {
      const response = await fetch(`/api/friends/remove/${friendId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to remove connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Remove friend failed, trying direct Supabase fallback:', err);
      try {
        if (currentUserId) {
          await supabase.from('friends').delete().or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`);
          await supabase.from('friend_requests').delete().or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`);
        } else {
          await supabase.from('friends').delete().eq('id', friendId);
        }
      } catch (e) {
        throw err;
      }
    } finally {
      clearFriendsCache();
    }
  }
};

import { Friend, User } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getAvatarUrl } from '../constants/avatars';

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
    avatar: getAvatarUrl(p.avatar || p.avatar_url, username),
    avatarId: p.avatarId || p.avatar_id || 'avatar_1',
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
    
    console.log(`[FRIEND-SERVICE] Sending friend request to friendId: ${friendId} from currentUserId: ${currentUserId}`);
    let isUserError = false;
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      });
      
      const resData = await response.json().catch(() => ({}));
      console.log(`[FRIEND-SERVICE] POST /api/friends/request status: ${response.status}`, resData);

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          isUserError = true;
        }
        throw new Error(resData.error || 'Failed to send friend request');
      }

      clearFriendsCache();
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Send friend request error:', err.message || err);
      if (isUserError) {
        throw err;
      }
      // Fallback for network or 500 errors: direct Supabase insert into friend_requests
      try {
        console.log('[FRIEND-SERVICE] Attempting direct Supabase fallback insert...');
        // Delete any existing declined request first
        const { error: delErr } = await supabase
          .from('friend_requests')
          .delete()
          .in('sender_id', [currentUserId, friendId])
          .in('receiver_id', [currentUserId, friendId])
          .neq('status', 'accepted');
        
        if (delErr) {
          console.error('[FRIEND-SERVICE] Supabase cleanup error in fallback:', delErr);
        }

        const { error: dbErr } = await supabase.from('friend_requests').insert({
          sender_id: currentUserId,
          receiver_id: friendId,
          status: 'pending'
        });

        if (dbErr) {
          console.error('[FRIEND-SERVICE] Supabase insert error in fallback:', dbErr);
          throw dbErr;
        }
        console.log('✅ Sent friend request via direct Supabase fallback');
        clearFriendsCache();
      } catch (fallbackErr: any) {
        console.error('[FRIEND-SERVICE] Supabase fallback failed:', fallbackErr);
        throw err;
      }
    }
  },

  /**
   * Send a friend request by username
   */
  async sendFriendRequestByUsername(username: string): Promise<void> {
    if (!username) return;
    
    console.log(`[FRIEND-SERVICE] Sending friend request by username: "${username}"`);
    try {
      const response = await fetch('/api/friends/request-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const resData = await response.json().catch(() => ({}));
      console.log(`[FRIEND-SERVICE] POST /api/friends/request-by-username status: ${response.status}`, resData);

      if (!response.ok) {
        throw new Error(resData.error || 'Failed to send friend request');
      }

      clearFriendsCache();
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Send friend request by username failed:', err.message || err);
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

    console.log(`[FRIEND-SERVICE] Accepting friend request ID: ${requestId}`);
    let isUserError = false;
    try {
      const response = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const resData = await response.json().catch(() => ({}));
      console.log(`[FRIEND-SERVICE] POST /api/friends/accept/${requestId} status: ${response.status}`, resData);

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          isUserError = true;
        }
        throw new Error(resData.error || 'Failed to accept connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Accept friend request API error:', err.message || err);
      if (isUserError) throw err;

      // Direct Supabase fallback
      try {
        console.log('[FRIEND-SERVICE] Attempting direct Supabase fallback accept...');
        const { data: reqData, error: selErr } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('id', requestId)
          .maybeSingle();

        if (selErr) console.error('[FRIEND-SERVICE] Supabase select error in accept fallback:', selErr);

        const { error: updErr } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (updErr) console.error('[FRIEND-SERVICE] Supabase update error in accept fallback:', updErr);

        if (reqData) {
          const u1 = reqData.sender_id;
          const u2 = reqData.receiver_id;

          const { data: existing1 } = await supabase.from('friends').select('id').eq('user_id', u1).eq('friend_id', u2).limit(1);
          if (!existing1 || existing1.length === 0) {
            const { error: ins1Err } = await supabase.from('friends').insert({ user_id: u1, friend_id: u2 });
            if (ins1Err && ins1Err.code !== '23505') console.warn('[FRIEND-SERVICE] Supabase ins1 notice:', ins1Err.message);
          }

          const { data: existing2 } = await supabase.from('friends').select('id').eq('user_id', u2).eq('friend_id', u1).limit(1);
          if (!existing2 || existing2.length === 0) {
            const { error: ins2Err } = await supabase.from('friends').insert({ user_id: u2, friend_id: u1 });
            if (ins2Err && ins2Err.code !== '23505') console.warn('[FRIEND-SERVICE] Supabase ins2 notice:', ins2Err.message);
          }
        }
        console.log('✅ Accepted friend request via direct Supabase fallback');
      } catch (fallbackErr: any) {
        console.error('[FRIEND-SERVICE] Supabase accept fallback failed:', fallbackErr);
        throw err;
      }
    } finally {
      // Invalidate cache and broadcast events
      clearFriendsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('friend-request-accepted', {
          detail: { requestId, currentUserId }
        }));
        window.dispatchEvent(new CustomEvent('refresh-chat-list'));
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

    console.log(`[FRIEND-SERVICE] Declining friend request ID: ${requestId}`);
    let isUserError = false;
    try {
      const response = await fetch(`/api/friends/decline/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const resData = await response.json().catch(() => ({}));
      console.log(`[FRIEND-SERVICE] POST /api/friends/decline/${requestId} status: ${response.status}`, resData);

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          isUserError = true;
        }
        throw new Error(resData.error || 'Failed to decline connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Reject friend request API error:', err.message || err);
      if (isUserError) throw err;

      try {
        const { error: delErr } = await supabase.from('friend_requests').delete().eq('id', requestId);
        if (delErr) {
          console.error('[FRIEND-SERVICE] Supabase delete error in decline fallback:', delErr);
          throw delErr;
        }
      } catch (e) {
        throw err;
      }
    } finally {
      clearFriendsCache();
    }
  },

  /**
   * List all friends & pending requests of the current user
   */
  async getFriendList(userId: string): Promise<Friend[]> {
    if (!userId) return [];

    try {
      const response = await fetch('/api/friends/list');
      console.log(`[FRIEND-SERVICE] GET /api/friends/list status: ${response.status}`);
      if (response.ok) {
        const rawFriends = await response.json();
        return (rawFriends || []).map((f: any) => ({
          id: f.id,
          userId: f.user_id,
          friendId: f.friend_id || f.friend?.id,
          friendUsername: f.friend?.username || 'user',
          friendFullName: f.friend?.full_name || f.friend?.fullName || 'Zavr Friend',
          friendAvatar: getAvatarUrl(f.friend?.avatar_url || f.friend?.avatar, f.friend?.username || f.friend_id),
          status: f.status as 'pending' | 'accepted' | 'blocked',
          type: f.type as 'outgoing' | 'incoming',
          createdAt: f.created_at
        }));
      }
    } catch (err: any) {
      console.warn('[FRIEND-SERVICE] API getFriendList failed, trying direct Supabase fallback:', err.message || err);
    }

    // Direct Supabase fallback
    try {
      // 1. Fetch established friends from friends table ONLY
      const { data: rawFriends, error: frErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (frErr) console.error('[FRIEND-SERVICE] Supabase getFriendList friends error:', frErr);

      // 2. Fetch pending and accepted friend requests
      const { data: rawRequests, error: reqErr } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (reqErr) console.error('[FRIEND-SERVICE] Supabase getFriendList requests error:', reqErr);

      const establishedFromTable = rawFriends || [];
      const pending = (rawRequests || []).filter((r: any) => r.status === 'pending');
      const acceptedReqs = (rawRequests || []).filter((r: any) => r.status === 'accepted');

      // Map established friends from 'friends' table AND accepted friend requests
      const establishedMap = new Map<string, any>();
      establishedFromTable.forEach((f: any) => {
        const targetId = f.user_id === userId ? f.friend_id : f.user_id;
        if (targetId && targetId !== userId) establishedMap.set(targetId, f);
      });

      acceptedReqs.forEach((r: any) => {
        const targetId = r.sender_id === userId ? r.receiver_id : r.sender_id;
        if (targetId && targetId !== userId && !establishedMap.has(targetId)) {
          establishedMap.set(targetId, {
            id: r.id,
            user_id: userId,
            friend_id: targetId,
            created_at: r.created_at
          });
        }
      });
      const established = Array.from(establishedMap.values());

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
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', Array.from(targetUserIds));

        if (profErr) console.error('[FRIEND-SERVICE] Supabase profiles fetch error:', profErr);

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
          friendAvatar: getAvatarUrl(p?.avatar_url, p?.username || targetId),
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
          friendAvatar: getAvatarUrl(p?.avatar_url, p?.username || targetId),
          status: 'pending',
          type: isSender ? 'outgoing' : 'incoming',
          createdAt: r.created_at
        };
      });

      return [...mappedEstablished, ...mappedPending];
    } catch (e: any) {
      console.error('[FRIEND-SERVICE] getFriendList fallback error:', e.message || e);
      return [];
    }
  },

  /**
   * Remove/Delete a friendship connection
   */
  async removeFriend(friendId: string, currentUserId?: string): Promise<void> {
    if (!friendId) return;

    console.log(`[FRIEND-SERVICE] Removing friend connection with friendId: ${friendId}`);
    try {
      const response = await fetch(`/api/friends/remove/${friendId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const resData = await response.json().catch(() => ({}));
      console.log(`[FRIEND-SERVICE] DELETE /api/friends/remove/${friendId} status: ${response.status}`, resData);

      if (!response.ok) {
        throw new Error(resData.error || 'Failed to remove connection');
      }
    } catch (err: any) {
      console.error('[FRIEND-SERVICE] Remove friend failed, trying direct Supabase fallback:', err.message || err);
      try {
        if (currentUserId) {
          const { error: d1Err } = await supabase.from('friends').delete().or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`);
          if (d1Err) console.error('[FRIEND-SERVICE] Supabase delete friends error:', d1Err);

          const { error: d2Err } = await supabase.from('friend_requests').delete().or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`);
          if (d2Err) console.error('[FRIEND-SERVICE] Supabase delete requests error:', d2Err);
        } else {
          const { error: d3Err } = await supabase.from('friends').delete().eq('id', friendId);
          if (d3Err) console.error('[FRIEND-SERVICE] Supabase delete friend id error:', d3Err);
        }
      } catch (e) {
        throw err;
      }
    } finally {
      clearFriendsCache();
    }
  }
};

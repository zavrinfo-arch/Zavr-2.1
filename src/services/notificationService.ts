import { supabase } from '../lib/supabaseClient';
import { Notification } from '../types';

export const notificationService = {
  /**
   * Fetch all notifications for a given user
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    if (!userId) return [];
    
    // Accept standard or legacy notifications
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[NOTIFICATION-SERVICE] Get notifications error:', error);
      throw error;
    }

    return (data || []).map((n: any) => {
      let msg = n.body || n.message || '';
      let extractedData = null;
      const delimiter = " |||DATA:";
      if (msg.includes(delimiter)) {
        const parts = msg.split(delimiter);
        msg = parts[0];
        extractedData = parts[1];
      }
      return {
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: msg,
        type: n.type as any,
        read: n.read || false,
        timestamp: n.created_at || n.timestamp || new Date().toISOString(),
        data: extractedData || undefined
      };
    });
  },

  /**
   * Mark single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    if (!notificationId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[NOTIFICATION-SERVICE] Mark as read error:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications of a user as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);

    if (error) {
      console.error('[NOTIFICATION-SERVICE] Mark all as read error:', error);
      throw error;
    }
  },

  /**
   * Trigger manually from client
   */
  async triggerNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (!userId) return;

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    let message = body || '';
    if (data) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      message = `${message} |||DATA:${dataStr}`;
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        id: generateUUID(),
        user_id: userId,
        type,
        title,
        message: message, // Use the correct column name 'message'
        read: false
      });

    if (error) {
      console.error('[NOTIFICATION-SERVICE] Handle push notification failure:', error);
    }
  }
};

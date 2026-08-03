import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
export type StatusChangeListener = (status: ConnectionStatus, retryCount?: number) => void;

interface SubscriptionConfig {
  channelName: string;
  table?: string;
  schema?: string;
  event?: string;
  filter?: string;
  callback: (payload: any) => void;
}

class SupabaseRealtimeService {
  private status: ConnectionStatus = 'disconnected';
  private retryCount = 0;
  private maxRetries = 10;
  private retryTimeouts: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
  private retryTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private statusListeners: Set<StatusChangeListener> = new Set();
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptionsMap: Map<string, SubscriptionConfig> = new Map();
  private messageQueue: Array<() => void> = [];
  private isInitializing = false;

  constructor() {
    this.setupBrowserListeners();
  }

  /**
   * Listen to browser visibility and online/offline events
   */
  private setupBrowserListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('🔌 Network restored. Attempting auto-reconnect...');
      this.reconnect();
    });

    window.addEventListener('offline', () => {
      console.warn('⚠️ Network offline. Updating status to disconnected.');
      this.setStatus('disconnected');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab visible again. Checking WebSocket connection...');
        if (this.status === 'disconnected' || this.status === 'reconnecting') {
          this.reconnect();
        } else {
          this.ping();
        }
      }
    });
  }

  /**
   * Register a status change listener
   */
  public onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    // Immediately inform current status
    listener(this.status, this.retryCount);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Set status and notify all listeners
   */
  private setStatus(newStatus: ConnectionStatus) {
    if (this.status === newStatus && newStatus !== 'reconnecting') return;
    this.status = newStatus;
    console.log(`🔌 Connection status: ${newStatus} (Retry: ${this.retryCount}/${this.maxRetries})`);
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus, this.retryCount);
      } catch (err) {
        console.error('❌ Error in status listener:', err);
      }
    });
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Primary connection / initialization method
   */
  public async connect(): Promise<void> {
    if (this.status === 'connected' || this.isInitializing) return;
    this.isInitializing = true;
    this.setStatus(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    try {
      // Test basic connection / session
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      this.setStatus('connected');
      this.retryCount = 0;
      this.isInitializing = false;
      this.startHeartbeat();
      this.flushMessageQueue();
      this.resubscribeAll();
      console.log('✅ Supabase Realtime connected successfully!');
    } catch (err) {
      console.error('❌ Connection failed:', err);
      this.isInitializing = false;
      this.handleConnectionFailure();
    }
  }

  /**
   * Exponential backoff retry handler
   */
  private handleConnectionFailure() {
    if (this.retryCount >= this.maxRetries) {
      console.error('❌ Maximum reconnect attempts reached (10/10). Stopping auto-reconnect.');
      this.setStatus('disconnected');
      return;
    }

    this.retryCount++;
    this.setStatus('reconnecting');

    const delayIndex = Math.min(this.retryCount - 1, this.retryTimeouts.length - 1);
    const delay = this.retryTimeouts[delayIndex];

    console.log(`🔄 Reconnecting in ${delay / 1000}s (Attempt ${this.retryCount}/${this.maxRetries})...`);

    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Explicit user/app force reconnect
   */
  public async reconnect(): Promise<void> {
    console.log('🔄 Manual reconnect requested...');
    this.retryCount = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.disconnectAllChannels();
    await this.connect();
  }

  /**
   * Clean disconnect
   */
  public disconnect() {
    console.log('🔌 Disconnecting Realtime service...');
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.disconnectAllChannels();
    this.setStatus('disconnected');
  }

  /**
   * Heartbeat / Health check every 30 seconds
   */
  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, 30000);
  }

  private async ping() {
    if (this.status !== 'connected') return;
    try {
      // Lightweight auth check or query to verify socket/connection vitality
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
    } catch (err) {
      console.warn('⚠️ Health check ping failed. Initiating reconnection...');
      this.handleConnectionFailure();
    }
  }

  /**
   * Queue action when disconnected
   */
  public queueAction(action: () => void) {
    if (this.isConnected()) {
      action();
    } else {
      this.messageQueue.push(action);
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const action = this.messageQueue.shift();
      if (action) {
        try {
          action();
        } catch (e) {
          console.error('❌ Failed executing queued message:', e);
        }
      }
    }
  }

  /**
   * Subscribe to a specific realtime channel and store config for auto-resubscription
   */
  public subscribe(config: SubscriptionConfig): () => void {
    const key = `${config.channelName}:${config.table || '*'}:${config.event || '*'}`;
    this.subscriptionsMap.set(key, config);

    const setupChannel = () => {
      // Remove existing if any
      if (this.channels.has(key)) {
        supabase.removeChannel(this.channels.get(key)!);
      }

      const channel = supabase.channel(config.channelName);

      channel.on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table || '*',
          filter: config.filter,
        },
        (payload) => {
          config.callback(payload);
        }
      );

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Channel subscribed: ${config.channelName}`);
        } else if (status === 'CLOSED') {
          console.warn(`⚠️ Channel ${config.channelName} closed`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`⚠️ Channel ${config.channelName} state: ${status}`, err || '');
          // Do not break global realtime connection or enter infinite retry loop
        }
      });

      this.channels.set(key, channel);
    };

    if (this.isConnected()) {
      setupChannel();
    } else {
      this.queueAction(setupChannel);
    }

    // Return unsubscribe function
    return () => {
      this.subscriptionsMap.delete(key);
      const existing = this.channels.get(key);
      if (existing) {
        supabase.removeChannel(existing);
        this.channels.delete(key);
      }
    };
  }

  /**
   * Resubscribe all registered configs on reconnect
   */
  private resubscribeAll() {
    this.subscriptionsMap.forEach((config, key) => {
      if (this.channels.has(key)) {
        supabase.removeChannel(this.channels.get(key)!);
        this.channels.delete(key);
      }

      const channel = supabase.channel(config.channelName);
      channel.on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table || '*',
          filter: config.filter,
        },
        (payload) => config.callback(payload)
      );

      channel.subscribe();
      this.channels.set(key, channel);
    });
  }

  private disconnectAllChannels() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const supabaseRealtimeService = new SupabaseRealtimeService();
export const supabaseRealtime = supabaseRealtimeService;

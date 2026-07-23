import { useState, useEffect, useCallback } from 'react';
import { supabaseRealtimeService, ConnectionStatus } from '../services/supabaseRealtime';

export function useSupabaseStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(supabaseRealtimeService.getStatus());
  const [retryCount, setRetryCount] = useState<number>(supabaseRealtimeService.getRetryCount());

  useEffect(() => {
    const unsubscribe = supabaseRealtimeService.onStatusChange((newStatus, currentRetry) => {
      setStatus(newStatus);
      if (currentRetry !== undefined) {
        setRetryCount(currentRetry);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const reconnect = useCallback(async () => {
    await supabaseRealtimeService.reconnect();
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    retryCount,
    reconnect,
  };
}

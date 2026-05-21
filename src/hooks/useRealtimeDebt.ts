import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { shouldDisableHeavyFeatures } from '../utils/previewFix';

/**
 * Custom React hook to subscribe to real-time changes on debt and personal zettls.
 * Triggers a provided callback function when inserts, updates, or deletes occur.
 */
export function useRealtimeDebt(onUpdate?: () => void) {
  useEffect(() => {
    if (!onUpdate) return;

    if (shouldDisableHeavyFeatures()) {
      console.info('[PREVIEW] Bypassing debt hook real-time subscribe channels in preview mode.');
      return;
    }

    const channel = supabase
      .channel('zettl-realtime-debts-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personal_zettls'
        },
        (payload) => {
          console.log('[REALTIME-HOOK] Personal Zettls row change intercepted:', {
            eventType: payload.eventType,
            newRow: payload.new,
            oldRow: payload.old
          });
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends'
        },
        (payload) => {
          console.log('[REALTIME-HOOK] Connections status row change intercepted.');
          onUpdate();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[REALTIME-HOOK] Successfully connected to postgres real-time ledger channels.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
export default useRealtimeDebt;

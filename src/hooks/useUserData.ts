import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as queries from '../utils/supabaseQueries';

export function useUserData() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [soloGoals, setSoloGoals] = useState<any[]>([]);
  const [emergencyGoals, setEmergencyGoals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);

  const fetchAllUserData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      console.log(`[USER-DATA-HOOK] Fetching isolated data for user: ${uid}`);
      
      const [
        soloRes,
        emergencyRes,
        transactionsRes,
        notificationsRes,
        debtsRes
      ] = await Promise.all([
        queries.getSoloGoals(uid),
        queries.getEmergencyGoals(uid),
        queries.getTransactions(uid),
        queries.getNotifications(uid),
        queries.getDebts(uid)
      ]);

      if (soloRes.error) console.error('[GET-SOLO-ERR]', soloRes.error.message);
      if (emergencyRes.error) console.error('[GET-EMERGENCY-ERR]', emergencyRes.error.message);
      if (transactionsRes.error) console.error('[GET-TX-ERR]', transactionsRes.error.message);
      if (notificationsRes.error) console.error('[GET-NOTIF-ERR]', notificationsRes.error.message);
      if (debtsRes.error) console.error('[GET-DEBTS-ERR]', debtsRes.error.message);

      setSoloGoals(soloRes.data || []);
      setEmergencyGoals(emergencyRes.data || []);
      setTransactions(transactionsRes.data || []);
      setNotifications(notificationsRes.data || []);
      setDebts(debtsRes.data || []);
    } catch (error) {
      console.error('[USER-DATA-HOOK] Unexpected error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAllDataState = useCallback(() => {
    console.log('[USER-DATA-HOOK] Sweeping cached state elements on logout');
    setSoloGoals([]);
    setEmergencyGoals([]);
    setTransactions([]);
    setNotifications([]);
    setDebts([]);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchAllUserData(userId);
    } else {
      clearAllDataState();
    }
  }, [userId, fetchAllUserData, clearAllDataState]);

  const refresh = useCallback(() => {
    if (userId) {
      fetchAllUserData(userId);
    } else {
      clearAllDataState();
    }
  }, [userId, fetchAllUserData, clearAllDataState]);

  return {
    soloGoals,
    emergencyGoals,
    transactions,
    notifications,
    debts,
    loading,
    refresh
  };
}

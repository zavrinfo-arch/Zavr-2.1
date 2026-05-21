import { supabase } from '../lib/supabaseClient';

/**
 * Gets the currently authenticated user's ID.
 */
export async function getCurrentUser(): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }
  return user?.id || null;
}

/**
 * Gets solo goals filtered by the authenticated user's ID.
 */
export async function getSoloGoals(userId: string) {
  return await supabase
    .from('solo_goals')
    .select('*')
    .eq('user_id', userId);
}

/**
 * Gets emergency goals filtered by the authenticated user's ID.
 */
export async function getEmergencyGoals(userId: string) {
  return await supabase
    .from('emergency_goals')
    .select('*')
    .eq('user_id', userId);
}

/**
 * Gets transactions filtered by the authenticated user's ID.
 */
export async function getTransactions(userId: string) {
  return await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId);
}

/**
 * Gets notifications filtered by the authenticated user's ID.
 */
export async function getNotifications(userId: string) {
  return await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });
}

/**
 * Gets debts filtered by the authenticated user's ID.
 */
export async function getDebts(userId: string) {
  return await supabase
    .from('debts')
    .select('*')
    .or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`);
}

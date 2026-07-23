import { supabase } from '../lib/supabaseClient';
import { 
  Debt, Debit, Debitor, 
  CreateDebtData, CreateDebitData, CreateDebitorData, 
  DebtFilters, DebitFilters, PersonalZettl, Currency 
} from '../types/index';

/**
 * Retry helper with exponential backoff for Supabase calls
 */
async function executeWithRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      attempt++;
      if (attempt > 1) {
        console.log(`🔄 [DEBT-SERVICE] ${operationName} - Attempt ${attempt}/${maxRetries}...`);
      }
      return await fn();
    } catch (err: any) {
      if (attempt >= maxRetries) {
        console.error(`❌ [DEBT-SERVICE] ${operationName} failed after ${maxRetries} attempts:`, err);
        throw err;
      }
      const backoff = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`⚠️ [DEBT-SERVICE] ${operationName} error (attempt ${attempt}). Retrying in ${backoff}ms...`, err);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
  throw new Error(`[DEBT-SERVICE] ${operationName} failed unexpectedly`);
}

/**
 * Service to manage Debitors, Debts (money owed to user), and Debits (money user owes)
 */
export const debtService = {
  // ==========================================
  // DEBITORS CRUD OPERATIONS
  // ==========================================

  /**
   * Get all debitors created by or associated with a user
   */
  async getDebitors(userId: string): Promise<Debitor[]> {
    console.log(`💰 [DEBT-SERVICE] Fetching debitors for user: ${userId}`);
    return executeWithRetry('getDebitors', async () => {
      const { data, error } = await supabase
        .from('debitors')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ [DEBT-SERVICE] Failed to fetch debitors:', error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Successfully retrieved ${data?.length || 0} debitors`);
      return (data as Debitor[]) || [];
    });
  },

  /**
   * Find a debitor by exact or case-insensitive name for a user
   */
  async getDebtorByName(userId: string, name: string): Promise<Debitor | null> {
    console.log(`💰 [DEBT-SERVICE] Searching debitor by name "${name}" for user: ${userId}`);
    return executeWithRetry('getDebtorByName', async () => {
      const { data, error } = await supabase
        .from('debitors')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', name.trim())
        .maybeSingle();

      if (error) {
        console.error('❌ [DEBT-SERVICE] Error finding debitor by name:', error);
        throw error;
      }

      if (data) {
        console.log(`✅ [DEBT-SERVICE] Debitor found: ${data.name} (${data.id})`);
      } else {
        console.log(`⚠️ [DEBT-SERVICE] No debitor found with name "${name}"`);
      }

      return (data as Debitor) || null;
    });
  },

  /**
   * Create a new debitor for a user
   */
  async createDebitor(data: CreateDebitorData, userId: string): Promise<Debitor> {
    console.log(`💰 [DEBT-SERVICE] Creating debitor "${data.name}" for user: ${userId}`);
    return executeWithRetry('createDebitor', async () => {
      // Check if already exists
      const existing = await this.getDebtorByName(userId, data.name);
      if (existing) {
        console.log(`ℹ️ [DEBT-SERVICE] Debitor "${data.name}" already exists (${existing.id})`);
        return existing;
      }

      const payload = {
        user_id: userId,
        name: data.name.trim(),
        email: data.email || null,
        phone: data.phone || null,
        avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(data.name)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error } = await supabase
        .from('debitors')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('❌ [DEBT-SERVICE] Create debitor failed:', error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debitor created successfully: ${created.id}`);
      return created as Debitor;
    });
  },

  // ==========================================
  // DEBTS CRUD OPERATIONS (User as Creditor)
  // ==========================================

  /**
   * Create a new Debt entry (Money owed to the user)
   */
  async createDebt(data: CreateDebtData, userId: string): Promise<Debt> {
    console.log(`💰 [DEBT-SERVICE] Creating Debt of ₹${data.amount} for user: ${userId}`);
    return executeWithRetry('createDebt', async () => {
      const payload = {
        user_id: userId,
        debitor_id: data.debitor_id || null,
        creditor_id: data.creditor_id || userId,
        amount: Math.round(data.amount * 100) / 100,
        purpose: data.purpose || 'General Debt',
        description: data.description || null,
        due_date: data.due_date || null,
        settled: false,
        status: data.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error } = await supabase
        .from('debts')
        .insert(payload)
        .select('*, debitor:debitors(*)')
        .single();

      if (error) {
        console.error('❌ [DEBT-SERVICE] Create debt failed:', error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debt created successfully with ID: ${created.id}`);
      return created as Debt;
    });
  },

  /**
   * Get all debts for a user with optional filtering
   */
  async getDebts(userId: string, filters?: DebtFilters): Promise<Debt[]> {
    console.log(`💰 [DEBT-SERVICE] Fetching debts for user: ${userId}`, filters || '');
    return executeWithRetry('getDebts', async () => {
      let query = supabase
        .from('debts')
        .select('*, debitor:debitors(*)')
        .or(`user_id.eq.${userId},creditor_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.debitor_id) {
        query = query.eq('debitor_id', filters.debitor_id);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [DEBT-SERVICE] Failed to fetch debts:', error);
        throw error;
      }

      let results = (data as Debt[]) || [];

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(
          (d) =>
            d.purpose?.toLowerCase().includes(searchLower) ||
            d.description?.toLowerCase().includes(searchLower) ||
            d.debitor?.name?.toLowerCase().includes(searchLower)
        );
      }

      console.log(`✅ [DEBT-SERVICE] Retrieved ${results.length} debts`);
      return results;
    });
  },

  /**
   * Get single debt by ID
   */
  async getDebtById(debtId: string): Promise<Debt> {
    console.log(`💰 [DEBT-SERVICE] Fetching debt ID: ${debtId}`);
    return executeWithRetry('getDebtById', async () => {
      const { data, error } = await supabase
        .from('debts')
        .select('*, debitor:debitors(*)')
        .eq('id', debtId)
        .single();

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to get debt ${debtId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Retrieved debt ${debtId}`);
      return data as Debt;
    });
  },

  /**
   * Update an existing debt
   */
  async updateDebt(debtId: string, updates: Partial<Debt>): Promise<Debt> {
    console.log(`💰 [DEBT-SERVICE] Updating debt ${debtId}`, updates);
    return executeWithRetry('updateDebt', async () => {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('debts')
        .update(payload)
        .eq('id', debtId)
        .select('*, debitor:debitors(*)')
        .single();

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to update debt ${debtId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debt ${debtId} updated successfully`);
      return data as Debt;
    });
  },

  /**
   * Mark a debt as settled
   */
  async settleDebt(debtId: string): Promise<Debt> {
    console.log(`💰 [DEBT-SERVICE] Settling debt ${debtId}`);
    return this.updateDebt(debtId, {
      settled: true,
      settled_at: new Date().toISOString(),
      status: 'settled'
    });
  },

  /**
   * Delete a debt
   */
  async deleteDebt(debtId: string): Promise<void> {
    console.log(`💰 [DEBT-SERVICE] Deleting debt ${debtId}`);
    return executeWithRetry('deleteDebt', async () => {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', debtId);

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to delete debt ${debtId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debt ${debtId} deleted successfully`);
    });
  },

  // ==========================================
  // DEBITS CRUD OPERATIONS (User as Debtor)
  // ==========================================

  /**
   * Create a new Debit entry (Money user owes)
   */
  async createDebit(data: CreateDebitData, userId: string): Promise<Debit> {
    console.log(`💰 [DEBT-SERVICE] Creating Debit of ₹${data.amount} for user: ${userId}`);
    return executeWithRetry('createDebit', async () => {
      const payload = {
        user_id: userId,
        debitor_id: data.debitor_id || null,
        creditor_id: data.creditor_id || null,
        amount: Math.round(data.amount * 100) / 100,
        description: data.description || 'General Debit',
        due_date: data.due_date || null,
        settled: false,
        status: data.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error } = await supabase
        .from('debits')
        .insert(payload)
        .select('*, debitor:debitors(*)')
        .single();

      if (error) {
        console.error('❌ [DEBT-SERVICE] Create debit failed:', error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debit created successfully with ID: ${created.id}`);
      return created as Debit;
    });
  },

  /**
   * Get all debits for a user with optional filtering
   */
  async getDebits(userId: string, filters?: DebitFilters): Promise<Debit[]> {
    console.log(`💰 [DEBT-SERVICE] Fetching debits for user: ${userId}`, filters || '');
    return executeWithRetry('getDebits', async () => {
      let query = supabase
        .from('debits')
        .select('*, debitor:debitors(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.debitor_id) {
        query = query.eq('debitor_id', filters.debitor_id);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [DEBT-SERVICE] Failed to fetch debits:', error);
        throw error;
      }

      let results = (data as Debit[]) || [];

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(
          (d) =>
            d.description?.toLowerCase().includes(searchLower) ||
            d.debitor?.name?.toLowerCase().includes(searchLower)
        );
      }

      console.log(`✅ [DEBT-SERVICE] Retrieved ${results.length} debits`);
      return results;
    });
  },

  /**
   * Get single debit by ID
   */
  async getDebitById(debitId: string): Promise<Debit> {
    console.log(`💰 [DEBT-SERVICE] Fetching debit ID: ${debitId}`);
    return executeWithRetry('getDebitById', async () => {
      const { data, error } = await supabase
        .from('debits')
        .select('*, debitor:debitors(*)')
        .eq('id', debitId)
        .single();

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to get debit ${debitId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Retrieved debit ${debitId}`);
      return data as Debit;
    });
  },

  /**
   * Update an existing debit
   */
  async updateDebit(debitId: string, updates: Partial<Debit>): Promise<Debit> {
    console.log(`💰 [DEBT-SERVICE] Updating debit ${debitId}`, updates);
    return executeWithRetry('updateDebit', async () => {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('debits')
        .update(payload)
        .eq('id', debitId)
        .select('*, debitor:debitors(*)')
        .single();

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to update debit ${debitId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debit ${debitId} updated successfully`);
      return data as Debit;
    });
  },

  /**
   * Mark a debit as settled
   */
  async settleDebit(debitId: string): Promise<Debit> {
    console.log(`💰 [DEBT-SERVICE] Settling debit ${debitId}`);
    return this.updateDebit(debitId, {
      settled: true,
      settled_at: new Date().toISOString(),
      status: 'settled'
    });
  },

  /**
   * Delete a debit
   */
  async deleteDebit(debitId: string): Promise<void> {
    console.log(`💰 [DEBT-SERVICE] Deleting debit ${debitId}`);
    return executeWithRetry('deleteDebit', async () => {
      const { error } = await supabase
        .from('debits')
        .delete()
        .eq('id', debitId);

      if (error) {
        console.error(`❌ [DEBT-SERVICE] Failed to delete debit ${debitId}:`, error);
        throw error;
      }

      console.log(`✅ [DEBT-SERVICE] Debit ${debitId} deleted successfully`);
    });
  },

  // ==========================================
  // BACKWARD COMPATIBILITY HELPER METHODS
  // ==========================================

  /**
   * Legacy method: Request money from a friend
   */
  async requestMoney(
    creditorId: string,
    debtorId: string,
    amount: number,
    note: string,
    dueDate?: string
  ): Promise<PersonalZettl> {
    console.log(`💰 [DEBT-SERVICE] Legacy requestMoney called: ${creditorId} -> ${debtorId}`);
    
    // First, attempt to create in new `debts` table
    try {
      let debitorRecord = await this.getDebtorByName(creditorId, 'Friend');
      if (!debitorRecord) {
        debitorRecord = await this.createDebitor({ name: 'Friend' }, creditorId);
      }

      await this.createDebt({
        debitor_id: debitorRecord.id,
        creditor_id: creditorId,
        amount,
        purpose: note,
        description: note,
        due_date: dueDate || null
      }, creditorId);
    } catch (e) {
      console.warn('⚠️ [DEBT-SERVICE] Error creating entry in debts table during legacy requestMoney:', e);
    }

    // Also insert into personal_zettls for legacy channels
    const { data: requestData, error } = await supabase
      .from('personal_zettls')
      .insert({
        from_user_id: debtorId,
        to_user_id: creditorId,
        amount: Math.round(amount),
        currency: 'INR',
        note,
        due_date: dueDate || null,
        is_settled: false,
        message: `/request ${amount} for ${note}`
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ [DEBT-SERVICE] Legacy requestMoney personal_zettls failed:', error);
    }

    return {
      id: requestData?.id || 'temp-' + Date.now(),
      fromUserId: debtorId,
      toUserId: creditorId,
      fromUsername: '',
      toUsername: '',
      amount: amount,
      currency: 'INR',
      note: note,
      createdAt: new Date().toISOString(),
      dueDate: dueDate,
      isSettled: false,
      reminderCount: 0
    };
  },

  /**
   * Legacy method: Pay/Settle a debt
   */
  async payDebt(debtId: string, currentUserId: string): Promise<void> {
    console.log(`💰 [DEBT-SERVICE] Legacy payDebt called for debtId: ${debtId}`);
    try {
      await this.settleDebt(debtId);
    } catch (e) {
      console.warn(`⚠️ [DEBT-SERVICE] Settle debt in main debts table failed, trying personal_zettls:`, e);
      await supabase
        .from('personal_zettls')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString()
        })
        .eq('id', debtId);
    }
  },

  /**
   * Send payment reminder / nudge
   */
  async sendReminder(debtId: string, senderUserId: string): Promise<void> {
    console.log(`💰 [DEBT-SERVICE] Sending reminder for debtId: ${debtId}`);
    try {
      const debt = await this.getDebtById(debtId);
      if (debt) {
        console.log(`✅ [DEBT-SERVICE] Reminder logged for debt ${debtId}`);
      }
    } catch (e) {
      console.warn('⚠️ [DEBT-SERVICE] Send reminder fallback:', e);
    }
  },

  /**
   * Calculate total balances (Owed to me vs I owe)
   */
  async getBalances(userId: string) {
    console.log(`💰 [DEBT-SERVICE] Calculating net balances for user: ${userId}`);
    try {
      const [debts, debits] = await Promise.all([
        this.getDebts(userId, { status: 'active' }),
        this.getDebits(userId, { status: 'active' })
      ]);

      const totalOwedToMe = debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const totalIOwe = debits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const netBalance = totalOwedToMe - totalIOwe;

      console.log(`✅ [DEBT-SERVICE] Balances: OwedToMe=${totalOwedToMe}, IOwe=${totalIOwe}, Net=${netBalance}`);
      return { totalOwedToMe, totalIOwe, netBalance };
    } catch (err) {
      console.error('❌ [DEBT-SERVICE] Failed to calculate balances from new tables, attempting fallback:', err);
      return { totalOwedToMe: 0, totalIOwe: 0, netBalance: 0 };
    }
  },

  /**
   * Legacy method: Get pending requests
   */
  async getPendingRequests(userId: string) {
    const debits = await this.getDebits(userId, { status: 'active' });
    return debits;
  },

  /**
   * Legacy method: Get active debts requested BY me
   */
  async getActiveDebtsRequestedByMe(userId: string) {
    const debts = await this.getDebts(userId, { status: 'active' });
    return debts;
  },

  /**
   * Legacy method: Get friend balances breakdown
   */
  async getFriendBalances(userId: string) {
    try {
      const debts = await this.getDebts(userId, { status: 'active' });
      const debits = await this.getDebits(userId, { status: 'active' });

      const balancesMap = new Map<string, { name: string; avatar: string; owesMe: number; iOweThem: number }>();

      debts.forEach((d) => {
        const name = d.debitor?.name || 'Friend';
        const avatar = d.debitor?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${name}`;
        const key = d.debitor_id || name;
        const base = balancesMap.get(key) || { name, avatar, owesMe: 0, iOweThem: 0 };
        base.owesMe += Number(d.amount);
        balancesMap.set(key, base);
      });

      debits.forEach((d) => {
        const name = d.debitor?.name || 'Friend';
        const avatar = d.debitor?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${name}`;
        const key = d.debitor_id || name;
        const base = balancesMap.get(key) || { name, avatar, owesMe: 0, iOweThem: 0 };
        base.iOweThem += Number(d.amount);
        balancesMap.set(key, base);
      });

      const list: any[] = [];
      balancesMap.forEach((val, key) => {
        const net = val.owesMe - val.iOweThem;
        if (net !== 0) {
          list.push({
            friendId: key,
            username: val.name.toLowerCase().replace(/\s+/g, '_'),
            fullName: val.name,
            avatar: val.avatar,
            netAmount: net,
            description: net > 0 ? `owes you ₹${net}` : `You owe ₹${Math.abs(net)}`
          });
        }
      });

      return list.slice(0, 5);
    } catch (err) {
      console.warn('⚠️ [DEBT-SERVICE] getFriendBalances warning:', err);
      return [];
    }
  }
};

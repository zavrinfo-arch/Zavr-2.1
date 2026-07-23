/**
 * @file src/types/index.ts
 * @description Central TypeScript types and interfaces for Zettl finance app,
 * matching Supabase schema for debitors, debts, and debits tables.
 */

// Re-export all root domain types
export * from '../types';

/**
 * Represents a Debitor entity from the `debitors` table in Supabase.
 * A Debitor is a person/contact associated with debts or debits.
 */
export interface Debitor {
  /** Unique UUID identifier */
  id: string;
  /** UUID of the owning profile/user */
  user_id: string;
  /** Full name of the debitor */
  name: string;
  /** Optional contact email address */
  email?: string | null;
  /** Optional phone number */
  phone?: string | null;
  /** Optional profile picture URL */
  avatar_url?: string | null;
  /** ISO timestamp string when record was created */
  created_at: string;
  /** ISO timestamp string when record was last updated */
  updated_at: string;
}

/**
 * Represents a Debt entity from the `debts` table in Supabase.
 * A Debt records money owed to a user (creditor) by a debitor/borrower.
 */
export interface Debt {
  /** Unique UUID identifier */
  id: string;
  /** UUID of the owning user */
  user_id: string;
  /** Foreign key to debitors table */
  debitor_id?: string | null;
  /** Foreign key to profiles table (creditor) */
  creditor_id?: string | null;
  /** Monetary amount (DECIMAL 10,2) */
  amount: number;
  /** Short tag or category purpose for the debt (e.g., 'Dinner', 'Rent') */
  purpose?: string | null;
  /** Detailed description or notes for the debt */
  description?: string | null;
  /** Target due date string (YYYY-MM-DD) */
  due_date?: string | null;
  /** True if the debt has been fully settled */
  settled: boolean;
  /** ISO timestamp string when debt was settled */
  settled_at?: string | null;
  /** Status flag: 'active' | 'settled' | 'cancelled' | 'overdue' */
  status: 'active' | 'settled' | 'cancelled' | 'overdue';
  /** ISO timestamp string when record was created */
  created_at: string;
  /** ISO timestamp string when record was last updated */
  updated_at: string;

  /** Joined debitor record if fetched with join */
  debitor?: Debitor | null;
}

/**
 * Represents a Debit entity from the `debits` table in Supabase.
 * A Debit records money owed BY a user (debtor) to a creditor.
 */
export interface Debit {
  /** Unique UUID identifier */
  id: string;
  /** UUID of the owning user */
  user_id: string;
  /** Foreign key to debitors table */
  debitor_id?: string | null;
  /** Foreign key to profiles table (creditor) */
  creditor_id?: string | null;
  /** Monetary amount (DECIMAL 10,2) */
  amount: number;
  /** Detailed description or notes for the debit */
  description?: string | null;
  /** Target due date string (YYYY-MM-DD) */
  due_date?: string | null;
  /** True if the debit has been fully settled */
  settled: boolean;
  /** ISO timestamp string when debit was settled */
  settled_at?: string | null;
  /** Status flag: 'active' | 'settled' | 'cancelled' | 'overdue' */
  status: 'active' | 'settled' | 'cancelled' | 'overdue';
  /** ISO timestamp string when record was created */
  created_at: string;
  /** ISO timestamp string when record was last updated */
  updated_at: string;

  /** Joined debitor record if fetched with join */
  debitor?: Debitor | null;
}

/**
 * Payload interface for creating a new Debitor record.
 */
export interface CreateDebitorData {
  /** Debitor full name */
  name: string;
  /** Optional email */
  email?: string;
  /** Optional phone number */
  phone?: string;
  /** Optional avatar URL */
  avatar_url?: string;
}

/**
 * Payload interface for creating a new Debt record.
 */
export interface CreateDebtData {
  /** Foreign key to debitors table */
  debitor_id?: string | null;
  /** Foreign key to creditor profile */
  creditor_id?: string | null;
  /** Monetary amount */
  amount: number;
  /** Short tag or category purpose */
  purpose?: string;
  /** Extended description/note */
  description?: string;
  /** Target payment due date */
  due_date?: string | null;
  /** Status override ('active' by default) */
  status?: 'active' | 'settled' | 'cancelled' | 'overdue';
}

/**
 * Payload interface for creating a new Debit record.
 */
export interface CreateDebitData {
  /** Foreign key to debitors table */
  debitor_id?: string | null;
  /** Foreign key to creditor profile */
  creditor_id?: string | null;
  /** Monetary amount */
  amount: number;
  /** Extended description/note */
  description?: string;
  /** Target payment due date */
  due_date?: string | null;
  /** Status override ('active' by default) */
  status?: 'active' | 'settled' | 'cancelled' | 'overdue';
}

/**
 * Filter criteria for querying debts.
 */
export interface DebtFilters {
  /** Status filter */
  status?: 'active' | 'settled' | 'cancelled' | 'overdue';
  /** Debitor ID filter */
  debitor_id?: string;
  /** Start creation or due date */
  startDate?: string;
  /** End creation or due date */
  endDate?: string;
  /** Search string matching purpose or description */
  search?: string;
}

/**
 * Filter criteria for querying debits.
 */
export interface DebitFilters {
  /** Status filter */
  status?: 'active' | 'settled' | 'cancelled' | 'overdue';
  /** Debitor ID filter */
  debitor_id?: string;
  /** Start creation or due date */
  startDate?: string;
  /** End creation or due date */
  endDate?: string;
  /** Search string matching description */
  search?: string;
}

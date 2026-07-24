export interface ChatUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  balance: number; // positive = owes me, negative = I owe them
  is_online?: boolean;
  last_seen?: string;
}

export type DebtCategory = 'Food' | 'Travel' | 'Shopping' | 'Fuel' | 'Entertainment' | 'Medical' | 'Other';
export type SplitType = 'Full' | 'Half' | 'Custom';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';

export interface ChatMessage {
  id: string;
  type: 'request' | 'payment' | 'text' | 'system';
  direction: 'incoming' | 'outgoing' | 'system';
  amount?: number;
  purpose?: string;
  category?: DebtCategory;
  split_type?: SplitType;
  due_date?: string;
  status: 'pending' | 'paid' | 'overdue';
  message?: string;
  created_at: string;
  read: boolean;
  friend_id: string;
  friend_name: string;
  debt_id?: string;
  reactions?: Record<string, string[]>; // emoji -> user_ids
  is_pinned?: boolean;
  media_url?: string;
  media_type?: 'image' | 'voice' | 'file';
  voice_duration?: number;
  delivery_status?: 'sending' | 'sent' | 'delivered' | 'read';
  reply_to?: {
    id: string;
    text: string;
    sender: string;
  };
}

export interface SettlementHistoryItem {
  id: string;
  friend_id: string;
  amount: number;
  payment_method: PaymentMethod;
  date: string;
  memo?: string;
  receipt_url?: string;
}

export interface ChatListItem {
  friend_id: string;
  friend_name: string;
  friend_avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  net_balance: number; // positive = friend owes me, negative = I owe friend
  is_online?: boolean;
}

export interface CreateRequestData {
  friend_id: string;
  amount: number;
  purpose: string;
  category?: DebtCategory;
  split_type?: SplitType;
  due_date?: string | null;
}

export interface CreatePaymentData {
  friend_id: string;
  amount: number;
  purpose: string;
  payment_method?: PaymentMethod;
  debt_id?: string;
}

export interface CreateAmountData {
  friend_id: string;
  amount: number;
  description: string;
  who_paid: 'me' | 'friend';
  split_type: SplitType;
  category: DebtCategory;
  custom_amount?: number;
}


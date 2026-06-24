export interface ChatUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  balance: number; // positive = owes me, negative = I owe them
}

export interface ChatMessage {
  id: string;
  type: 'request' | 'payment' | 'text';
  direction: 'incoming' | 'outgoing';
  amount?: number;
  purpose?: string;
  due_date?: string;
  status: 'pending' | 'paid' | 'overdue';
  message?: string;
  created_at: string;
  read: boolean;
  friend_id: string;
  friend_name: string;
  debt_id?: string;
}

export interface ChatListItem {
  friend_id: string;
  friend_name: string;
  friend_avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  net_balance: number; // positive = friend owes me, negative = I owe friend
}

export interface CreateRequestData {
  friend_id: string;
  amount: number;
  purpose: string;
  due_date?: string | null;
}

export interface CreatePaymentData {
  friend_id: string;
  amount: number;
  purpose: string;
  debt_id?: string;
}

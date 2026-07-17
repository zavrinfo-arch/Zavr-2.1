import React from 'react';
import { ChatListItem as ChatListItemType } from '../../types/zettl.types';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface ChatListItemProps {
  item: ChatListItemType;
  onClick: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ item, onClick }) => {
  const owesMe = item.net_balance > 0;
  const iOweThem = item.net_balance < 0;
  const isSettled = item.net_balance === 0;

  // Pretty absolute amount
  const absAmount = Math.abs(item.net_balance);

  // Time formatter
  let friendlyTime = 'Active';
  try {
    if (item.last_message_time) {
      friendlyTime = formatDistanceToNow(parseISO(item.last_message_time), { addSuffix: true })
        .replace('about', '')
        .replace('less than a minute ago', 'Just now');
    }
  } catch (e) {
    // Ignore formatting errors
  }

  // Truncate long notes nicely
  const truncate = (text: string, count: number) => {
    if (!text) return '';
    return text.length > count ? text.substring(0, count) + '...' : text;
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 p-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all cursor-pointer border-b last:border-b-0 border-black/[0.06] dark:border-white/[0.06] select-none ${
        item.unread_count > 0 ? 'bg-[#FF6B6B]/5 dark:bg-[#FF7C7C]/5' : ''
      }`}
    >
      {/* Avatar Container with glowing border if unread */}
      <div className="relative shrink-0">
        <img
          src={item.friend_avatar}
          alt={item.friend_name}
          className={`w-12 h-12 rounded-full object-cover border-2 ${
            item.unread_count > 0 ? 'border-[#FF6B6B] dark:border-[#FF7C7C] scale-[1.05] shadow-md shadow-[rgba(255,107,107,0.15)]' : 'border-black/[0.08] dark:border-white/[0.08]'
          }`}
          referrerPolicy="no-referrer"
        />
        {/* Mocking online status dot */}
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#111118] rounded-full" />
      </div>

      {/* Main Metadata Grid */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-zinc-900 dark:text-white truncate text-sm">
            {item.friend_name}
          </h4>
          <span className="text-[10px] text-zinc-400 dark:text-white/40 font-mono shrink-0">
            {friendlyTime}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Truncated message text */}
          <p className={`text-xs truncate max-w-[180px] sm:max-w-xs ${
            item.unread_count > 0 ? 'font-black text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-white/60'
          }`}>
            {truncate(item.last_message, 45)}
          </p>

          {/* Outstanding Balance Badges */}
          <div className="shrink-0 text-right">
            {owesMe && (
              <span className="text-[11px] font-black tracking-wide text-emerald-500">
                Owes you ₹{absAmount}
              </span>
            )}
            {iOweThem && (
              <span className="text-[11px] font-black tracking-wide text-[#FF6B6B]">
                You owe ₹{absAmount}
              </span>
            )}
            {isSettled && (
              <span className="text-[10px] font-bold tracking-wide text-zinc-400 dark:text-white/30 uppercase">
                Settled ✓
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Unread circle badge indicator */}
      {item.unread_count > 0 && (
        <span className="w-5 h-5 rounded-full bg-[#FF6B6B] dark:bg-[#FF7C7C] text-white flex items-center justify-center font-extrabold text-[10px] scale-95 shrink-0 shadow-lg shadow-[rgba(255,107,107,0.35)]">
          {item.unread_count}
        </span>
      )}
    </div>
  );
};

export default ChatListItem;

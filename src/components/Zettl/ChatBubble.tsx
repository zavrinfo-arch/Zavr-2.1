import React from 'react';
import { ChatMessage } from '../../types/zettl.types';
import { Clock, Calendar, CheckSquare, BellRing, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface ChatBubbleProps {
  message: ChatMessage;
  onPayNow: (debtId: string, amount: number, purpose: string) => void;
  onRemind: (debtId: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onPayNow, onRemind }) => {
  const isMyMessage = message.direction === 'outgoing';
  const isRequest = message.type === 'request';
  const isPayment = message.type === 'payment';
  const isPending = message.status === 'pending';

  // Format timestamp (HH:MM AM/PM)
  let formattedTime = '';
  try {
    formattedTime = format(new Date(message.created_at), 'hh:mm a');
  } catch (e) {
    formattedTime = '12:00 PM';
  }

  // Check if is receipt url (contains a mock/real storage URL)
  const hasReceiptUrl = message.message?.startsWith('http') || message.message?.includes('/storage/');

  return (
    <div id={`chat-bubble-${message.id}`} className={`flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'} mb-3 px-1 md:px-3`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 px-4 shadow-sm relative transition-shadow ${
          isMyMessage
            ? 'bg-purple-600 text-white rounded-tr-none'
            : 'bg-surface-light text-foreground rounded-tl-none border border-border'
        }`}
      >
        {/* Core content handler depending on type */}
        {isRequest ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-white/10 pb-1.5">
              <span className="p-1 rounded-lg bg-pink-500/20 text-pink-300 text-[10px] uppercase font-black tracking-wider">
                Request
              </span>
              <span className={`text-[10px] font-medium ${isMyMessage ? 'text-purple-200' : 'text-foreground/50'}`}>
                {isMyMessage ? 'You requested' : `@${message.friend_name} requested`}
              </span>
            </div>

            <div className="flex items-baseline gap-1 py-1">
              <span className="text-xl sm:text-2xl font-black font-sans">
                ₹{message.amount}
              </span>
              <span className={`text-xs ${isMyMessage ? 'text-purple-200' : 'text-foreground/50'}`}>
                INR
              </span>
            </div>

            <p className="text-xs break-words italic opacity-90">
              "{message.purpose}"
            </p>

            {message.due_date && (
              <div className="flex items-center gap-1.5 text-[10px] opacity-75">
                <Calendar size={11} />
                <span>Due: {format(new Date(message.due_date), 'dd MMM yyyy')}</span>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-white/5">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold">
                {isPending ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <Clock size={11} /> Pending
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckSquare size={11} /> Settle Active
                  </span>
                )}
              </div>

              {isPending && (
                <div className="flex gap-2">
                  {!isMyMessage && (
                    <button
                      onClick={() => onPayNow(message.debt_id || message.id, message.amount || 0, message.purpose || 'Split')}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[10px] rounded-lg tracking-wider cursor-pointer shadow-md transition-transform active:scale-95 text-center flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Pay ₹{message.amount}
                    </button>
                  )}

                  {isMyMessage && (
                    <button
                      onClick={() => onRemind(message.debt_id || message.id)}
                      className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-purple-100 font-bold text-[10px] rounded-lg tracking-wider cursor-pointer flex items-center gap-1"
                    >
                      <BellRing size={11} /> Remind
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : isPayment ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-1.5">
              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-305 text-[10px] uppercase font-black tracking-wider">
                Settled ✓
              </span>
              <span className={`text-[10px] font-medium ${isMyMessage ? 'text-purple-200' : 'text-foreground/50'}`}>
                {isMyMessage ? 'You paid' : `@${message.friend_name} paid you`}
              </span>
            </div>

            <div className="flex items-baseline gap-1 py-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-500 font-sans">
                ₹{message.amount}
              </span>
            </div>

            <p className="text-xs break-words italic opacity-90">
              "{message.purpose}"
            </p>
          </div>
        ) : (
          /* Normal text message bubble */
          <div className="space-y-1">
            {hasReceiptUrl ? (
              <div className="space-y-1.5">
                <div className="border border-border bg-background rounded-lg p-1.5 overflow-hidden">
                  <img
                    src={message.message}
                    alt="Receipt Upload"
                    className="max-h-40 rounded-md object-contain mx-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-xs opacity-75">📎 Receipt Attachment</p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed break-words font-sans">
                {message.message}
              </p>
            )}
          </div>
        )}

        {/* Timestamp footer alignment */}
        <div className={`text-[9px] mt-1.5 text-right opacity-60 w-full font-mono`}>
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;

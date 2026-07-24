import React, { useState, useRef } from 'react';
import { ChatMessage } from '../../types/zettl.types';
import { Clock, Calendar, CheckSquare, BellRing, Sparkles, CheckCheck, Check, Copy, Trash2, Reply, MoreVertical, Pin, Play, Pause, Volume2, Image as ImageIcon, CornerUpLeft } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ChatBubbleProps {
  message: ChatMessage;
  onPayNow: (debtId: string, amount: number, purpose: string) => void;
  onRemind: (debtId: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
  onPin?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onJumpToReply?: (replyId: string) => void;
  searchQuery?: string;
}

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  onPayNow,
  onRemind,
  onDelete,
  onReply,
  onPin,
  onReact,
  onJumpToReply,
  searchQuery,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isMyMessage = message.direction === 'outgoing';
  const isSystem = message.type === 'system' || message.direction === 'system';
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

  // Copy helper
  const handleCopyText = () => {
    const textToCopy = message.message || message.purpose || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success('Message copied!');
    }
    setShowMenu(false);
  };

  // Voice Play/Pause toggle
  const toggleVoicePlayback = () => {
    if (!message.media_url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(message.media_url);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && audioRef.current.duration) {
          setVoiceProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };
      audioRef.current.onended = () => {
        setIsPlayingVoice(false);
        setVoiceProgress(0);
      };
    }

    if (isPlayingVoice) {
      audioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      audioRef.current.play();
      setIsPlayingVoice(true);
    }
  };

  // Render system message pill
  if (isSystem) {
    return (
      <div id={`chat-bubble-${message.id}`} className="flex justify-center my-3 px-4">
        <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-1.5 rounded-full text-center flex items-center gap-2 max-w-xs sm:max-w-md shadow-sm">
          <Sparkles size={12} className="text-[#FF6B6B] shrink-0" />
          <span className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 leading-tight">
            {message.message}
          </span>
          <span className="text-[8.5px] text-zinc-400 font-mono shrink-0 ml-1">{formattedTime}</span>
        </div>
      </div>
    );
  }

  // Check if text is image URL or has media_type image
  const isImageMessage = message.media_type === 'image' || message.message?.startsWith('http') || message.message?.includes('/storage/') || message.message?.match(/\.(jpeg|jpg|gif|png|webp)$/i);
  const isVoiceMessage = message.media_type === 'voice';

  // Highlight matching search query helper
  const renderMessageText = (text: string) => {
    if (!searchQuery || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-black px-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      id={`chat-bubble-${message.id}`}
      className={`flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'} mb-3 px-1 md:px-3 group relative`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 px-4 shadow-sm relative transition-all ${
          isMyMessage
            ? 'bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white rounded-tr-none'
            : 'bg-white dark:bg-[#111118]/80 text-zinc-800 dark:text-zinc-100 rounded-tl-none border border-black/[0.06] dark:border-white/[0.08]'
        }`}
      >
        {/* Pinned Badge Indicator */}
        {message.is_pinned && (
          <div className="flex items-center gap-1 text-[9.5px] font-bold opacity-80 mb-1 border-b border-black/10 dark:border-white/10 pb-0.5">
            <Pin size={10} className="fill-current rotate-45" />
            <span>Pinned Message</span>
          </div>
        )}

        {/* Quoted Reply Box Preview */}
        {message.reply_to && (
          <div
            onClick={() => onJumpToReply && message.reply_to?.id && onJumpToReply(message.reply_to.id)}
            className={`cursor-pointer mb-2 p-2 rounded-xl text-[11px] border-l-4 ${
              isMyMessage
                ? 'bg-black/15 border-white/80 text-white/90'
                : 'bg-black/[0.04] dark:bg-white/[0.06] border-[#FF6B6B] text-zinc-700 dark:text-zinc-300'
            } flex items-center justify-between gap-2 overflow-hidden`}
          >
            <div className="truncate">
              <span className="font-bold block text-[10px] opacity-80">
                @{message.reply_to.sender}
              </span>
              <span className="truncate block opacity-90">{message.reply_to.text}</span>
            </div>
            <CornerUpLeft size={12} className="shrink-0 opacity-60" />
          </div>
        )}

        {/* Quick Action Toggle Button */}
        <div
          className={`absolute top-2 ${
            isMyMessage ? '-left-8' : '-right-8'
          } flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
            title="Options"
          >
            <MoreVertical size={14} />
          </button>
        </div>

        {/* Action Menu Popover */}
        {showMenu && (
          <div
            className={`absolute z-50 top-8 ${
              isMyMessage ? 'left-0' : 'right-0'
            } bg-white dark:bg-[#181824] border border-black/10 dark:border-white/10 rounded-2xl shadow-xl p-1.5 w-36 text-xs flex flex-col gap-0.5 text-zinc-800 dark:text-zinc-200 animate-in fade-in duration-150`}
          >
            {/* Quick Emoji Reaction Bar inside menu */}
            <div className="flex items-center justify-around py-1.5 border-b border-black/10 dark:border-white/10">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (onReact) onReact(message.id, emoji);
                    setShowMenu(false);
                  }}
                  className="hover:scale-125 transition-transform text-sm p-0.5 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopyText}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-left font-medium"
            >
              <Copy size={12} /> Copy
            </button>
            {onReply && (
              <button
                onClick={() => {
                  onReply(message);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-left font-medium"
              >
                <Reply size={12} /> Reply
              </button>
            )}
            {onPin && (
              <button
                onClick={() => {
                  onPin(message.id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-left font-medium"
              >
                <Pin size={12} /> {message.is_pinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            {isMyMessage && onDelete && (
              <button
                onClick={() => {
                  onDelete(message.id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 text-red-500 rounded-xl cursor-pointer text-left font-medium"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        )}

        {/* Core content handler depending on type */}
        {isRequest ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-white/10 pb-1.5">
              <span className="p-1 rounded-lg bg-[#FF6B6B]/20 text-[#FF8A8A] text-[10px] uppercase font-black tracking-wider">
                Request
              </span>
              <span className={`text-[10px] font-medium ${isMyMessage ? 'text-white/80' : 'text-zinc-500 dark:text-[#94A3B8]/50'}`}>
                {isMyMessage ? 'You requested' : `@${message.friend_name} requested`}
              </span>
            </div>

            <div className="flex items-baseline gap-1 py-1">
              <span className="text-xl sm:text-2xl font-black font-sans">
                ₹{message.amount}
              </span>
              <span className={`text-xs ${isMyMessage ? 'text-white/80' : 'text-zinc-500 dark:text-[#94A3B8]/50'}`}>
                INR
              </span>
            </div>

            <p className="text-xs break-words italic opacity-90">
              "{renderMessageText(message.purpose || '')}"
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
                    <CheckSquare size={11} /> Settled
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
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] rounded-lg tracking-wider cursor-pointer flex items-center gap-1"
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
              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-black tracking-wider">
                Settled ✓
              </span>
              <span className={`text-[10px] font-medium ${isMyMessage ? 'text-white/80' : 'text-zinc-500 dark:text-[#94A3B8]/50'}`}>
                {isMyMessage ? 'You paid' : `@${message.friend_name} paid you`}
              </span>
            </div>

            <div className="flex items-baseline gap-1 py-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-500 font-sans">
                ₹{message.amount}
              </span>
            </div>

            <p className="text-xs break-words italic opacity-90">
              "{renderMessageText(message.purpose || '')}"
            </p>
          </div>
        ) : isVoiceMessage ? (
          /* Voice Message Player */
          <div className="flex items-center gap-3 py-1 min-w-[180px]">
            <button
              onClick={toggleVoicePlayback}
              className={`p-2.5 rounded-full ${
                isMyMessage ? 'bg-white text-[#FF6B6B]' : 'bg-[#FF6B6B] text-white'
              } shadow cursor-pointer hover:scale-105 transition-transform`}
            >
              {isPlayingVoice ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 bg-black/20 dark:bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isMyMessage ? 'bg-white' : 'bg-[#FF6B6B]'} transition-all duration-150`}
                  style={{ width: `${voiceProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono opacity-80">
                <span>Voice Note</span>
                <span>{message.voice_duration ? `${message.voice_duration}s` : '0:05'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Normal text or image message bubble */
          <div className="space-y-1">
            {isImageMessage ? (
              <div className="space-y-1.5">
                <div className="border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/[0.2] rounded-lg p-1 overflow-hidden">
                  <img
                    src={message.media_url || message.message}
                    alt="Shared Media"
                    className="max-h-56 rounded-md object-contain mx-auto cursor-pointer hover:opacity-95 transition-opacity"
                    referrerPolicy="no-referrer"
                    onClick={() => window.open(message.media_url || message.message, '_blank')}
                  />
                </div>
                {message.message && !message.message.startsWith('http') && (
                  <p className="text-xs leading-relaxed break-words font-sans">
                    {renderMessageText(message.message)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs leading-relaxed break-words font-sans">
                {renderMessageText(message.message || '')}
              </p>
            )}
          </div>
        )}

        {/* Reaction Display Pills */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-black/5 dark:border-white/5">
            {Object.entries(message.reactions).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => onReact && onReact(message.id, emoji)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                  isMyMessage
                    ? 'bg-black/20 text-white'
                    : 'bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                } hover:scale-105 transition-transform cursor-pointer`}
              >
                <span>{emoji}</span>
                <span className="font-bold text-[9px]">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp & Delivery Status Ticks Footer */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-75 font-mono">
          <span>{formattedTime}</span>
          {isMyMessage && (
            <span>
              {message.delivery_status === 'sending' ? (
                <Clock size={11} className="text-white/60 inline animate-spin" />
              ) : message.read || message.delivery_status === 'read' ? (
                <CheckCheck size={12} className="text-sky-300 inline font-black" />
              ) : message.delivery_status === 'delivered' ? (
                <CheckCheck size={12} className="text-white/80 inline" />
              ) : (
                <Check size={12} className="text-white/60 inline" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;

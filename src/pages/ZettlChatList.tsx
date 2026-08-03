import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useChatList } from '../hooks/useZettlChat';
import ChatListItem from '../components/Zettl/ChatListItem';
import { Search, Layers, Sparkles } from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';
import FriendSystem from '../components/FriendSystem';

export default function ZettlChatList() {
  const navigate = useNavigate();
  const { chats, loading, refetch } = useChatList();
  const [search, setSearch] = useState('');

  // Sorter and Search Filter
  const filteredChats = chats.filter((chat) =>
    chat.friend_name.toLowerCase().includes(search.toLowerCase())
  );

  // Group stats calculations
  const totalOwedToMe = chats
    .filter((c) => c.net_balance > 0)
    .reduce((sum, c) => sum + c.net_balance, 0);

  const totalIOwe = chats
    .filter((c) => c.net_balance < 0)
    .reduce((sum, c) => sum + Math.abs(c.net_balance), 0);

  const handlePullRefresh = async () => {
    await refetch();
  };

  return (
    <motion.div
      id="zettl-chat-list-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 select-none"
    >
      {/* Brand Heading Panel */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white serif-heading">Zettle Up</h1>
        <p className="text-[10px] font-bold text-zinc-400 dark:text-[#94A3B8]/60 uppercase tracking-[0.2em] leading-relaxed">
          Instantly split and track debts with linked contacts
        </p>
      </div>

      {/* Dynamic Ledger Mini Card */}
      <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] p-6 rounded-2xl relative overflow-hidden flex items-center justify-between shadow-sm dark:shadow-xl">
        <div className="space-y-1 text-left">
          <span className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/60 font-black uppercase tracking-[0.15em] leading-none block">
            Friends owe you
          </span>
          <span className="text-2xl font-black text-emerald-500 font-sans block">
            ₹{totalOwedToMe}
          </span>
        </div>
        
        <div className="h-10 w-px bg-black/[0.06] dark:bg-white/[0.06] mx-2" />
        
        <div className="space-y-1 text-right">
          <span className="text-[9px] text-zinc-400 dark:text-[#94A3B8]/60 font-black uppercase tracking-[0.15em] leading-none block">
            You owe friends
          </span>
          <span className="text-2xl font-black text-[#FF6B6B] font-sans block">
            ₹{totalIOwe}
          </span>
        </div>
      </div>

      {/* Search Input Filter bar */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections by name..."
          className="w-full h-12 bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-[#FF8A8A]/40 dark:hover:border-[#FF8A8A]/30 focus:border-[#FF6B6B]/60 dark:focus:border-[#FF6B6B]/60 rounded-xl pl-11 pr-4 text-xs text-zinc-800 dark:text-white outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-white/30"
        />
      </div>

      {/* Pull-to-refresh List Wrapper */}
      <PullToRefresh onRefresh={handlePullRefresh}>
        <div className="space-y-4">
          {loading ? (
            /* Loading Bone Skeletons */
            <div className="space-y-3.5">
              {[1, 2, 3].map((val) => (
                <div key={val} className="flex items-center gap-3.5 p-4 bg-white/50 dark:bg-white/[0.01] border border-black/[0.06] dark:border-white/[0.05] rounded-2xl animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-black/[0.06] dark:bg-white/[0.06]" />
                  <div className="flex-1 space-y-2.5">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-24 bg-black/[0.06] dark:bg-white/[0.06] rounded-md" />
                      <div className="h-2.5 w-12 bg-black/[0.06] dark:bg-white/[0.06] rounded-md" />
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 w-32 bg-black/[0.06] dark:bg-white/[0.06] rounded-md" />
                      <div className="h-3.5 w-14 bg-black/[0.06] dark:bg-white/[0.06] rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            /* Empty display condition */
            <div className="bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] py-12 px-6 text-center space-y-4 rounded-2xl shadow-sm dark:shadow-md relative overflow-hidden">
              <div className="w-14 h-14 mx-auto rounded-full bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center text-[#FF6B6B]">
                <Layers size={22} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">No active debts</p>
                <p className="text-[10px] text-zinc-400 dark:text-[#94A3B8]/40 font-bold uppercase tracking-wider max-w-xs mx-auto px-4 leading-relaxed">
                  Your settlement boards are perfectly clear. Use the contact locator below to invite and link your friends!
                </p>
              </div>
            </div>
          ) : (
            /* Chat list row wrapper */
            <div className="bg-white dark:bg-[#111118]/80 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.06] rounded-3xl shadow-sm dark:shadow-lg">
              {filteredChats.map((chat) => {
                const targetFId = chat.friend_id || (chat as any).friendId || (chat as any).id;
                return (
                  <ChatListItem
                    key={targetFId}
                    item={chat}
                    onClick={() => navigate(`/zettl/chat/${targetFId}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Integrated Contact Locator */}
      <div className="pt-2 border-t border-border">
        <FriendSystem />
      </div>
    </motion.div>
  );
}

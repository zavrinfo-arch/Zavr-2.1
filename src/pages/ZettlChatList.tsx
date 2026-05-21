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
        <h1 className="text-3xl font-bold tracking-tight text-foreground serif-heading">Zettle Up</h1>
        <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] leading-relaxed">
          Instantly split and track debts with linked contacts
        </p>
      </div>

      {/* Dynamic Ledger Mini Card */}
      <div className="clay-card p-6 bg-surface relative overflow-hidden flex items-center justify-between">
        <div className="space-y-1 text-left">
          <span className="text-[9px] opacity-30 font-black uppercase tracking-[0.15em] leading-none block">
            Friends owe you
          </span>
          <span className="text-2xl font-black text-emerald-500 font-sans block">
            ₹{totalOwedToMe}
          </span>
        </div>
        
        <div className="h-10 w-px bg-border mx-2" />
        
        <div className="space-y-1 text-right">
          <span className="text-[9px] opacity-30 font-black uppercase tracking-[0.15em] leading-none block">
            You owe friends
          </span>
          <span className="text-2xl font-black text-[#FF6B6B] font-sans block">
            ₹{totalIOwe}
          </span>
        </div>
      </div>

      {/* Search Input Filter bar */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-purple-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections by name..."
          className="w-full h-12 bg-background clay-inset pl-11 pr-4 text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 rounded-xl placeholder:opacity-40 text-foreground"
        />
      </div>

      {/* Pull-to-refresh List Wrapper */}
      <PullToRefresh onRefresh={handlePullRefresh}>
        <div className="space-y-4">
          {loading ? (
            /* Loading Bone Skeletons */
            <div className="space-y-3.5">
              {[1, 2, 3].map((val) => (
                <div key={val} className="flex items-center gap-3.5 p-4 clay-card bg-surface/50 border border-border rounded-2xl animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-border" />
                  <div className="flex-1 space-y-2.5">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-24 bg-border rounded-md" />
                      <div className="h-2.5 w-12 bg-border rounded-md" />
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 w-32 bg-border rounded-md" />
                      <div className="h-3.5 w-14 bg-border rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            /* Empty display condition */
            <div className="clay-card py-12 px-6 text-center space-y-4 bg-surface relative overflow-hidden">
              <div className="w-14 h-14 mx-auto clay-inset flex items-center justify-center text-[#FF6B6B]">
                <Layers size={22} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-widest text-foreground">No active debts</p>
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-wider max-w-xs mx-auto px-4 leading-relaxed">
                  Your settlement boards are perfectly clear. Use the contact locator below to invite and link your friends!
                </p>
              </div>
            </div>
          ) : (
            /* Chat list row wrapper */
            <div className="clay bg-surface overflow-hidden divide-y divide-border rounded-3xl">
              {filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.friend_id}
                  item={chat}
                  onClick={() => navigate(`/zettl/chat/${chat.friend_id}`)}
                />
              ))}
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

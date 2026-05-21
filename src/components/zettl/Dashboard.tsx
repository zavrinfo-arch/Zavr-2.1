import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, ArrowRight, Bell, 
  HelpCircle, RefreshCw, Smartphone, ChevronRight, UserMinus, Plus
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';

interface ZettlDashboardProps {
  netBalance: number;
  totalOwedToMe: number;
  totalIOwe: number;
  activeRequests: any[];
  activePayments: any[];
  friendBalances: any[];
  suggestions: any[];
  onOpenCreateZettl: () => void;
  onSelectFriend: (friend: any) => void;
  onPayDebt: (id: string, amount: number, note: string) => void;
  onRemindFriend: (id: string) => void;
  onRefresh: () => void;
  onDeclineRequest?: (id: string) => void;
}

export default function ZettlDashboard({
  netBalance,
  totalOwedToMe,
  totalIOwe,
  activeRequests,
  activePayments,
  friendBalances,
  suggestions,
  onOpenCreateZettl,
  onSelectFriend,
  onPayDebt,
  onRemindFriend,
  onRefresh,
  onDeclineRequest
}: ZettlDashboardProps) {

  const handleSettleUpSuggestion = () => {
    // Suggest paying the smallest balance or open transfer modal
    onOpenCreateZettl();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero with Net Balance */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay-card p-6 relative overflow-hidden text-card-foreground border-2 border-foreground/5"
        id="net-balance-card"
      >
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#FF6B6B]/10 rounded-full -mr-16 -mt-16 blur-3xl rounded-full" />
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Net Position</p>
            <h2 className={cn(
              "text-4xl font-extrabold italic tracking-tighter mt-1",
              netBalance >= 0 ? "text-emerald-500" : "text-amber-500"
            )}>
              {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
            </h2>
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-1">
              {netBalance >= 0 ? "People owe you" : "You owe people"}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onRefresh}
            className="w-10 h-10 clay-inset rounded-xl flex items-center justify-center text-foreground/45 hover:text-foreground hover:bg-foreground/5 transition-all"
            title="Refresh Ledger"
          >
            <RefreshCw size={16} />
          </motion.button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-foreground/5 relative z-10">
          <div>
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">
              <TrendingUp size={12} className="text-emerald-500" />
              Get (Owed to you)
            </span>
            <p className="text-xl font-bold text-emerald-500 italic tracking-tight">{formatCurrency(totalOwedToMe)}</p>
          </div>
          <div className="text-right">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest justify-end opacity-40 mb-1">
              Give (You owe)
              <TrendingDown size={12} className="text-amber-500" />
            </span>
            <p className="text-xl font-bold text-amber-500 italic tracking-tight">{formatCurrency(totalIOwe)}</p>
          </div>
        </div>

        <div className="mt-5 relative z-10">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSettleUpSuggestion}
            className="w-full py-3 px-4 clay-coral hover:brightness-110 active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2 text-[10px] text-white font-black uppercase tracking-widest"
          >
            <Smartphone size={14} />
            Quick Settle Up
          </motion.button>
        </div>
      </motion.div>

      {/* 2. Smart Settlement Suggestions (Like GPay tips) */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest opacity-40 px-2">Smart Action Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((sug) => (
              <motion.div 
                key={sug.id}
                whileHover={{ y: -2 }}
                className="clay-card p-4 flex items-center justify-between gap-4 border border-foreground/5"
              >
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">{sug.title}</p>
                  <p className="text-[10px] text-foreground/50 leading-tight">{sug.subtitle}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onOpenCreateZettl()}
                  className="px-3 py-1.5 clay-inset hover:bg-foreground/5 rounded-xl text-[9px] font-black uppercase text-coral text-[#FF6B6B]"
                >
                  {sug.actionText}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Active Requests Card (Where people requested money from me) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 px-2 flex justify-between items-center">
          <span>Active Requests</span>
          <span className="text-[10px] font-bold opacity-30 text-emerald-500">{activeRequests.length} pending</span>
        </h3>
        {activeRequests.length === 0 ? (
          <div className="clay-card p-6 text-center opacity-40 border border-dashed border-foreground/10">
            <p className="text-[10px] font-black uppercase tracking-widest">No active payment requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeRequests.map((req) => (
              <motion.div 
                key={req.id}
                className="clay-card p-4 flex items-center justify-between gap-4 border border-foreground/5 hover:border-[#FF6B6B]/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl clay-inset p-0.5 border border-foreground/5">
                    <img 
                      src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${req.toUsername}`} 
                      alt="" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black italic">@{req.toUsername} requested</p>
                    <p className="text-[10px] font-medium opacity-50 mt-0.5">{req.note}</p>
                    {req.dueDate && (
                      <p className="text-[8px] font-black uppercase text-amber-500 mt-1">Due: {new Date(req.dueDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-black italic text-foreground tracking-tighter mr-2">{formatCurrency(req.amount)}</p>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => onPayDebt(req.id, req.amount, req.note)}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-600"
                  >
                    Pay Now
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Active Payments Card (Other outstanding debts the user owes) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 px-2 flex justify-between items-center">
          <span>Active Payments</span>
          <span className="text-[10px] font-bold opacity-30 text-amber-500">{activePayments.length} outstanding</span>
        </h3>
        {activePayments.length === 0 ? (
          <div className="clay-card p-6 text-center opacity-40 border border-dashed border-foreground/10">
            <p className="text-[10px] font-black uppercase tracking-widest">You don't owe anyone right now ✓</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePayments.map((pay) => {
              const friendName = pay.toUsername;
              return (
                <motion.div 
                  key={pay.id}
                  className="clay-card p-4 flex items-center justify-between gap-4 border border-foreground/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl clay-inset p-0.5 border border-foreground/5">
                      <img 
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${friendName}`} 
                        alt="" 
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black italic">You owe @{friendName}</p>
                      <p className="text-[10px] font-medium opacity-50 mt-0.5">{pay.note}</p>
                      {pay.dueDate && (
                        <p className="text-[8px] font-black uppercase text-amber-500 mt-1">Due: {new Date(pay.dueDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black italic text-amber-500 tracking-tighter mr-2">{formatCurrency(pay.amount)}</p>
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => onPayDebt(pay.id, pay.amount, pay.note)}
                      className="px-3 py-2 clay-inset text-amber-500 hover:bg-amber-500/5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-500/10"
                    >
                      Pay Now
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Friend Balances Card (Like GPay contact ledger overview) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 px-2 flex justify-between items-center">
          <span>Friend Balances</span>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCreateZettl}
            className="text-[10px] font-extrabold text-[#FF6B6B] uppercase flex items-center gap-1"
          >
            <Plus size={12} /> New Transfer
          </motion.button>
        </h3>
        {friendBalances.length === 0 ? (
          <div className="clay-card p-12 text-center opacity-30 mt-4 border border-dashed border-foreground/10">
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No friends linked yet.<br/>Go search for names!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {friendBalances.map((friend) => {
              const isPositive = friend.balance > 0;
              const isSettled = friend.balance === 0;

              return (
                <motion.div
                  key={friend.id}
                  whileHover={{ scale: 0.99 }}
                  onClick={() => onSelectFriend(friend)}
                  className="clay-card p-4 flex items-center justify-between cursor-pointer hover:border-foreground/10 border border-foreground/5 transition-all"
                  id={`friend-item-${friend.friendUsername}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl clay-inset p-0.5 border border-foreground/5 relative">
                      <img 
                        src={friend.friendAvatar} 
                        alt="" 
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {friend.balance !== 0 && (
                        <span className={cn(
                          "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] text-white font-bold",
                          isPositive ? "bg-emerald-500" : "bg-amber-500"
                        )}>
                          ★
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black italic">@{friend.friendUsername}</p>
                      <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.1em] mt-0.5">{friend.friendFullName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className={cn(
                        "text-sm font-black italic tracking-tighter",
                        isSettled ? "text-foreground/30" : isPositive ? "text-emerald-500" : "text-amber-500"
                      )}>
                        {isSettled ? 'Settled Up' : (isPositive ? `+${formatCurrency(friend.balance)}` : `-${formatCurrency(Math.abs(friend.balance))}`)}
                      </p>
                      <p className="text-[8px] font-black opacity-30 uppercase tracking-widest mt-0.5">
                        {isSettled ? 'No Balance' : (isPositive ? 'Owes You' : 'You Owe')}
                      </p>
                    </div>
                    <ChevronRight size={16} className="opacity-25" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

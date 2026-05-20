import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Users, Coins, CheckCircle, Handshake, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { FriendDebtDetail } from './useDashboardStats';

interface FriendBreakdownProps {
  whoOwesMe: FriendDebtDetail[];
  iOweThem: FriendDebtDetail[];
  onSettleFriend: (friendId: string) => void;
  currencySymbol: string;
}

export default function FriendBreakdown({ 
  whoOwesMe, 
  iOweThem, 
  onSettleFriend,
  currencySymbol 
}: FriendBreakdownProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* SECTION 1: Who Owes Me */}
      <div className="clay p-6 bg-surface">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg clay-inset bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Coins size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Who owes me</h3>
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Top debtor friends</p>
          </div>
        </div>

        {whoOwesMe.length === 0 ? (
          <div className="clay-card p-8 text-center opacity-30 h-[296px] flex flex-col justify-center items-center">
            <CheckCircle size={36} className="mb-3 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
              Perfect clear!<br/>Nobody owes you anything.
            </p>
          </div>
        ) : (
          <div className="space-y-3 h-[296px] overflow-y-auto no-scrollbar pr-1">
            {whoOwesMe.map((item, index) => (
              <motion.div
                key={item.friendId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="clay-inset p-3 bg-foreground/3 flex items-center justify-between gap-3 group hover:bg-foreground/5 transition-all rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl clay-inset p-0.5 shrink-0 border border-foreground/5">
                    <img 
                      src={item.avatar} 
                      alt="" 
                      className="w-full h-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black italic">@{item.username}</p>
                    <p className="text-[8px] font-bold opacity-35 uppercase tracking-widest truncate">{item.fullName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-500">
                      {formatCurrency(item.amount, currencySymbol)}
                    </p>
                    <p className="text-[7.5px] font-black uppercase opacity-25 tracking-widest">Owes you</p>
                  </div>
                  <button
                    onClick={() => onSettleFriend(item.friendId)}
                    className="px-2 py-1 bg-emerald-500 text-white rounded-md text-[8px] font-black uppercase tracking-widest clay transition-transform active:scale-95 cursor-pointer"
                  >
                    Settle
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: I Owe Them */}
      <div className="clay p-6 bg-surface">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg clay-inset bg-red-500/10 text-red-400 flex items-center justify-center">
            <Coins size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">I owe them</h3>
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Top creditor friends</p>
          </div>
        </div>

        {iOweThem.length === 0 ? (
          <div className="clay-card p-8 text-center opacity-30 h-[296px] flex flex-col justify-center items-center">
            <Handshake size={36} className="mb-3 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
              Debt Free!<br/>You don't owe any money.
            </p>
          </div>
        ) : (
          <div className="space-y-3 h-[296px] overflow-y-auto no-scrollbar pr-1">
            {iOweThem.map((item, index) => (
              <motion.div
                key={item.friendId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="clay-inset p-3 bg-foreground/3 flex items-center justify-between gap-3 group hover:bg-foreground/5 transition-all rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl clay-inset p-0.5 shrink-0 border border-foreground/5">
                    <img 
                      src={item.avatar} 
                      alt="" 
                      className="w-full h-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black italic text-red-400/90">@{item.username}</p>
                    <p className="text-[8px] font-bold opacity-35 uppercase tracking-widest truncate">{item.fullName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black text-red-500">
                      {formatCurrency(item.amount, currencySymbol)}
                    </p>
                    <p className="text-[7.5px] font-black uppercase opacity-25 tracking-widest">You owe</p>
                  </div>
                  <button
                    onClick={() => onSettleFriend(item.friendId)}
                    className="px-2 py-1 bg-red-500 text-white rounded-md text-[8px] font-black uppercase tracking-widest clay transition-transform active:scale-95 cursor-pointer"
                  >
                    Settle
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

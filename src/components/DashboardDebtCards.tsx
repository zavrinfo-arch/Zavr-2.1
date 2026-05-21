import React from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Coins, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, BellRing, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardDebtCardsProps {
  onSelectFriend?: (friend: any) => void;
}

export default function DashboardDebtCards({ onSelectFriend }: DashboardDebtCardsProps) {
  const {
    loading,
    netBalance,
    totalOwedToMe,
    totalIOwe,
    pendingRequests,
    activeDebts,
    friendBalances,
    payDebt,
    sendReminder
  } = useZettlContext();

  // Helper payment trigger to avoid race condition and provide direct toast success/error feedback
  const handlePay = async (id: string, amount: number, note: string) => {
    try {
      await payDebt(id);
    } catch (err: any) {
      toast.error('GPay payload failed. Reload profiles.');
    }
  };

  const isNetPositive = netBalance >= 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="clay p-6 bg-surface animate-pulse h-40 rounded-2xl" />
        <div className="clay p-6 bg-surface animate-pulse h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Net Balance Stats Block */}
      <div className="clay p-6 bg-surface">
        <div className="flex items-center gap-2 mb-4 text-purple-400">
          <Wallet size={16} />
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Zettl Ledger Balance</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Owed to me */}
          <div className="clay-inset p-3 bg-foreground/2 rounded-xl flex flex-col justify-between">
            <span className="text-[7.5px] font-black uppercase text-emerald-400/90 tracking-wider">Owed To Me</span>
            <span className="text-lg font-black font-mono text-emerald-400 mt-1">₹{totalOwedToMe}</span>
          </div>

          {/* I Owe */}
          <div className="clay-inset p-3 bg-foreground/2 rounded-xl flex flex-col justify-between">
            <span className="text-[7.5px] font-black uppercase text-red-400/90 tracking-wider">I Owe Them</span>
            <span className="text-lg font-black font-mono text-red-400 mt-1">₹{totalIOwe}</span>
          </div>

          {/* Net balance */}
          <div className={`clay-inset p-3 rounded-xl flex flex-col justify-between ${
            isNetPositive ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-red-500/5 border border-red-500/10'
          }`}>
            <span className="text-[7.5px] font-black uppercase tracking-wider text-purple-400">Net Ledger</span>
            <span className={`text-lg font-black font-mono mt-1 ${isNetPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isNetPositive ? '+' : ''}₹{netBalance}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 2. Pending Requests Owed To Others (Ready to pay) */}
        <div className="clay p-6 bg-surface">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg clay-inset bg-red-500/10 text-red-400 flex items-center justify-center">
              <ArrowDownLeft size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Unpaid Demands</h3>
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">Incoming bills requested from you</p>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="clay-card p-6 text-center opacity-30 h-60 flex flex-col justify-center items-center">
              <CheckCircle2 size={30} className="mb-2 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Clear of debt dues!<br/>No waiting invoices to settle.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {pendingRequests.map((req) => (
                <div key={req.id} className="clay-inset p-3 bg-foreground/2 flex items-center justify-between gap-3 rounded-xl border border-foreground/5">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-red-400/90">₹{req.amount}</p>
                    <p className="text-[9px] font-bold opacity-50 truncate mt-0.5">{req.note || 'Split bill share'}</p>
                  </div>
                  <button
                    onClick={() => handlePay(req.id, req.amount, req.note)}
                    className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-[8px] font-black uppercase tracking-widest clay active:scale-95 duration-200"
                  >
                    Pay Now 💳
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Friend Ledger Balances Card */}
        <div className="clay p-6 bg-surface">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg clay-inset bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Coins size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Friend Balances</h3>
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">Current outstanding links</p>
            </div>
          </div>

          {friendBalances.length === 0 ? (
            <div className="clay-card p-6 text-center opacity-30 h-60 flex flex-col justify-center items-center">
              <Sparkles size={30} className="mb-2 text-purple-400" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Linked accounts balanced.<br/>Make friend splits to track!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {friendBalances.map((item) => {
                const isOwed = item.netAmount > 0;
                return (
                  <div
                    key={item.friendId}
                    onClick={() => onSelectFriend?.({
                      friendId: item.friendId,
                      friendUsername: item.username,
                      friendFullName: item.fullName,
                      friendAvatar: item.avatar
                    })}
                    className="clay-inset p-3 bg-foreground/2 flex items-center justify-between gap-3 rounded-xl cursor-pointer hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.avatar}
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover clay-inset"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black italic">@{item.username}</p>
                        <p className="text-[8px] font-black uppercase opacity-45 truncate">{item.fullName}</p>
                      </div>
                    </div>
                    
                    <span className={`text-[9px] font-black uppercase tracking-wider py-1 px-2 rounded-lg shrink-0 ${
                      isOwed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {item.description}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

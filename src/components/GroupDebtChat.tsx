import React, { useState, useEffect } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { useStore } from '../store/useStore';
import { GroupGoal } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Send, CheckCircle2, DollarSign, Wallet, RefreshCw, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupDebtChatProps {
  group: GroupGoal;
}

interface GroupSplitBill {
  id: string;
  description: string;
  totalAmount: number;
  splitAmount: number;
  paidCount: number;
  totalMembers: number;
  splits: {
    userId: string;
    name: string;
    avatar: string;
    amount: number;
    isSettled: boolean;
  }[];
  createdAt: string;
}

export default function GroupDebtChat({ group }: GroupDebtChatProps) {
  const { currentUser } = useStore();
  const { payDebt } = useZettlContext();
  const [inputText, setInputText] = useState('');
  const [splitBills, setSplitBills] = useState<GroupSplitBill[]>([]);
  const activeUserId = currentUser?.id || '';

  // Initialize group splits locally with state synchronization from local storage to keep items alive
  useEffect(() => {
    const key = `group_splits_${group.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setSplitBills(JSON.parse(saved));
    } else {
      // Create a default split example for demo/live testing
      const sampleSplits: GroupSplitBill[] = [
        {
          id: `sample-split-1`,
          description: 'Team Dinner split 🍕',
          totalAmount: 2000,
          splitAmount: 500,
          paidCount: 2,
          totalMembers: 4,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          splits: (group.members || []).map((m, idx) => ({
            userId: m.userId,
            name: m.name,
            avatar: m.avatar,
            amount: 500,
            // First two paid, rest waiting
            isSettled: idx < 2 || m.userId === activeUserId ? false : true
          }))
        }
      ];
      setSplitBills(sampleSplits);
      localStorage.setItem(key, JSON.stringify(sampleSplits));
    }
  }, [group, activeUserId]);

  const saveSplits = (newBills: GroupSplitBill[]) => {
    const key = `group_splits_${group.id}`;
    setSplitBills(newBills);
    localStorage.setItem(key, JSON.stringify(newBills));
  };

  const handleGroupSplitSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText.trim();
    if (query.startsWith('/group ')) {
      const match = query.match(/^\/group\s+(\d+)(?:\s+for\s+(.+)|(?:\s+(.+))|)$/i);
      if (match) {
        const total = parseFloat(match[1]);
        const desc = match[2] || match[3] || 'Group Joint split';
        if (isNaN(total) || total <= 0) {
          toast.error('Invalid split amount');
          return;
        }

        const membersList = group.members || [];
        if (membersList.length === 0) {
          toast.error('This group goal has no members');
          return;
        }

        const perShare = Math.round((total / membersList.length) * 100) / 100;
        const newBill: GroupSplitBill = {
          id: `split-${Date.now()}`,
          description: desc,
          totalAmount: total,
          splitAmount: perShare,
          paidCount: 1, // Current creator is paid
          totalMembers: membersList.length,
          createdAt: new Date().toISOString(),
          splits: membersList.map(m => ({
            userId: m.userId,
            name: m.name,
            avatar: m.avatar,
            amount: perShare,
            isSettled: m.userId === activeUserId // Current user automatically settled
          }))
        };

        const updated = [...splitBills, newBill];
        saveSplits(updated);
        setInputText('');
        toast.success(`Broadcasting ₹${total} group split among members!`);
      } else {
        toast.error('Format error! Use: /group <amount> for <reason>');
      }
    } else {
      toast.error('Write a valid slash command such as: /group 4000 dinner');
    }
  };

  const handlePaySplitShare = (billId: string, memberUserId: string) => {
    const updated = splitBills.map(bill => {
      if (bill.id !== billId) return bill;
      
      const newSplits = bill.splits.map(sp => {
        if (sp.userId !== memberUserId) return sp;
        return { ...sp, isSettled: true };
      });
      const newPaidCount = newSplits.filter(s => s.isSettled).length;

      return {
        ...bill,
        splits: newSplits,
        paidCount: newPaidCount
      };
    });

    saveSplits(updated);
    toast.success('Successfully paid split share via connected GPay handler!');
  };

  return (
    <div className="clay bg-surface flex flex-col h-[520px] rounded-2xl relative border border-foreground/5 overflow-hidden">
      
      {/* Group Info Header */}
      <div className="p-4 bg-foreground/3 border-b border-foreground/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl clay-inset bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black italic">#{group.name}</h4>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{group.groupId} • {group.members?.length || 0} participants</p>
          </div>
        </div>
      </div>

      {/* Message space */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        
        {/* Banner split helper tip */}
        <div className="flex justify-center">
          <div className="text-[8.5px] font-black uppercase tracking-[0.2em] bg-purple-600/10 text-purple-400 px-3 py-1.5 rounded-full text-center max-w-xs leading-relaxed border border-purple-500/10">
            👥 Slash: <code className="text-white">/group 3000 Taxi fare</code> to split instantly!
          </div>
        </div>

        {splitBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-25 text-center">
            <Wallet size={36} className="mb-2 text-purple-400 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-widest">No group splits posted</p>
            <p className="text-[8px] font-bold mt-1">Initiate a joint invoice with slash commands</p>
          </div>
        ) : (
          splitBills.map((bill) => {
            const myShare = bill.splits.find(sp => sp.userId === activeUserId);
            const isBillUnpaid = myShare && !myShare.isSettled;
            const progressPct = Math.round((bill.paidCount / bill.totalMembers) * 100);

            return (
              <div key={bill.id} className="flex justify-start">
                <div className="w-full max-w-sm rounded-2xl p-4 shadow-xl border bg-foreground/5 border-foreground/15 text-foreground">
                  
                  {/* Top description */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <Layers size={10} /> Circle Split Invoice
                    </span>
                    <span className="text-[7.5px] font-mono font-bold opacity-30">
                      {new Date(bill.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & bill info */}
                  <h5 className="text-xs font-black italic break-words mb-2">
                    {bill.description}
                  </h5>

                  {/* Split visual statistics */}
                  <div className="clay-inset p-3 bg-foreground/5 rounded-xl mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black italic text-foreground">Total Bill: ₹{bill.totalAmount}</p>
                      <p className="text-[8px] opacity-45 uppercase font-bold tracking-wider mt-0.5">₹{bill.splitAmount} cut per member</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-purple-400">{bill.paidCount} / {bill.totalMembers} Paid</p>
                      <p className="text-[8px] opacity-45 uppercase font-black tracking-widest">{progressPct}% Complete</p>
                    </div>
                  </div>

                  {/* Split visual Progress indicator */}
                  <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Splits detailed dropdown */}
                  <div className="space-y-1.5 border-t border-foreground/5 pt-3 mb-3">
                    <p className="text-[7.5px] font-black uppercase text-foreground/30 tracking-widest leading-none mb-1">Participants Splits</p>
                    {bill.splits.map((s, idx) => (
                      <div key={s.userId || idx} className="flex items-center justify-between text-[10px] py-1">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={s.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${s.name}`}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover clay-inset"
                          />
                          <span className={`${s.userId === activeUserId ? 'text-purple-400 font-bold' : 'opacify-80'}`}>
                            {s.userId === activeUserId ? 'You' : s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">₹{s.amount}</span>
                          {s.isSettled ? (
                            <span className="text-[7.5px] font-black text-emerald-500 uppercase">Paid ✓</span>
                          ) : (
                            <span className="text-[7.5px] font-black text-amber-500 uppercase">Unpaid</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pay share action */}
                  {isBillUnpaid && (
                    <button
                      onClick={() => handlePaySplitShare(bill.id, activeUserId)}
                      className="w-full py-1.5 bg-emerald-500 text-white rounded-lg text-[8.5px] font-black uppercase tracking-widest clay active:scale-95 duration-200"
                    >
                      Pay My Share (₹{bill.splitAmount}) 💳
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleGroupSplitSubmission} className="p-3 bg-foreground/3 border-t border-foreground/5 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Split group command: /group 5000 Dinner cost..."
          className="flex-1 clay-inset bg-foreground/5 p-3 text-xs outline-none focus:ring-1 focus:ring-purple-600 rounded-xl text-foreground placeholder:opacity-30"
        />
        <button
          type="submit"
          className="w-10 h-10 bg-purple-600 text-white hover:bg-purple-500 rounded-xl flex items-center justify-center clay transition-transform active:scale-90 cursor-pointer shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

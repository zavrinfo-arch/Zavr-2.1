import React from 'react';
import { X, HandCoins, CheckCircle2, Calendar, Receipt, CreditCard } from 'lucide-react';
import { ChatMessage } from '../../types/zettl.types';
import { format } from 'date-fns';

interface ZettlSettlementHistoryModalProps {
  friendName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

export default function ZettlSettlementHistoryModal({
  friendName,
  isOpen,
  onClose,
  messages,
}: ZettlSettlementHistoryModalProps) {
  if (!isOpen) return null;

  // Filter payment & settlement messages
  const settlements = messages.filter(
    (m) => m.type === 'payment' || m.purpose?.includes('SYSTEM_SETTLED') || m.purpose?.includes('Settled')
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-[#0a0a0f]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111118] border border-black/[0.08] dark:border-white/[0.08] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <HandCoins size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider leading-tight">Settlement History</h3>
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest">With {friendName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 overflow-y-auto no-scrollbar flex-1">
          {settlements.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-zinc-400 dark:text-zinc-500">
              <Receipt size={32} className="mx-auto opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider">No settlement history yet</p>
              <p className="text-[10px] max-w-xs mx-auto">
                Once a balance is settled via UPI, Cash or Bank transfer, records will appear here.
              </p>
            </div>
          ) : (
            settlements.map((item) => {
              let formattedDate = 'Recently';
              try {
                formattedDate = format(new Date(item.created_at), 'dd MMM yyyy, hh:mm a');
              } catch (e) {
                // Ignore
              }

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-black tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={11} /> Settled
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                        <Calendar size={10} /> {formattedDate}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {item.purpose || 'Direct Settlement Clearance'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-emerald-500 font-mono block">
                      ₹{item.amount || 0}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">
                      {item.direction === 'outgoing' ? 'You Paid' : 'Received'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

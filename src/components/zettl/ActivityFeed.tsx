import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Filter, 
  Clock, DollarSign, Wallet, Users 
} from 'lucide-react';
import { formatCurrency, cn, formatDateSafely } from '../../lib/utils';

export interface ActivityFeedItem {
  id: string;
  type: 'request_sent' | 'payment_sent' | 'reminder_sent' | 'group_created' | 'group_expense';
  title: string;
  body: string;
  amount?: number;
  timestamp: string;
  badge?: string;
}

interface ActivityFeedProps {
  activities: ActivityFeedItem[];
  onRefresh: () => void;
}

export default function ActivityFeed({
  activities,
  onRefresh
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<'ALL' | 'REQUESTS' | 'PAYMENTS' | 'GROUP'>('ALL');

  const filteredActivities = activities.filter(act => {
    if (filter === 'ALL') return true;
    if (filter === 'REQUESTS') return act.type === 'request_sent' || act.type === 'reminder_sent';
    if (filter === 'PAYMENTS') return act.type === 'payment_sent';
    if (filter === 'GROUP') return act.type === 'group_created' || act.type === 'group_expense';
    return true;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'payment_sent':
        return <DollarSign size={14} className="text-emerald-500" />;
      case 'request_sent':
        return <Wallet size={14} className="text-amber-500" />;
      case 'reminder_sent':
        return <Clock size={14} className="text-[#FF6B6B]" />;
      default:
        return <Users size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with refresh controls */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Timeline Feed</h3>
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-[0.2em] mt-1">Audit logs</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRefresh}
          className="w-8 h-8 clay-inset rounded-lg flex items-center justify-center text-foreground/45 hover:text-foreground"
        >
          <RefreshCw size={14} />
        </motion.button>
      </div>

      {/* 2. Filter tabs */}
      <div className="flex gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl">
        {(['ALL', 'REQUESTS', 'PAYMENTS', 'GROUP'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "flex-1 text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
              filter === tab ? "clay-card bg-surface text-foreground" : "text-foreground/45 hover:text-foreground/80"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. Chronicle Timeline List */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="clay-card p-12 text-center opacity-45 border border-dashed border-foreground/10">
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No historic records matching<br/>this filter tier yet!</p>
          </div>
        ) : (
          filteredActivities.map((act) => (
            <motion.div
              layoutId={act.id}
              key={act.id}
              className="clay-card p-4 flex items-center justify-between gap-4 border border-foreground/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl clay-inset flex items-center justify-center bg-foreground/5">
                  {getIconForType(act.type)}
                </div>
                <div>
                  <h4 className="text-xs font-black italic">{act.title}</h4>
                  <p className="text-[10px] opacity-60 font-medium mt-0.5 leading-tight">{act.body}</p>
                  <p className="text-[8px] opacity-30 font-black uppercase mt-1 tracking-widest">
                    {formatDateSafely(act.timestamp)}
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1.5">
                {act.amount !== undefined && (
                  <p className="text-sm font-black italic tracking-tighter">
                    {formatCurrency(act.amount)}
                  </p>
                )}
                {act.badge && (
                  <span className={cn(
                    "text-[7px] font-black tracking-widest py-0.5 px-1.5 rounded-md",
                    act.badge === 'SETTLED' ? "bg-emerald-500/15 text-emerald-500" :
                    act.badge === 'REMINDER' ? "bg-amber-500/15 text-amber-500" :
                    "bg-[#FF6B6B]/15 text-[#FF6B6B]"
                  )}>
                    {act.badge}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

    </div>
  );
}

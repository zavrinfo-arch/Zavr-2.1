import React, { useState } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, LayoutTemplate, Coins, RefreshCw, Send, ArrowUpRight, ArrowDownLeft, ShieldAlert } from 'lucide-react';

export default function ActivityFeed() {
  const { activities, loading, fetchData } = useZettlContext();
  const [filter, setFilter] = useState<'all' | 'requests' | 'payments' | 'groups'>('all');

  // Filter logic
  const filteredActivities = activities.filter((act) => {
    if (filter === 'all') return true;
    if (filter === 'requests') return act.action === 'requested' || act.action === 'reminded';
    if (filter === 'payments') return act.action === 'paid' || act.action === 'settled';
    if (filter === 'groups') return act.group_debt_id || act.action === 'created_group' || act.message?.includes('Group');
    return true;
  });

  // Relative Date Helper
  const groupActivitiesByDate = (acts: any[]) => {
    const groups: { [key: string]: any[] } = {};
    
    acts.forEach(act => {
      const date = new Date(act.created_at || act.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let key = 'Older Transactions';
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(act);
    });

    return groups;
  };

  const grouped = groupActivitiesByDate(filteredActivities);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'paid':
      case 'settled':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10';
      case 'requested':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/10';
      case 'reminded':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/10';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/10';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'paid':
      case 'settled':
        return <ArrowDownLeft size={14} />;
      case 'requested':
        return <ArrowUpRight size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Brand Header */}
      <div className="flex justify-between items-center pt-4">
        <div>
          <h2 className="text-xl font-black italic tracking-tight text-[#FF6B6B]">ZETTL TIMELINE</h2>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-35 mt-1">Audit Trail & Transaction History</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="w-9 h-9 clay-inset hover:bg-foreground/5 rounded-xl flex items-center justify-center shrink-0 border border-foreground/5"
          title="Refresh activities"
        >
          <RefreshCw size={14} className="text-purple-400" />
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex gap-1.5 p-1 clay-inset bg-foreground/5 rounded-xl">
        {[
          { id: 'all', label: 'All Log' },
          { id: 'requests', label: 'Requests' },
          { id: 'payments', label: 'Payments' },
          { id: 'groups', label: 'Joint Spl' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`flex-1 text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              filter === tab.id
                ? 'clay-card bg-surface text-foreground'
                : 'text-foreground/45 hover:text-foreground/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activities Feed lists */}
      {loading ? (
        <div className="space-y-4">
          <div className="clay p-6 bg-surface animate-pulse h-28 rounded-2xl" />
          <div className="clay p-6 bg-surface animate-pulse h-28 rounded-2xl" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="clay p-12 text-center opacity-30 border border-dashed border-foreground/10 flex flex-col items-center justify-center">
          <LayoutTemplate size={32} className="mb-2 text-purple-400" />
          <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No historic entries matched</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2.5">
              {/* Sticky relative date header */}
              <h4 className="text-[8.5px] font-black uppercase text-purple-400 tracking-[0.2em] ml-2">
                {dateKey}
              </h4>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="clay p-4 bg-surface flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Left icon wrapper */}
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${getActionColor(item.action)}`}>
                        {getActionIcon(item.action)}
                      </div>

                      {/* Main Message */}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground break-words leading-relaxed">
                          {item.message}
                        </p>
                        <p className="text-[7.5px] font-black uppercase tracking-widest text-foreground/25 mt-0.5">
                          {new Date(item.created_at || item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • status: {item.action}
                        </p>
                      </div>
                    </div>

                    {/* Numeric amount indicator */}
                    {item.amount > 0 && (
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-mono font-black ${
                          item.action === 'paid' || item.action === 'settled' ? 'text-emerald-400' : 'text-purple-400'
                        }`}>
                          ₹{item.amount}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

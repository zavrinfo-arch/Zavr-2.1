import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownLeft, Calendar, HandCoins, Check, History } from 'lucide-react';
import { formatDateSafely } from '../lib/utils';
import { RecentDebtActivity } from './useDashboardStats';

interface DebtActivityProps {
  activities: RecentDebtActivity[];
}

export default function DebtActivity({ activities }: DebtActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="clay-card p-10 text-center opacity-30">
        <History size={40} className="mx-auto mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
          No debt history found.
        </p>
      </div>
    );
  }

  return (
    <div className="clay p-6 bg-surface">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg clay-inset bg-purple-500/10 text-purple-400 flex items-center justify-center">
          <History size={16} />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Recent Activity</h3>
          <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Last 5 debt events</p>
        </div>
      </div>

      <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-foreground/5 mb-1">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-4 relative"
          >
            {/* Left circular marker with icon */}
            <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center relative z-10 shrink-0 ${
              activity.isSettled 
                ? 'clay-inset bg-emerald-500/10 text-emerald-400' 
                : activity.isLent 
                  ? 'clay bg-emerald-500/20 text-emerald-400 font-bold' 
                  : 'clay bg-red-500/20 text-red-400 font-bold'
            }`}>
              {activity.isSettled ? (
                <Check size={14} className="stroke-[3px]" />
              ) : activity.isLent ? (
                <ArrowUpRight size={14} className="stroke-[2.5px]" />
              ) : (
                <ArrowDownLeft size={14} className="stroke-[2.5px]" />
              )}
            </div>

            {/* Friend Avatar and activity text */}
            <div className="flex-1 flex gap-3 items-center min-w-0">
              <div className="w-10 h-10 rounded-xl clay-inset p-0.5 shrink-0">
                <img 
                  src={activity.friendAvatar} 
                  alt="" 
                  className="w-full h-full object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-snug text-foreground break-words">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                    activity.isSettled 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-yellow-500/15 text-yellow-400'
                  }`}>
                    {activity.isSettled ? 'Settled' : 'Unpaid'}
                  </span>
                  <p className="text-[8.5px] font-black uppercase tracking-widest opacity-35 flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDateSafely(activity.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, PiggyBank, Activity, DollarSign } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';

export default function DashboardSummary() {
  const { currentUser, soloGoals, groupGoals } = useStore();

  const totalSavings = soloGoals.reduce((sum, g) => sum + g.currentAmount, 0) + 
    groupGoals.reduce((sum, g) => sum + (g.members.find(m => m.userId === currentUser?.id)?.contributed || 0), 0);

  const stats = [
    {
      title: 'Monthly Income',
      value: formatCurrency(50000, currentUser?.preferences?.currency),
      icon: <DollarSign size={24} />,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      trend: '+5%',
      trendUp: true
    },
    {
      title: 'Total Savings',
      value: formatCurrency(totalSavings, currentUser?.preferences?.currency),
      icon: <PiggyBank size={24} />,
      color: 'text-[#4ECDC4]',
      bg: 'bg-[#4ECDC4]/10',
      trend: '+12%',
      trendUp: true
    },
    {
      title: 'Monthly Expenses',
      value: formatCurrency(12500, currentUser?.preferences?.currency),
      icon: <TrendingDown size={24} />,
      color: 'text-[#FF6B6B]',
      bg: 'bg-[#FF6B6B]/10',
      trend: '-2%',
      trendUp: false
    },
    {
      title: 'Health Score',
      value: '84/100',
      icon: <Activity size={24} />,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      trend: 'Excellent',
      trendUp: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="clay p-6 relative overflow-hidden group bg-surface"
        >
          <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-full -mr-12 -mt-12 blur-2xl transition-transform group-hover:scale-125 opacity-20`} />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className={`w-12 h-12 rounded-2xl clay-inset flex items-center justify-center ${stat.color} ${stat.bg}`}>
              {stat.icon}
            </div>
            <div className={`flex items-center gap-1.5 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${stat.trendUp ? 'text-[#4ECDC4] bg-[#4ECDC4]/10' : 'text-[#FF6B6B] bg-[#FF6B6B]/10'}`}>
              {stat.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {stat.trend}
            </div>
          </div>
          
          <div className="relative z-10">
            <p className="text-[10px] opacity-20 font-black uppercase tracking-[0.2em] mb-1.5">{stat.title}</p>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{stat.value}</h3>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

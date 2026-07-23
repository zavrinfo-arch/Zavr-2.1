import React, { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertCircle, 
  CheckCircle2, Clock, Activity, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import { useStore } from '../store/useStore';

export const DebtSummary: React.FC = () => {
  const { debts, debits, fetchDebts, fetchDebits, debtLoading } = useStore();

  useEffect(() => {
    fetchDebts();
    fetchDebits();
  }, [fetchDebts, fetchDebits]);

  // Calculations
  const stats = useMemo(() => {
    const activeDebts = debts.filter((d) => d.status === 'active');
    const settledDebts = debts.filter((d) => d.status === 'settled');
    const overdueDebts = debts.filter((d) => {
      if (d.status === 'overdue') return true;
      if (d.status === 'active' && d.due_date) {
        return new Date(d.due_date).getTime() < new Date().setHours(0, 0, 0, 0);
      }
      return false;
    });

    const activeDebits = debits.filter((d) => d.status === 'active');
    const settledDebits = debits.filter((d) => d.status === 'settled');
    const overdueDebits = debits.filter((d) => {
      if (d.status === 'overdue') return true;
      if (d.status === 'active' && d.due_date) {
        return new Date(d.due_date).getTime() < new Date().setHours(0, 0, 0, 0);
      }
      return false;
    });

    const totalLentActive = activeDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalLentSettled = settledDebts.reduce((sum, d) => sum + Number(d.amount), 0);

    const totalBorrowedActive = activeDebits.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalBorrowedSettled = settledDebits.reduce((sum, d) => sum + Number(d.amount), 0);

    const netPosition = totalLentActive - totalBorrowedActive;

    // Combined recent activity (last 5 items)
    const recentActivity = [
      ...debts.map((d) => ({ ...d, type: 'lent' as const })),
      ...debits.map((d) => ({ ...d, type: 'borrowed' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    return {
      activeDebtsCount: activeDebts.length,
      settledDebtsCount: settledDebts.length,
      overdueDebtsCount: overdueDebts.length,
      activeDebitsCount: activeDebits.length,
      settledDebitsCount: settledDebits.length,
      overdueDebitsCount: overdueDebits.length,
      totalLentActive,
      totalLentSettled,
      totalBorrowedActive,
      totalBorrowedSettled,
      netPosition,
      recentActivity
    };
  }, [debts, debits]);

  const totalVolume = stats.totalLentActive + stats.totalBorrowedActive;
  const lentPercentage = totalVolume > 0 ? (stats.totalLentActive / totalVolume) * 100 : 50;
  const borrowedPercentage = totalVolume > 0 ? (stats.totalBorrowedActive / totalVolume) * 100 : 50;

  return (
    <div className="space-y-4 w-full">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Lent */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Active Lent</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{stats.totalLentActive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-muted-foreground pt-1">
              {stats.activeDebtsCount} active loan(s) • ₹{stats.totalLentSettled.toLocaleString('en-IN')} settled
            </p>
          </div>
        </motion.div>

        {/* Total Borrowed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Active Borrowed</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
              ₹{stats.totalBorrowedActive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-muted-foreground pt-1">
              {stats.activeDebitsCount} active debt(s) • ₹{stats.totalBorrowedSettled.toLocaleString('en-IN')} settled
            </p>
          </div>
        </motion.div>

        {/* Net Balance Position */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Position</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className={`text-2xl font-black ${
              stats.netPosition >= 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              ₹{stats.netPosition.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-muted-foreground pt-1">
              {stats.netPosition >= 0 ? 'You are net positive 🟢' : 'You owe more than owed 🔴'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Visual Debt Breakdown Ratio */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Lent Ratio ({lentPercentage.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            Borrowed Ratio ({borrowedPercentage.toFixed(1)}%)
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
          <div 
            style={{ width: `${lentPercentage}%` }}
            className="bg-emerald-500 transition-all duration-500"
          />
          <div 
            style={{ width: `${borrowedPercentage}%` }}
            className="bg-rose-500 transition-all duration-500"
          />
        </div>

        {/* Secondary Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Settled Loans</p>
              <p className="font-bold">{stats.settledDebtsCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Overdue Items</p>
              <p className="font-bold text-rose-500">{stats.overdueDebtsCount + stats.overdueDebitsCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Pending Borrowed</p>
              <p className="font-bold">{stats.activeDebitsCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
            <Activity className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total Records</p>
              <p className="font-bold">{debts.length + debits.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Recent Debt & Debit Activity
        </h4>

        {stats.recentActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No debt activities recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentActivity.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-md ${
                    item.type === 'lent' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {item.type === 'lent' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.type === 'lent' ? 'Lent to' : 'Borrowed from'} {item.debitor?.name || 'Contact'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {'purpose' in item ? item.purpose : item.description || 'General'} • {new Date(item.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                <span className={`font-bold ${
                  item.type === 'lent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

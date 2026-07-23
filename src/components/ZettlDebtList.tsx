import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, AlertCircle, Clock, Search, Filter, 
  ArrowUpRight, ArrowDownLeft, Trash2, Check, DollarSign,
  ChevronLeft, ChevronRight, User, Calendar
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Debt, Debit } from '../types/index';
import toast from 'react-hot-toast';

interface ZettlDebtListProps {
  onSelectDebt?: (debt: Debt) => void;
  onSelectDebit?: (debit: Debit) => void;
}

export const ZettlDebtList: React.FC<ZettlDebtListProps> = ({
  onSelectDebt,
  onSelectDebit
}) => {
  const { 
    debts, 
    debits, 
    fetchDebts, 
    fetchDebits, 
    settleDebt, 
    settleDebit, 
    deleteDebt, 
    deleteDebit,
    debtLoading 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'debts' | 'debits'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchDebts();
    fetchDebits();
  }, [fetchDebts, fetchDebits]);

  // Combine and format records
  const combinedList = useMemo(() => {
    const list: Array<
      | (Debt & { itemType: 'debt' })
      | (Debit & { itemType: 'debit' })
    > = [];

    if (activeTab === 'all' || activeTab === 'debts') {
      debts.forEach((d) => list.push({ ...d, itemType: 'debt' }));
    }
    if (activeTab === 'all' || activeTab === 'debits') {
      debits.forEach((d) => list.push({ ...d, itemType: 'debit' }));
    }

    // Filter by status
    let filtered = list;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const name = item.debitor?.name?.toLowerCase() || '';
        const purpose = ('purpose' in item ? item.purpose : '')?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';
        return name.includes(q) || purpose.includes(q) || desc.includes(q);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'amount') {
        const diff = a.amount - b.amount;
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortBy === 'status') {
        const diff = a.status.localeCompare(b.status);
        return sortOrder === 'asc' ? diff : -diff;
      }
      // default: date
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return filtered;
  }, [debts, debits, activeTab, statusFilter, searchQuery, sortBy, sortOrder]);

  // Calculations
  const totalLentActive = useMemo(() => {
    return debts
      .filter((d) => d.status === 'active')
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [debts]);

  const totalBorrowedActive = useMemo(() => {
    return debits
      .filter((d) => d.status === 'active')
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [debits]);

  // Pagination calculations
  const totalPages = Math.ceil(combinedList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return combinedList.slice(start, start + itemsPerPage);
  }, [combinedList, currentPage]);

  const handleSettle = async (id: string, itemType: 'debt' | 'debit') => {
    try {
      if (itemType === 'debt') {
        await settleDebt(id);
        toast.success('✅ Debt marked as settled!');
      } else {
        await settleDebit(id);
        toast.success('✅ Debit marked as settled!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to settle record');
    }
  };

  const handleDelete = async (id: string, itemType: 'debt' | 'debit') => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      if (itemType === 'debt') {
        await deleteDebt(id);
        toast.success('🗑️ Debt record deleted');
      } else {
        await deleteDebit(id);
        toast.success('🗑️ Debit record deleted');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Totals Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Owed to Me</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ₹{totalLentActive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active I Owe</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
              ₹{totalBorrowedActive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Net Position</p>
            <p className={`text-lg font-bold ${
              totalLentActive - totalBorrowedActive >= 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              ₹{(totalLentActive - totalBorrowedActive).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start">
            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => { setActiveTab('debts'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'debts' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Lent ({debts.length})
            </button>
            <button
              onClick={() => { setActiveTab('debits'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'debits' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Borrowed ({debits.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contact, purpose, description..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Status Filter & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1 bg-background border border-input rounded-md text-xs focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="settled">Settled Only</option>
              <option value="overdue">Overdue Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1 bg-background border border-input rounded-md text-xs focus:outline-none"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-xs font-bold"
            >
              {sortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
            </button>
          </div>
        </div>
      </div>

      {/* Debt List Cards */}
      {debtLoading && paginatedList.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin text-primary" />
          Loading transactions...
        </div>
      ) : combinedList.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl space-y-2">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
          <h4 className="text-sm font-semibold">No transactions found</h4>
          <p className="text-xs text-muted-foreground">Try adjusting your search query or filters</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedList.map((item) => {
            const isDebt = item.itemType === 'debt';
            const isSettled = item.status === 'settled';
            const isOverdue = item.status === 'overdue' || (
              !isSettled && 
              item.due_date && 
              new Date(item.due_date).getTime() < new Date().setHours(0,0,0,0)
            );

            return (
              <motion.div
                key={`${item.itemType}-${item.id}`}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl bg-card border shadow-sm transition-all hover:border-primary/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSettled 
                    ? 'border-border opacity-75 bg-muted/20' 
                    : isOverdue 
                    ? 'border-rose-500/40 bg-rose-500/5' 
                    : 'border-border'
                }`}
              >
                {/* Left Side: Type Icon & Info */}
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    isDebt 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {isDebt ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isDebt 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      }`}>
                        {isDebt ? 'LENT' : 'BORROWED'}
                      </span>

                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isSettled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isOverdue
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {isSettled ? 'Settled' : isOverdue ? 'Overdue' : 'Active'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {item.debitor?.name || 'Contact'}
                    </h4>

                    {'purpose' in item && item.purpose && (
                      <p className="text-xs font-medium text-foreground/80">
                        Purpose: <span className="text-foreground">{item.purpose}</span>
                      </p>
                    )}

                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created: {new Date(item.created_at).toLocaleDateString('en-IN')}
                      </span>
                      {item.due_date && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-500 font-semibold' : ''}`}>
                          <Clock className="w-3 h-3" />
                          Due: {new Date(item.due_date).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Amount & Actions */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
                  <div className="text-right">
                    <p className={`text-base sm:text-lg font-black ${
                      isDebt ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isSettled && (
                      <button
                        onClick={() => handleSettle(item.id, item.itemType)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Settle
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(item.id, item.itemType)}
                      className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} ({combinedList.length} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-input text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-input text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

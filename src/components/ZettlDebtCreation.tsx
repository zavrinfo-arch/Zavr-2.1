import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Wallet, Calendar, FileText, Tag, 
  ArrowUpRight, ArrowDownLeft, Loader2, UserPlus, Check 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

interface ZettlDebtCreationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialType?: 'lent' | 'borrowed';
}

export const ZettlDebtCreation: React.FC<ZettlDebtCreationProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'lent'
}) => {
  const { 
    debitors, 
    fetchDebitors, 
    friendsForDropdown,
    refreshFriendsForDropdown,
    addDebitor, 
    addDebt, 
    addDebit, 
    refreshAllDebtData,
    currentUser 
  } = useStore();

  const [type, setType] = useState<'lent' | 'borrowed'>(initialType);
  const [selectedContactKey, setSelectedContactKey] = useState<string>('');
  const [isCreatingNewDebitor, setIsCreatingNewDebitor] = useState<boolean>(false);
  
  // New Debitor Form Fields
  const [newDebitorName, setNewDebitorName] = useState('');
  const [newDebitorEmail, setNewDebitorEmail] = useState('');
  const [newDebitorPhone, setNewDebitorPhone] = useState('');

  // Transaction Fields
  const [amount, setAmount] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<'active' | 'settled' | 'cancelled' | 'overdue'>('active');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      fetchDebitors();
      refreshFriendsForDropdown(true).catch(() => {});

      const handleFriendAccepted = () => {
        refreshFriendsForDropdown(true).catch(() => {});
        fetchDebitors();
      };

      window.addEventListener('friend-request-accepted', handleFriendAccepted);
      return () => {
        window.removeEventListener('friend-request-accepted', handleFriendAccepted);
      };
    }
  }, [isOpen, initialType, fetchDebitors, refreshFriendsForDropdown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive amount 💰');
      return;
    }

    setLoading(true);

    try {
      let finalDebitorId: string | null = null;

      if (isCreatingNewDebitor) {
        if (!newDebitorName.trim()) {
          toast.error('Contact name is required');
          setLoading(false);
          return;
        }
        const createdDebitor = await addDebitor({
          name: newDebitorName.trim(),
          email: newDebitorEmail.trim() || undefined,
          phone: newDebitorPhone.trim() || undefined
        });
        finalDebitorId = createdDebitor.id;
      } else if (selectedContactKey) {
        if (selectedContactKey.startsWith('debitor:')) {
          finalDebitorId = selectedContactKey.replace('debitor:', '');
        } else if (selectedContactKey.startsWith('friend:')) {
          const friendId = selectedContactKey.replace('friend:', '');
          const friendObj = friendsForDropdown.find(f => (f.friend_id || f.friendId || f.id) === friendId);
          if (friendObj) {
            // Check if matching debitor already exists
            const existing = debitors.find(d => d.name.toLowerCase() === (friendObj.full_name || friendObj.username).toLowerCase());
            if (existing) {
              finalDebitorId = existing.id;
            } else {
              // Create debitor record on the fly for friend
              const created = await addDebitor({
                name: friendObj.full_name || friendObj.username,
                email: undefined,
                phone: undefined
              });
              finalDebitorId = created.id;
            }
          }
        }
      }

      if (type === 'lent') {
        // User lent money -> Money owed TO user (Debt)
        await addDebt({
          debitor_id: finalDebitorId,
          creditor_id: currentUser?.id,
          amount: numAmount,
          purpose: purpose.trim() || 'General Loan',
          description: description.trim() || undefined,
          due_date: dueDate || null,
          status
        });
        toast.success(`✅ Debt created: ₹${numAmount} lent successfully!`);
      } else {
        // User borrowed money -> Money user owes (Debit)
        await addDebit({
          debitor_id: finalDebitorId,
          creditor_id: null,
          amount: numAmount,
          description: description.trim() || purpose.trim() || 'General Borrowing',
          due_date: dueDate || null,
          status
        });
        toast.success(`✅ Debit created: ₹${numAmount} recorded as borrowed!`);
      }

      await refreshAllDebtData(currentUser?.id);

      // Reset form
      setAmount('');
      setPurpose('');
      setDescription('');
      setSelectedContactKey('');
      setIsCreatingNewDebitor(false);
      setNewDebitorName('');
      setNewDebitorEmail('');
      setNewDebitorPhone('');

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ Error creating debt/debit record:', err);
      toast.error(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">New Zettl Record</h3>
                <p className="text-xs text-muted-foreground">Track money lent or borrowed</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Transaction Type Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setType('lent')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  type === 'lent' 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                LENT (I'm Creditor)
              </button>
              <button
                type="button"
                onClick={() => setType('borrowed')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  type === 'borrowed' 
                    ? 'bg-rose-500 text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                BORROWED (I'm Debtor)
              </button>
            </div>

            {/* Debitor / Friend Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                  {type === 'lent' ? 'Debitor / Borrower' : 'Creditor / Lender'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewDebitor(!isCreatingNewDebitor)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  {isCreatingNewDebitor ? 'Select Existing' : '＋ Add New Contact'}
                </button>
              </div>

              {!isCreatingNewDebitor ? (
                <select
                  value={selectedContactKey}
                  onChange={(e) => setSelectedContactKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Choose Friend / Contact (Optional) --</option>
                  
                  {friendsForDropdown.length > 0 && (
                    <optgroup label="🤝 Accepted Friends">
                      {friendsForDropdown.map((f) => {
                        const fid = f.friend_id || f.friendId || f.id;
                        return (
                          <option key={`friend-${fid}`} value={`friend:${fid}`}>
                            🤝 @{f.username} ({f.full_name})
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {debitors.length > 0 && (
                    <optgroup label="👥 Saved Contacts">
                      {debitors.map((d) => (
                        <option key={`debitor-${d.id}`} value={`debitor:${d.id}`}>
                          👤 {d.name} {d.phone ? `(${d.phone})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border">
                  <input
                    type="text"
                    placeholder="Contact Name *"
                    value={newDebitorName}
                    onChange={(e) => setNewDebitorName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={newDebitorEmail}
                      onChange={(e) => setNewDebitorEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={newDebitorPhone}
                      onChange={(e) => setNewDebitorPhone(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-base font-bold bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Purpose / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner split, Rent share, Coffee"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add extra notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Due Date & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Active (Unsettled)</option>
                  <option value="settled">Settled Immediately</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold hover:bg-muted rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Zettl Record
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight, ArrowDownLeft, Plus, Calendar, Tag, 
  Wallet, UserPlus, Check, Loader2 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

interface NewTransactionProps {
  onSuccess?: () => void;
}

export const NewTransaction: React.FC<NewTransactionProps> = ({ onSuccess }) => {
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

  const [transactionType, setTransactionType] = useState<'lent' | 'borrowed'>('lent');
  const [selectedContactKey, setSelectedContactKey] = useState<string>('');
  
  // On the fly debitor creation
  const [isNewDebitor, setIsNewDebitor] = useState<boolean>(false);
  const [debitorName, setDebitorName] = useState<string>('');
  const [debitorEmail, setDebitorEmail] = useState<string>('');
  const [debitorPhone, setDebitorPhone] = useState<string>('');

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
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
  }, [fetchDebitors, refreshFriendsForDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount 💰');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalDebitorId: string | null = null;

      if (isNewDebitor) {
        if (!debitorName.trim()) {
          toast.error('Contact name is required');
          setIsSubmitting(false);
          return;
        }
        const createdDebitor = await addDebitor({
          name: debitorName.trim(),
          email: debitorEmail.trim() || undefined,
          phone: debitorPhone.trim() || undefined
        });
        finalDebitorId = createdDebitor.id;
      } else if (selectedContactKey) {
        if (selectedContactKey.startsWith('debitor:')) {
          finalDebitorId = selectedContactKey.replace('debitor:', '');
        } else if (selectedContactKey.startsWith('friend:')) {
          const friendId = selectedContactKey.replace('friend:', '');
          const friendObj = friendsForDropdown.find(f => (f.friend_id || f.friendId || f.id) === friendId);
          if (friendObj) {
            const existing = debitors.find(d => d.name.toLowerCase() === (friendObj.full_name || friendObj.username).toLowerCase());
            if (existing) {
              finalDebitorId = existing.id;
            } else {
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

      if (transactionType === 'lent') {
        // LENT -> User is Creditor
        await addDebt({
          debitor_id: finalDebitorId,
          creditor_id: currentUser?.id,
          amount: numericAmount,
          purpose: purpose.trim() || 'General Loan',
          description: description.trim() || undefined,
          due_date: dueDate || null,
          status: 'pending'
        });
        toast.success(`💰 Recorded ₹${numericAmount} lent to contact!`);
      } else {
        // BORROWED -> User is Debtor
        await addDebit({
          debitor_id: finalDebitorId,
          creditor_id: null,
          amount: numericAmount,
          description: description.trim() || purpose.trim() || 'General Borrowing',
          due_date: dueDate || null,
          status: 'pending'
        });
        toast.success(`💰 Recorded ₹${numericAmount} borrowed!`);
      }

      await refreshAllDebtData(currentUser?.id);

      // Reset form
      setAmount('');
      setPurpose('');
      setDescription('');
      setSelectedContactKey('');
      setIsNewDebitor(false);
      setDebitorName('');
      setDebitorEmail('');
      setDebitorPhone('');

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('❌ Transaction creation error:', err);
      toast.error(err.message || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">New Transaction</h3>
            <p className="text-xs text-muted-foreground">Quickly log lent or borrowed money</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* LENT vs BORROWED Buttons */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => setTransactionType('lent')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              transactionType === 'lent' 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            LENT MONEY
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('borrowed')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              transactionType === 'borrowed' 
                ? 'bg-rose-500 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            BORROWED MONEY
          </button>
        </div>

        {/* Debitor / Friend Selection / On-The-Fly Creation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-primary" />
              {transactionType === 'lent' ? 'Debitor (Borrower)' : 'Creditor (Lender)'}
            </label>
            <button
              type="button"
              onClick={() => setIsNewDebitor(!isNewDebitor)}
              className="text-xs text-primary hover:underline font-semibold"
            >
              {isNewDebitor ? 'Select Existing' : '＋ Add New Contact'}
            </button>
          </div>

          {!isNewDebitor ? (
            <select
              value={selectedContactKey}
              onChange={(e) => setSelectedContactKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Friend or Contact --</option>
              
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
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
              <input
                type="text"
                placeholder="Full Name *"
                value={debitorName}
                onChange={(e) => setDebitorName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={debitorEmail}
                  onChange={(e) => setDebitorEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={debitorPhone}
                  onChange={(e) => setDebitorPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Amount (₹) *</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-sm font-bold bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Purpose / Title *</label>
          <input
            type="text"
            required
            placeholder="e.g., Grocery split, Movie ticket"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Due Date */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Record
            </>
          )}
        </button>
      </form>
    </div>
  );
};

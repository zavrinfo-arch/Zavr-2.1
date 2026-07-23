import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Mail, 
  Phone, Check, X, Loader2, UserCheck, AlertCircle 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Debitor } from '../types/index';
import toast from 'react-hot-toast';

export const DebtorManager: React.FC = () => {
  const { debitors, fetchDebitors, addDebitor, updateDebitor, deleteDebitor, debtLoading } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDebitor, setEditingDebitor] = useState<Debitor | null>(null);

  // Form states for add/edit
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDebitors();
  }, [fetchDebitors]);

  const filteredDebitors = useMemo(() => {
    if (!searchQuery.trim()) return debitors;
    const q = searchQuery.toLowerCase();
    return debitors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.email && d.email.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q))
    );
  }, [debitors, searchQuery]);

  const openAddModal = () => {
    setEditingDebitor(null);
    setName('');
    setEmail('');
    setPhone('');
    setIsAddOpen(true);
  };

  const openEditModal = (debitor: Debitor) => {
    setEditingDebitor(debitor);
    setName(debitor.name);
    setEmail(debitor.email || '');
    setPhone(debitor.phone || '');
    setIsAddOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Contact name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingDebitor) {
        await updateDebitor(editingDebitor.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          avatar_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name.trim())}`
        });
        toast.success(`✅ Updated details for ${name.trim()}`);
      } else {
        await addDebitor({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined
        });
        toast.success(`✅ Added contact "${name.trim()}"`);
      }

      setIsAddOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setEditingDebitor(null);
    } catch (err: any) {
      console.error('❌ Error saving debitor:', err);
      toast.error(err.message || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, contactName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${contactName}?`)) return;
    try {
      await deleteDebitor(id);
      toast.success(`🗑️ Removed contact ${contactName}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete contact');
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header & Add Button */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Contact & Debitor Directory</h3>
            <p className="text-xs text-muted-foreground">Manage contacts who borrow or lend with you</p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="px-3.5 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search contacts by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
        />
      </div>

      {/* List Grid */}
      {debtLoading && filteredDebitors.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading contacts...
        </div>
      ) : filteredDebitors.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-xl space-y-2">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">No contacts found in directory.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDebitors.map((debitor) => (
            <motion.div
              key={debitor.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-start justify-between gap-3 hover:border-primary/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <img
                  src={debitor.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(debitor.name)}`}
                  alt={debitor.name}
                  className="w-10 h-10 rounded-xl object-cover bg-muted shrink-0 border border-border"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 space-y-0.5">
                  <h4 className="text-sm font-bold text-foreground truncate">{debitor.name}</h4>
                  {debitor.email && (
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                      {debitor.email}
                    </p>
                  )}
                  {debitor.phone && (
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                      {debitor.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditModal(debitor)}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                  title="Edit contact"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(debitor.id, debitor.name)}
                  className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete contact"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground border border-border rounded-2xl p-5 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  {editingDebitor ? 'Edit Contact' : 'Add New Contact'}
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-input hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 flex items-center gap-1.5"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {editingDebitor ? 'Save Changes' : 'Create Contact'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React from 'react';
import { Target, Calendar as CalendarIcon, Tag, Flame } from 'lucide-react';
import { NeoLuxuryStyles } from './styles';

interface GoalSettingStepProps {
  goalName: string;
  setGoalName: (val: string) => void;
  targetAmount: number;
  setTargetAmount: (val: number) => void;
  category: string;
  setCategory: (val: string) => void;
  frequency: 'daily' | 'weekly' | 'monthly';
  setFrequency: (val: 'daily' | 'weekly' | 'monthly') => void;
  deadline: string;
  setDeadline: (val: string) => void;
  interests: string[];
}

const DEFAULT_CATEGORIES = [
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'emergency', label: 'Emergency', icon: '🚨' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'investment', label: 'Investment', icon: '📈' },
];

/**
 * GoalSettingStep
 * Guides users to create their very first goal with a sleek interactive form.
 */
export default function GoalSettingStep({
  goalName,
  setGoalName,
  targetAmount,
  setTargetAmount,
  category,
  setCategory,
  frequency,
  setFrequency,
  deadline,
  setDeadline,
  interests
}: GoalSettingStepProps) {

  // Auto-generate goal suggestions if they type or stay idle
  const suggestions = [
    { name: 'Rainy Day Fund', target: 15000, cat: 'emergency' },
    { name: 'New iPhone Slate', target: 80000, cat: 'tech' },
    { name: 'Ibiza Summer Escape', target: 120000, cat: 'travel' },
    { name: 'Crypto Investment Account', target: 20000, cat: 'investment' }
  ];

  const selectSuggestion = (s: typeof suggestions[0]) => {
    setGoalName(s.name);
    setTargetAmount(s.target);
    setCategory(s.cat);
    
    // Set a default deadline 6 months from now
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    setDeadline(sixMonths.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-fadeIn duration-500">
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Create your first goal</h2>
        <p className="text-xs text-[#8E8E93] uppercase tracking-[0.1em]">Set a tangible target to activate your Zavr account</p>
      </div>

      <div className="space-y-4">
        {/* Suggested Quickstarts */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-semibold text-[#8E8E93] uppercase tracking-widest block text-left">Suggested Goals</label>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="px-3 py-1.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.08] text-[10px] text-white/70 hover:text-white transition-all active:scale-95"
              >
                {s.name} (₹{s.target.toLocaleString('en-IN')})
              </button>
            ))}
          </div>
        </div>

        {/* Goal Name */}
        <div className="space-y-1">
          <label className={NeoLuxuryStyles.label}>What are you saving for?</label>
          <div className={NeoLuxuryStyles.inputContainer}>
            <Target size={16} className="text-[#4E4E52] mr-3" />
            <input
              type="text"
              placeholder="e.g. Dream Trip to Japan"
              className={NeoLuxuryStyles.input}
              value={goalName}
              onChange={e => setGoalName(e.target.value)}
            />
          </div>
        </div>

        {/* Target Amount */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className={NeoLuxuryStyles.label}>Target Amount</label>
            <span className="text-sm font-semibold tracking-wide text-white">
              ₹{targetAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="relative bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-3">
            <input
              type="range"
              min="2000"
              max="200000"
              step="5000"
              className="w-full accent-white h-1 rounded-lg bg-white/10 cursor-pointer"
              value={targetAmount}
              onChange={e => setTargetAmount(Number(e.target.value))}
            />
            <div className="flex justify-between text-[9px] text-[#4E4E52] font-semibold tracking-wider">
              <span>₹2,000</span>
              <span>₹50,000</span>
              <span>₹100,000</span>
              <span>₹200,000</span>
            </div>
          </div>
        </div>

        {/* Goal Category & Frequency grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Goal Category selector */}
          <div className="space-y-1">
            <label className={NeoLuxuryStyles.label}>Category</label>
            <div className="relative bg-[#050505] rounded-2xl border border-white/[0.08]">
              <select
                className="w-full bg-white/[0.02] text-white text-xs font-medium rounded-2xl px-4 py-4 outline-none focus:border-white/20"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {DEFAULT_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#050505] text-white">
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Savings Frequency */}
          <div className="space-y-1">
            <label className={NeoLuxuryStyles.label}>Deposit Cycle</label>
            <div className="flex bg-white/[0.02] border border-white/[0.08] p-1 rounded-2xl">
              {(['daily', 'weekly', 'monthly'] as const).map(freq => {
                const isSelected = frequency === freq;
                return (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className={`flex-1 text-[10px] font-semibold tracking-widest uppercase py-2.5 rounded-xl transition-all ${
                      isSelected 
                        ? 'bg-white/10 text-white shadow-md' 
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {freq}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="space-y-1">
          <label className={NeoLuxuryStyles.label}>Target Completion Date</label>
          <div className={NeoLuxuryStyles.inputContainer}>
            <CalendarIcon size={14} className="text-[#4E4E52] mr-3" />
            <input
              type="date"
              className={`${NeoLuxuryStyles.input} text-slate-300 dark:text-slate-100 scheme-dark`}
              style={{ colorScheme: 'dark' }}
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

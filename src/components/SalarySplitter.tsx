import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { PieChart as PieIcon, Sparkles, Wallet, ShoppingBag, PiggyBank, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';

const TEMPLATES = [
  { name: 'Fresh Graduate', needs: 40, wants: 20, savings: 40 },
  { name: 'First Job', needs: 50, wants: 30, savings: 20 },
  { name: 'Career Change', needs: 60, wants: 20, savings: 20 },
];

export default function SalarySplitter() {
  const { currentUser, sendChatMessage } = useStore();
  const [salary, setSalary] = useState(50000);
  const [needs, setNeeds] = useState(50);
  const [wants, setWants] = useState(30);
  const [savings, setSavings] = useState(20);

  const handleGetAdvice = () => {
    const message = `I've calculated my salary split for ₹${salary}: Needs (${needs}%: ₹${amounts.needs}), Wants (${wants}%: ₹${amounts.wants}), and Savings (${savings}%: ₹${amounts.savings}). What do you think of this breakdown?`;
    sendChatMessage(message);
  };

  const data = useMemo(() => [
    { name: 'Needs', value: needs, color: '#FF6B6B' },
    { name: 'Wants', value: wants, color: '#E2B05E' },
    { name: 'Savings', value: savings, color: '#4ECDC4' },
  ], [needs, wants, savings]);

  const amounts = useMemo(() => ({
    needs: (salary * needs) / 100,
    wants: (salary * wants) / 100,
    savings: (salary * savings) / 100,
  }), [salary, needs, wants, savings]);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setNeeds(template.needs);
    setWants(template.wants);
    setSavings(template.savings);
  };

  const handleSliderChange = (type: 'needs' | 'wants' | 'savings', value: number) => {
    if (type === 'needs') {
      setNeeds(value);
      const remaining = 100 - value;
      const ratio = wants / (wants + savings || 1);
      setWants(Math.round(remaining * ratio));
      setSavings(Math.round(remaining * (1 - ratio)));
    } else if (type === 'wants') {
      setWants(value);
      const remaining = 100 - value;
      const ratio = needs / (needs + savings || 1);
      setNeeds(Math.round(remaining * ratio));
      setSavings(Math.round(remaining * (1 - ratio)));
    } else {
      setSavings(value);
      const remaining = 100 - value;
      const ratio = needs / (needs + wants || 1);
      setNeeds(Math.round(remaining * ratio));
      setWants(Math.round(remaining * (1 - ratio)));
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Inputs */}
      <div className="space-y-6">
        <div className="clay p-8">
          <label className="block text-[10px] font-bold opacity-30 uppercase tracking-[0.2em] mb-6">Monthly Salary</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold opacity-10">₹</span>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full clay-inset py-5 pl-12 pr-4 text-4xl font-black text-foreground bg-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="clay p-8 space-y-10">
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-[#FF6B6B]" />
                <span className="font-bold text-sm opacity-80 uppercase tracking-widest">Needs</span>
              </div>
              <span className="font-black text-[#FF6B6B] text-lg">{needs}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={needs}
              onChange={(e) => handleSliderChange('needs', Number(e.target.value))}
              className="w-full h-1 bg-foreground/5 rounded-lg appearance-none cursor-pointer accent-[#FF6B6B]"
            />
            <p className="text-[10px] opacity-30 uppercase tracking-wider">Rent, groceries, utilities, insurance</p>
          </div>

          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShoppingBag size={18} className="text-[#E2B05E]" />
                <span className="font-bold text-sm opacity-80 uppercase tracking-widest">Wants</span>
              </div>
              <span className="font-black text-[#E2B05E] text-lg">{wants}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={wants}
              onChange={(e) => handleSliderChange('wants', Number(e.target.value))}
              className="w-full h-1 bg-foreground/5 rounded-lg appearance-none cursor-pointer accent-[#E2B05E]"
            />
            <p className="text-[10px] opacity-30 uppercase tracking-wider">Dining out, entertainment, hobbies</p>
          </div>

          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <PiggyBank size={18} className="text-[#4ECDC4]" />
                <span className="font-bold text-sm opacity-80 uppercase tracking-widest">Savings</span>
              </div>
              <span className="font-black text-[#4ECDC4] text-lg">{savings}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={savings}
              onChange={(e) => handleSliderChange('savings', Number(e.target.value))}
              className="w-full h-1 bg-foreground/5 rounded-lg appearance-none cursor-pointer accent-[#4ECDC4]"
            />
            <p className="text-[10px] opacity-30 uppercase tracking-wider">Emergency fund, investments, debt</p>
          </div>
        </div>

        <div className="flex gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="flex-1 py-4 px-2 clay-card text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:bg-foreground/5 transition-all active:scale-95"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Visualization */}
      <div className="space-y-6">
        <div className="clay p-8 flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', color: 'var(--foreground)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-6 w-full mt-8">
            <div className="text-center">
              <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest mb-2">Needs</p>
              <p className="font-black text-[#FF6B6B] text-sm">{formatCurrency(amounts.needs, currentUser?.preferences?.currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest mb-2">Wants</p>
              <p className="font-black text-[#E2B05E] text-sm">{formatCurrency(amounts.wants, currentUser?.preferences?.currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest mb-2">Savings</p>
              <p className="font-black text-[#4ECDC4] text-sm">{formatCurrency(amounts.savings, currentUser?.preferences?.currency)}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleGetAdvice}
          className="w-full py-5 clay-coral rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95 shadow-2xl"
        >
          <Sparkles size={18} />
          Get AI Advice
        </button>

        <div className="clay-card p-5 flex gap-4 items-start">
          <Info size={18} className="text-[#FF6B6B] shrink-0 mt-0.5" />
          <p className="text-[11px] opacity-40 leading-relaxed font-medium">
            The 50/30/20 rule is a simple budgeting method that can help you manage your money effectively, simply and sustainably.
          </p>
        </div>
      </div>
    </div>
  );
}

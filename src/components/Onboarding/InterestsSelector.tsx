import React from 'react';
import { NeoLuxuryStyles } from './styles';

const CATEGORIES = [
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'emergency', label: 'Emergency', icon: '🚨' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'investment', label: 'Investment', icon: '📈' },
];

interface InterestsSelectorProps {
  selectedInterests: string[];
  onChange: (interests: string[]) => void;
}

/**
 * InterestsSelector
 * Renders an interest choice grid styled as premium high-end tactile switches.
 */
export default function InterestsSelector({ selectedInterests, onChange }: InterestsSelectorProps) {
  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      onChange(selectedInterests.filter(i => i !== id));
    } else {
      if (selectedInterests.length < 5) {
        onChange([...selectedInterests, id]);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn duration-500">
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white">What are you saving for?</h2>
        <p className="text-xs text-[#8E8E93] uppercase tracking-[0.1em]">Pick 2-5 categories that align with your financial goals</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const isActive = selectedInterests.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleInterest(cat.id)}
              className={`${
                isActive ? NeoLuxuryStyles.pillActive : NeoLuxuryStyles.pillInactive
              } flex flex-col items-center justify-center p-6 gap-3 min-h-[140px] text-center`}
            >
              <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-transform duration-300 hover:scale-110">
                {cat.icon}
              </span>
              <span className="font-semibold text-[10px] tracking-[0.15em] uppercase mt-1">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { User as UserIcon, Smartphone, Calendar as CalendarIcon } from 'lucide-react';
import { NeoLuxuryStyles } from './styles';
import { useStore } from '../../store/useStore';
import OnboardingUsername from './OnboardingUsername';

// Standard international top regions
const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳' },
  { code: '+1', flag: '🇺🇸' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+971', flag: '🇦🇪' },
  { code: '+65', flag: '🇸🇬' },
];

interface PersonalDetailsFormProps {
  data: {
    fullName: string;
    username: string;
    phone: string;
    countryCode: string;
    dob: string;
    gender: string;
    genderOther: string;
  };
  onChange: (updates: Partial<PersonalDetailsFormProps['data']>) => void;
  errors: Record<string, string>;
  usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';
  setUsernameStatus: (status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error') => void;
  setManualErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}

/**
 * PersonalDetailsForm Component
 * Fully optimized using precise rendering boundaries to prevent overall page delays.
 * Employs a robust, highly performant username validation subcomponent.
 */
export default function PersonalDetailsForm({
  data,
  onChange,
  errors,
  usernameStatus,
  setUsernameStatus,
  setManualErrors
}: PersonalDetailsFormProps) {
  const { currentUser } = useStore();

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-fadeIn duration-500">
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white font-sans">Personal Details</h2>
        <p className="text-xs text-[#8E8E93] uppercase tracking-[0.1em]">Verify your profile identity to proceed</p>
      </div>

      <div className="space-y-5">
        {/* Full Name */}
        <div className="space-y-1">
          <label className={NeoLuxuryStyles.label}>Full Name</label>
          <div className={`${NeoLuxuryStyles.inputContainer} ${errors.fullName ? 'border-red-500/50' : ''}`}>
            <UserIcon size={16} className="text-[#4E4E52] mr-3" />
            <input
              type="text"
              placeholder="Enter your full name"
              className={NeoLuxuryStyles.input}
              value={data.fullName}
              onChange={e => onChange({ fullName: e.target.value })}
            />
          </div>
          {errors.fullName && <p className="text-[10px] text-red-400 font-medium ml-2 mt-1">{errors.fullName}</p>}
        </div>

        {/* Username with highly optimized, robust sub-component */}
        <OnboardingUsername
          value={data.username}
          onChange={(userVal) => onChange({ username: userVal })}
          onValidationChange={(status) => {
            setUsernameStatus(status);
            // Sync with parent manual errors state if appropriate
            setManualErrors(prev => {
              const copy = { ...prev };
              if (status === 'available') {
                delete copy.username;
              } else if (status === 'taken') {
                copy.username = 'Username already in use';
              } else if (status === 'invalid') {
                copy.username = 'Invalid username format';
              } else if (status === 'error') {
                copy.username = 'Connection error checking availability';
              }
              return copy;
            });
          }}
          userId={currentUser?.id}
        />

        {/* Phone details and country selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className={NeoLuxuryStyles.label}>Phone Number</label>
            <div className="flex gap-2">
              <select
                className="bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium rounded-2xl px-3 outline-none transition-all focus:border-white/20"
                value={data.countryCode}
                onChange={e => onChange({ countryCode: e.target.value })}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#0a0a0a] text-white">
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <div className={`${NeoLuxuryStyles.inputContainer} flex-1 ${errors.phone ? 'border-red-500/50' : ''}`}>
                <Smartphone size={14} className="text-[#4E4E52] mr-2" />
                <input
                  type="tel"
                  placeholder="Phone number"
                  className={NeoLuxuryStyles.input}
                  value={data.phone}
                  onChange={e => onChange({ phone: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
            {errors.phone && <p className="text-[10px] text-red-400 font-medium ml-2 mt-1">{errors.phone}</p>}
          </div>

          {/* DOB */}
          <div className="space-y-1">
            <label className={NeoLuxuryStyles.label}>Date of Birth</label>
            <div className={`${NeoLuxuryStyles.inputContainer} ${errors.dob ? 'border-red-500/50' : ''}`}>
              <CalendarIcon size={14} className="text-[#4E4E52] mr-2" />
              <input
                type="date"
                className={`${NeoLuxuryStyles.input} text-slate-300 dark:text-slate-100 scheme-dark`}
                style={{ colorScheme: 'dark' }}
                value={data.dob}
                onChange={e => onChange({ dob: e.target.value })}
              />
            </div>
            {errors.dob && <p className="text-[10px] text-red-400 font-medium ml-2 mt-1">{errors.dob}</p>}
          </div>
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <label className={NeoLuxuryStyles.label}>Gender</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => onChange({ gender: g })}
                className={g === data.gender ? NeoLuxuryStyles.pillActive : NeoLuxuryStyles.pillInactive}
              >
                {g}
              </button>
            ))}
          </div>

          {data.gender === 'Other' && (
            <div className="mt-2 animate-slideDown">
              <input
                placeholder="Specify your gender..."
                className="bg-white/[0.02] border border-white/[0.08] focus:border-white/25 rounded-2xl px-5 py-4 text-xs text-white placeholder-[#4E4E52] focus:outline-none w-full"
                value={data.genderOther}
                onChange={e => onChange({ genderOther: e.target.value })}
              />
              {errors.genderOther && <p className="text-[10px] text-red-400 font-medium ml-2 mt-1">{errors.genderOther}</p>}
            </div>
          )}
          {errors.gender && <p className="text-[10px] text-red-400 font-medium ml-2 mt-1">{errors.gender}</p>}
        </div>
      </div>
    </div>
  );
}

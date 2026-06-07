import React, { useEffect, useState } from 'react';
import { User as UserIcon, Smartphone, Calendar as CalendarIcon, Loader2, Check, AlertCircle } from 'lucide-react';
import { NeoLuxuryStyles } from './styles';
import { onboardingService } from '../../services/onboardingService';

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
  usernameStatus: 'idle' | 'checking' | 'available' | 'taken';
  setUsernameStatus: (status: 'idle' | 'checking' | 'available' | 'taken') => void;
  setManualErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}

/**
 * PersonalDetailsForm Component
 * Fully optimized using precise rendering boundaries to prevent overall page delays.
 * Features a lazy 500ms username debounce as requested.
 */
export default function PersonalDetailsForm({
  data,
  onChange,
  errors,
  usernameStatus,
  setUsernameStatus,
  setManualErrors
}: PersonalDetailsFormProps) {
  const [localUsername, setLocalUsername] = useState(data.username);

  // Sync state upward when local username changes
  useEffect(() => {
    onChange({ username: localUsername });
  }, [localUsername]);

  const statusRef = React.useRef(usernameStatus);
  useEffect(() => {
    statusRef.current = usernameStatus;
  }, [usernameStatus]);

  // Debounced real-time username availability check (500ms delay)
  // Ensures we do not pound Supabase with a backend request for every single keystroke.
  useEffect(() => {
    let active = true;

    const transition = (nextState: 'idle' | 'checking' | 'available' | 'taken') => {
      if (!active) {
        console.log('[USERNAME] Discarding transition to state:', nextState, 'for stale user:', localUsername);
        return;
      }
      console.log('[USERNAME] Transition to state:', nextState, 'for user:', localUsername);
      setUsernameStatus(nextState);
    };

    if (!localUsername) {
      transition('idle');
      setManualErrors(prev => {
        const copy = { ...prev };
        delete copy.username;
        return copy;
      });
      return;
    }

    // Task 3: Client side local validation rules
    if (localUsername.length < 3) {
      transition('idle');
      setManualErrors(prev => ({
        ...prev,
        username: 'Username must be at least 3 characters long'
      }));
      return;
    }

    if (localUsername.length > 20) {
      transition('idle');
      setManualErrors(prev => ({
        ...prev,
        username: 'Username must not exceed 20 characters'
      }));
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(localUsername)) {
      transition('idle');
      setManualErrors(prev => ({
        ...prev,
        username: 'Only letters, numbers, and underscores allowed'
      }));
      return;
    }

    setManualErrors(prev => {
      const copy = { ...prev };
      delete copy.username;
      return copy;
    });

    transition('checking');

    const timeoutId = setTimeout(async () => {
      if (!active) return;

      // Task 7: Unique tracer label
      const checkLabel = `username-check-${localUsername}`;
      console.time(checkLabel);
      console.log(`[Username Check Start] Initiating database query for: "${localUsername}"`);
      
      // Define a timeout promise which rejects after 5 seconds, storing its timeoutId for cleanup
      let timeoutId5s: any;
      const timeoutPromise = new Promise<{ available: boolean; error: any }>((_, reject) => {
        timeoutId5s = setTimeout(() => {
          console.warn(`[PersonalDetailsForm] Timeout threshold reached (5000ms) for username: "${localUsername}"`);
          reject(new Error('TIMEOUT'));
        }, 5000);
      });

      try {
        const queryStart = performance.now();

        // Race the username query against the 5-second timeout
        const checkPromise = onboardingService.checkUsernameAvailability(localUsername);
        const { available, error } = await Promise.race([checkPromise, timeoutPromise]);
        
        const queryDuration = performance.now() - queryStart;
        console.log(`[Username Check End] Finished query for: "${localUsername}" in ${queryDuration.toFixed(2)}ms`);

        if (!active) {
          console.log('[Username Check] Discarding stale validation query result.');
          return;
        }

        if (error) {
          console.warn('[PersonalDetailsForm] Connection error returned from query:', error);
          transition('available');
          return;
        }

        if (available) {
          transition('available');
        } else {
          transition('taken');
        }
      } catch (err: any) {
        if (!active) {
          console.log('[Username Check] Catch-block abortion triggered safe discard');
          return;
        }

        if (err.message === 'TIMEOUT') {
          console.error('[PersonalDetailsForm] Username validation query exceeded 5 seconds. Timing out.');
          // Stop spinner and show validation error message as requested
          transition('idle');
          setManualErrors(prev => ({
            ...prev,
            username: 'Validation timed out. Please try again.'
          }));
        } else {
          console.error('[PersonalDetailsForm] Failed to check username availability with exception:', err);
          transition('available'); // Graceful fallback
        }
      } finally {
        if (timeoutId5s) {
          clearTimeout(timeoutId5s);
        }
        console.timeEnd(checkLabel);
      }
    }, 500); // Strict 500ms lazy delay

    // Memory & Connection optimization: cancel both the timer and the network request on typing changes
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [localUsername, setUsernameStatus, setManualErrors]);

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

        {/* Username with real-time "lazy" feedback spinner */}
        <div className="space-y-1">
          <label className={NeoLuxuryStyles.label}>Username</label>
          <div className={`${NeoLuxuryStyles.inputContainer} ${
            usernameStatus === 'taken' ? 'border-red-500/50' : 
            usernameStatus === 'available' ? 'border-green-400/30' : ''
          }`}>
            <span className="text-sm font-medium text-[#4E4E52] mr-1">@</span>
            <input
              type="text"
              placeholder="choose_username"
              className={NeoLuxuryStyles.input}
              value={localUsername}
              onChange={e => setLocalUsername(e.target.value.toLowerCase().trim())}
            />
            {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-white/40 mr-1" />}
            {usernameStatus === 'available' && <Check size={16} className="text-green-400 mr-1" />}
            {usernameStatus === 'taken' && <AlertCircle size={16} className="text-red-400 mr-1" />}
          </div>
          <div className="flex justify-between px-2 mt-1">
            {errors.username ? (
              <p className="text-[10px] text-red-400 font-medium">{errors.username}</p>
            ) : usernameStatus === 'available' ? (
              <p className="text-[10px] text-green-400 font-medium tracking-wide">Username available</p>
            ) : usernameStatus === 'taken' ? (
              <p className="text-[10px] text-red-400 font-medium tracking-wide">Username already in use</p>
            ) : (
              <p className="text-[9px] text-[#4E4E52]">Alphanumeric + underscores only</p>
            )}
          </div>
        </div>

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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Loader2, Check, X, AlertCircle } from 'lucide-react';
import useUsernameValidation from '../../hooks/useUsernameValidation';
import { NeoLuxuryStyles } from './styles';

export default function OnboardingUsername({ value, onChange, onValidationChange, userId }) {
  const {
    username,
    setUsername,
    usernameStatus,
    errorMessage,
    isValid,
    validateOnBlur,
    suggestions,
    retryCheck,
  } = useUsernameValidation(value, userId);

  const inputRef = useRef(null);

  // Inform parent onboarding forms about changes to username and status
  useEffect(() => {
    onChange(username);
  }, [username, onChange]);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(usernameStatus);
    }
  }, [usernameStatus, onValidationChange]);

  return (
    <div className="space-y-2.5" id="onboarding-username-field">
      <div className="flex flex-col space-y-1">
        <label htmlFor="username-input" className={NeoLuxuryStyles.label}>
          Username
        </label>
        
        {/* Input Wrapper Field - Unified NeoLuxury Style to prevent clashing double borders */}
        <div className={`${NeoLuxuryStyles.inputContainer} flex items-center`}>
          <span className="text-sm font-black text-gray-400 font-mono pointer-events-none select-none mr-2">
            @
          </span>
          <input
            id="username-input"
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            onBlur={validateOnBlur}
            aria-invalid={usernameStatus === 'invalid' || usernameStatus === 'taken'}
            aria-describedby="username-status-msg"
            placeholder="choose_username"
            className={NeoLuxuryStyles.input}
          />

          {/* Status Indicator Overlays - High Visibility Icons */}
          <div className="absolute right-4 flex items-center space-x-2 z-10">
            {usernameStatus === 'checking' && (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" id="checking-loader-icon" />
            )}
            {usernameStatus === 'available' && (
              <Check className="w-4 h-4 text-green-400 stroke-[3px]" id="success-checkmark-icon" />
            )}
            {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
              <X className="w-4 h-4 text-red-400 stroke-[3px]" id="error-x-icon" />
            )}
            {usernameStatus === 'error' && (
              <AlertCircle className="w-4 h-4 text-yellow-500" id="offline-alert-icon" />
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Feedback Messaging Section (Extremely clean, no checking text to avoid duplicate loader noise) */}
      <div 
        id="username-status-msg" 
        aria-live="polite" 
        className="text-[11px] font-semibold tracking-wide min-h-[16px]"
      >
        {usernameStatus === 'available' && (
          <span className="text-green-400">✨ Absolutely gorgeous, @{username} is available!</span>
        )}
        {usernameStatus === 'taken' && (
          <span className="text-red-400">⚠️ @{username} is already taken by another Zavr member.</span>
        )}
        {usernameStatus === 'invalid' && (
          <span className="text-red-400">❌ {errorMessage}</span>
        )}
        {usernameStatus === 'error' && (
          <div className="flex items-center justify-between bg-red-950/20 border border-red-500/30 p-2.5 rounded-xl">
            <span className="text-red-400">{errorMessage}</span>
            <button
              type="button"
              onClick={retryCheck}
              className="bg-yellow-500 text-black px-2.5 py-1 rounded-lg text-[9px] font-black uppercase font-mono cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all duration-150 ml-2"
              id="username-retry-btn"
            >
              Retry Check
            </button>
          </div>
        )}
      </div>

      {/* Clickable Username Suggestions */}
      {usernameStatus === 'taken' && suggestions.length > 0 && (
        <div className="space-y-2 pt-1 animate-fadeIn" id="alternative-suggestions-box">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/50 font-mono">
            Quick Alternatives:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setUsername(suggestion);
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
                className="text-xs text-gray-400 hover:text-purple-400 font-bold bg-white/5 border border-white/[0.08] hover:border-purple-500/30 px-3 py-1.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-95"
                id={`suggestion-pill-${suggestion}`}
              >
                @{suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

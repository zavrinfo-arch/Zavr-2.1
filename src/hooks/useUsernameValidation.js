import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { onboardingService } from '../services/onboardingService';

// Global cache to persist validated usernames across the session (prevents unneeded API requests)
const sessionCache = new Map();

export default function useUsernameValidation(initialUsername = '', userId = null) {
  const [username, setLocalUsername] = useState(initialUsername || '');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const isFirstRender = useRef(true);
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);

  // Sync initialUsername downward on initial render
  useEffect(() => {
    if (initialUsername && username === '') {
      setLocalUsername(initialUsername);
    }
  }, [initialUsername]);

  // Derived state memoization
  const isValid = useMemo(() => {
    return usernameStatus === 'available';
  }, [usernameStatus]);

  const checkUsername = useCallback(
    async (value, isImmediate = false) => {
      // Clear any pending timeout and abort in-flight queries
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const clean = (value || '').trim().toLowerCase();
      if (!clean) {
        setUsernameStatus('idle');
        setErrorMessage('');
        setSuggestions([]);
        return;
      }

      // Requirement 1: Local pattern validator (regex checking)
      const regex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!regex.test(clean)) {
        setUsernameStatus('invalid');
        setErrorMessage('Username must be 3-20 characters and can only contain letters, numbers, and underscores');
        setSuggestions([]);
        return;
      }

      // Requirement 2: Reserved names check
      const reserved = ['admin', 'support', 'help', 'moderator', 'system', 'root', 'zavr', 'zettle', 'service', 'official'];
      if (reserved.includes(clean)) {
        setUsernameStatus('invalid');
        setErrorMessage(`Username "${clean}" is a reserved word and cannot be registered`);
        setSuggestions([]);
        return;
      }

      // Optimization: Check session cache map
      if (sessionCache.has(clean)) {
        const cached = sessionCache.get(clean);
        setUsernameStatus(cached.status);
        setErrorMessage(cached.errorMessage);
        setSuggestions(cached.suggestions);
        return;
      }

      setUsernameStatus('checking');
      setErrorMessage('');
      setSuggestions([]);

      const executeQuery = async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const { available, error } = await onboardingService.checkUsernameAvailability(
            clean,
            controller.signal,
            userId
          );

          if (error) {
            // Catch explicit abort queries
            if (error.name === 'AbortError' || controller.signal.aborted) {
              return;
            }
            throw error;
          }

          if (available) {
            const resultGroup = {
              status: 'available',
              errorMessage: '',
              suggestions: [],
            };
            sessionCache.set(clean, resultGroup);
            setUsernameStatus('available');
            setErrorMessage('');
            setSuggestions([]);
          } else {
            const generatedSuggestions = [
              `${clean}${Math.floor(10 + Math.random() * 89)}`,
              `${clean}_zavr`,
              `the_${clean}`
            ];
            const resultGroup = {
              status: 'taken',
              errorMessage: `Username "@${clean}" is already taken`,
              suggestions: generatedSuggestions,
            };
            sessionCache.set(clean, resultGroup);
            setUsernameStatus('taken');
            setErrorMessage(`Username "@${clean}" is already taken`);
            setSuggestions(generatedSuggestions);
          }
        } catch (err) {
          if (controller.signal.aborted) {
            return;
          }
          console.error('[Username Exception] Failed validation:', err);
          setUsernameStatus('error');
          setErrorMessage('Database connection dropped - please try again');
          setSuggestions([]);
        }
      };

      if (isImmediate) {
        await executeQuery();
      } else {
        // Debounce with exact 300 millisecond delay
        timeoutIdRef.current = setTimeout(async () => {
          await executeQuery();
        }, 300);
      }
    },
    [userId]
  );

  // Triggers validation instantly on Blur
  const validateOnBlur = useCallback(() => {
    if (usernameStatus === 'checking' || usernameStatus === 'idle') {
      checkUsername(username, true);
    }
  }, [username, usernameStatus, checkUsername]);

  // Manually recheck in event of failure
  const retryCheck = useCallback(() => {
    checkUsername(username, true);
  }, [username, checkUsername]);

  // Trigger debounced check upon username edit changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!username) return;
    }
    checkUsername(username, false);

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, checkUsername]);

  const setUsername = useCallback((val) => {
    setLocalUsername(val);
  }, []);

  return {
    username,
    setUsername,
    usernameStatus,
    errorMessage,
    isValid,
    validateOnBlur,
    suggestions,
    retryCheck,
  };
}

/**
 * debug.ts - AI Studio Preview Safe logger wrapper & interceptor
 * Automatically detects whether we are inside the Google AI Studio iframe/preview environment
 * and safely silences console floods/spams (e.g. random 100k+ numbers or unnecessary extensions warnings).
 */

interface SafeConsole {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
  debug: typeof console.debug;
}

// Store references to the original browser console functions
const _originalConsole: SafeConsole = {
  log: window.console.log.bind(window.console),
  warn: window.console.warn.bind(window.console),
  error: window.console.error.bind(window.console),
  info: window.console.info.bind(window.console),
  debug: window.console.debug.bind(window.console),
};

// Detect if we are running in the AI Studio preview frame
export const isAIStudioPreview = (): boolean => {
  try {
    // 1. Check if inside an iframe
    const isIframe = window.self !== window.top;
    
    // 2. Check hostname for dev server or AI Studio patterns
    const host = window.location.hostname;
    const isAiStudioDomain = host.includes('aistudio') || host.includes('run.app') || host.includes('google');
    
    // 3. Or check referrer
    const referrer = document.referrer;
    const isReferrerAiStudio = referrer.includes('ai.studio') || referrer.includes('google');

    return isIframe || isAiStudioDomain || isReferrerAiStudio;
  } catch (e) {
    // Fail-safe to true to protect the UI if security constraints block iframe self/top read
    return true;
  }
};

let logsEnabled = !isAIStudioPreview();

export const setLogsEnabled = (enabled: boolean) => {
  logsEnabled = enabled;
  _originalConsole.info(`[DEBUG UTILITY] Console logging is now: ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

/**
 * Filter checks if a log message represents the known preview-glitch numbers,
 * empty spam, React DevTools extension complaints, or MetaMask/Web3-related issues.
 */
const shouldSuppress = (args: any[]): boolean => {
  try {
    const firstArg = args[0];
    
    // Check if any argument is a string or contains text related to MetaMask or Web3
    if (firstArg !== undefined && firstArg !== null) {
      const strRepresentation = String(firstArg).toLowerCase();
      if (
        strRepresentation.includes('metamask') ||
        strRepresentation.includes('ethereum') ||
        strRepresentation.includes('web3') ||
        strRepresentation.includes('wallet')
      ) {
        return true;
      }
    }

    if (!logsEnabled) return true;

    // Check for large numbers (like 100k+ numbers flooding the console)
    if (typeof firstArg === 'number' && firstArg >= 100000) {
      return true;
    }
    
    if (typeof firstArg === 'string') {
      // Direct string representation of large number
      if (/^\d{5,12}$/.test(firstArg)) {
        return true;
      }
      
      // Suppress annoying React DevTools or HMR websocket failures to keep previews clean
      if (
        firstArg.includes('React DevTools') ||
        firstArg.includes('websocket') ||
        firstArg.includes('HMR') ||
        firstArg.includes('extension')
      ) {
        return true;
      }
    }
  } catch (e) {
    // Safe fallback if argument parsing fails
  }

  return false;
};

/**
 * Initialize the global logger override and error listeners
 */
export const initSilentSafeLogger = () => {
  if (isAIStudioPreview()) {
    // Default to off inside AI Studio Preview environment to prevent freezes and lag
    logsEnabled = false;
  }

  // Intercept console.log
  window.console.log = (...args: any[]) => {
    if (!shouldSuppress(args)) {
      _originalConsole.log(...args);
    }
  };

  // Intercept console.warn
  window.console.warn = (...args: any[]) => {
    if (!shouldSuppress(args)) {
      _originalConsole.warn(...args);
    }
  };

  // Intercept console.info
  window.console.info = (...args: any[]) => {
    if (!shouldSuppress(args)) {
      _originalConsole.info(...args);
    }
  };

  // Intercept console.debug
  window.console.debug = (...args: any[]) => {
    if (!shouldSuppress(args)) {
      _originalConsole.debug(...args);
    }
  };

  // We explicitly keep console.error to notify of fatal breakages except React DevTools or numbers
  window.console.error = (...args: any[]) => {
    if (!shouldSuppress(args)) {
      _originalConsole.error(...args);
    }
  };

  // Global event interceptor for unhandled errors from browser extensions (e.g. MetaMask)
  window.addEventListener('error', (event) => {
    try {
      const errorMsg = event.message || (event.error && event.error.message) || '';
      const lowerMsg = errorMsg.toLowerCase();
      if (
        lowerMsg.includes('metamask') ||
        lowerMsg.includes('ethereum') ||
        lowerMsg.includes('web3') ||
        lowerMsg.includes('wallet')
      ) {
        _originalConsole.info('[PREVIEW-INTERCEPTOR] Intercepted and suppressed MetaMask/Web3 global error:', errorMsg);
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Fail-safe
    }
  }, true);

  // Global event interceptor for unhandled promise rejections from browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const reasonMsg = reason ? (reason.message || String(reason)) : '';
      const lowerMsg = reasonMsg.toLowerCase();
      if (
        lowerMsg.includes('metamask') ||
        lowerMsg.includes('ethereum') ||
        lowerMsg.includes('web3') ||
        lowerMsg.includes('wallet')
      ) {
        _originalConsole.info('[PREVIEW-INTERCEPTOR] Intercepted and suppressed MetaMask/Web3 global rejection:', reasonMsg);
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Fail-safe
    }
  }, true);

  _originalConsole.info(
    `[DEBUG CONTROL] Initialized Safe Logger Interceptor. Preview mode: ${isAIStudioPreview() ? 'ACTIVE (Console logs suppressed)' : 'INACTIVE (Console logs active)'}`
  );
};

// Expose debug operations to the browser window so developers can switch on/off live
(window as any).__toggleLogs = (state: boolean) => {
  setLogsEnabled(state);
};

(window as any).__originalConsole = _originalConsole;

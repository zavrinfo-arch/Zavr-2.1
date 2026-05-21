/**
 * previewFix.ts - AI Studio Preview Safe Environment Detector and Optimizer
 * 
 * Provides safe detection of the AI Studio preview window,
 * manages console logging suppression to avoid browser lags, and
 * launches a keep-alive heartbeat to prevent preview iframe timeouts.
 */

// Helper to check if running in AI Studio Iframe / Workspace
export const isAIStudioPreview = (): boolean => {
  try {
    // 1. Iframe detection
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    
    // 2. Domain check
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isAiStudioDomain = host.includes('aistudio') || host.includes('run.app') || host.includes('google');
    
    // 3. Document referrer fallback
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const isReferrerAiStudio = referrer.includes('ai.studio') || referrer.includes('google');

    return isIframe || isAiStudioDomain || isReferrerAiStudio;
  } catch (e) {
    // Fail-safe to true to protect the app container
    return true;
  }
};

// Check if anims or realtime should be bypassed/disabled
export const shouldDisableHeavyFeatures = (): boolean => {
  return isAIStudioPreview();
};

// Keep-Alive Heartbeat controller
let heartbeatInterval: any = null;

export const startKeepAliveHeartbeat = () => {
  if (typeof window === 'undefined') return;
  if (!isAIStudioPreview()) return;

  // Clear existing if any
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  console.info('[PREVIEW-FIX] Starting Keep-Alive Heartbeat for AI Studio Preview...');

  heartbeatInterval = setInterval(() => {
    try {
      // 1. Send silent ping to the parent iframe so container proxy knows we are active
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'HEARTBEAT', timestamp: Date.now() }, '*');
      }

      // 2. Lightweight network ping to current host to keep connections warm
      fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          // Silent success
        })
        .catch(() => {
          // Suppress errors during offline testing
        });

      // 3. Keep-alive heartbeat trace in original console if present
      const origConsole = (window as any).__originalConsole || window.console;
      if (origConsole && typeof origConsole.info === 'function') {
        origConsole.info('[PREVIEW] Heartbeat Pulse • Active');
      }
    } catch (err) {
      // Ignore background errors
    }
  }, 30000); // 30 seconds interval
};

export const stopKeepAliveHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

interface MobileViewportWrapperProps {
  children: React.ReactNode;
}

export function MobileViewportWrapper({ children }: MobileViewportWrapperProps) {
  const [isNativeMobile, setIsNativeMobile] = useState(false);

  useEffect(() => {
    // Detect if running inside native Android or iOS builds (Capacitor, Cordova, Native WebView)
    const checkNativePlatform = () => {
      const win = typeof window !== 'undefined' ? (window as any) : {};
      const isCapacitorNative = win.Capacitor?.isNativePlatform?.() || 
                                (win.Capacitor?.platform && win.Capacitor?.platform !== 'web');
      const isCordovaNative = !!win.cordova;
      const isReactNativeWebView = !!win.ReactNativeWebView;

      if (isCapacitorNative || isCordovaNative || isReactNativeWebView) {
        setIsNativeMobile(true);
      }
    };

    checkNativePlatform();
  }, []);

  // For Android and iOS native builds, use the full device width normally
  if (isNativeMobile) {
    return (
      <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
        {children}
      </div>
    );
  }

  // For Web Preview: wrap entire application inside a centered mobile viewport on a clean white background
  return (
    <div className="w-full min-h-screen h-screen bg-white text-zinc-900 flex items-center justify-center overflow-hidden select-none p-0 m-0 relative">
      <div 
        className="w-full h-full bg-zinc-50 dark:bg-[#0a0a0f] relative overflow-hidden flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-none sm:rounded-[28px] border-0 sm:border sm:border-black/10 dark:sm:border-white/10"
        style={{
          width: '100%',
          maxWidth: '390px',
          height: '100vh',
          maxHeight: '100vh',
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
          transform: 'translateZ(0)' // Creates containing block for position: fixed elements
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default MobileViewportWrapper;

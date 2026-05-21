import React, { useState, useEffect } from 'react';
import { isAIStudioPreview } from '../utils/previewFix';
import { ShieldAlert, X } from 'lucide-react';

export default function PreviewBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isAIStudioPreview()) {
      const dismissed = sessionStorage.getItem('zettl_preview_banner_dismissed');
      if (!dismissed) {
        setShow(true);
      }
    }
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('zettl_preview_banner_dismissed', 'true');
  };

  return (
    <div id="preview-mode-banner" className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 px-4 py-1.5 flex items-center justify-between gap-4 text-[11px] font-sans h-8 z-[99999] relative shrink-0">
      <div className="flex items-center gap-2 truncate">
        <ShieldAlert size={14} className="text-amber-400 shrink-0" />
        <span className="truncate font-medium tracking-wide">
          ⚠️ Preview Mode — Some heavy real-time subscriptions and complex background routines are limited for stability
        </span>
      </div>
      <button 
        onClick={handleDismiss}
        className="p-1 hover:bg-white/10 rounded transition-colors text-amber-200/60 hover:text-amber-200"
        title="Dismiss warning"
      >
        <X size={14} />
      </button>
    </div>
  );
}

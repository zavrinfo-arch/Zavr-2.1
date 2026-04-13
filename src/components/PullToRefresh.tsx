import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullDistance = useMotionValue(0);
  const rotate = useTransform(pullDistance, [0, 100], [0, 360]);
  const opacity = useTransform(pullDistance, [0, 50, 100], [0, 0.5, 1]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = (_: any, info: any) => {
    if (isRefreshing) return;
    
    // Only allow pulling down if at the top of the scroll
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop <= 0 && info.offset.y > 0) {
      pullDistance.set(Math.min(info.offset.y * 0.5, 100));
    } else {
      pullDistance.set(0);
    }
  };

  const handleDragEnd = async () => {
    if (isRefreshing) return;

    if (pullDistance.get() >= 80) {
      setIsRefreshing(true);
      animate(pullDistance, 80, { duration: 0.2 });
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3 });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.3 });
    }
  };

  return (
    <div className="relative">
      <motion.div
        style={{ 
          height: pullDistance,
          opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40
        }}
      >
        <motion.div
          style={{ rotate: isRefreshing ? undefined : rotate }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
          className="w-12 h-12 rounded-2xl clay-inset bg-surface flex items-center justify-center text-[#4ECDC4]"
        >
          <RefreshCw size={24} />
        </motion.div>
      </motion.div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ y: pullDistance }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}

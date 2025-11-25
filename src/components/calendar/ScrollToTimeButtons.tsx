/**
 * ScrollToTimeButtons.tsx - Quick Navigation Buttons for Time Grid
 *
 * Provides floating buttons to quickly scroll to different times of day:
 * - Scroll to current time
 * - Scroll to top (12am)
 * - Scroll to bottom (11pm)
 *
 * Buttons appear/hide based on scroll position for clean UX.
 */
'use client';

import { useEffect, useState, useRef } from 'react';

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  hourHeight?: number; // pixels per hour, default 60
  onScrollToTime?: (hour: number) => void;
};

export default function ScrollToTimeButtons({
  containerRef,
  hourHeight = 60,
  onScrollToTime,
}: Props) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showScrollToNow, setShowScrollToNow] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Track scroll position to show/hide buttons
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Show "scroll to top" if scrolled down more than 2 hours
      setShowScrollToTop(scrollTop > hourHeight * 2);

      // Show "scroll to bottom" if not near bottom
      setShowScrollToBottom(scrollTop < scrollHeight - clientHeight - hourHeight * 2);

      // Always show "now" button unless already near current time
      const now = new Date();
      const currentTimeOffset = (now.getHours() * 60 + now.getMinutes());
      const isNearNow = Math.abs(scrollTop - currentTimeOffset) < hourHeight * 2;
      setShowScrollToNow(!isNearNow);
    };

    handleScroll(); // Initial check
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, hourHeight]);

  const scrollToHour = (hour: number) => {
    const container = containerRef.current;
    if (!container) return;

    const targetScroll = hour * hourHeight;
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });

    onScrollToTime?.(hour);
  };

  const scrollToNow = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const targetScroll = (currentHour * hourHeight) + (currentMinute) - (hourHeight * 2); // Center on screen

    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth',
    });

    onScrollToTime?.(currentHour);
  };

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
      {/* Scroll to Top */}
      {showScrollToTop && (
        <button
          onClick={() => scrollToHour(0)}
          className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full shadow-lg transition-all duration-200 hover:scale-110 text-white"
          aria-label="Scroll to midnight (12am)"
          title="Scroll to 12am"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {/* Scroll to Now */}
      {showScrollToNow && (
        <button
          onClick={scrollToNow}
          className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 backdrop-blur-md border border-blue-500 rounded-full shadow-lg transition-all duration-200 hover:scale-110 text-white"
          aria-label="Scroll to current time"
          title="Jump to now"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      {/* Scroll to Bottom */}
      {showScrollToBottom && (
        <button
          onClick={() => scrollToHour(23)}
          className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full shadow-lg transition-all duration-200 hover:scale-110 text-white"
          aria-label="Scroll to 11pm"
          title="Scroll to 11pm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}

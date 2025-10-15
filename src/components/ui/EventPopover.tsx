'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  anchor: DOMRect;
  event: {
    title: string;
    start: string; // ISO
    end: string;   // ISO
    where?: string;
    color?: string;
  };
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function EventPopover({
  anchor,
  event,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, flipLeft: false });

  // Format time range
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const timeRange = `${formatTime(event.start)} – ${formatTime(event.end)}`;

  // Calculate position with collision detection
  useEffect(() => {
    if (!popoverRef.current) return;

    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default: position below and to the right of anchor
    let top = anchor.bottom + 8;
    let left = anchor.left;
    let flipLeft = false;

    // Flip up if too close to bottom
    if (top + popoverRect.height > viewportHeight - 16) {
      top = anchor.top - popoverRect.height - 8;
    }

    // Flip left if too close to right edge
    if (left + popoverRect.width > viewportWidth - 16) {
      left = anchor.right - popoverRect.width;
      flipLeft = true;
    }

    // Ensure doesn't go off left edge
    if (left < 16) {
      left = 16;
    }

    setPosition({ top, left, flipLeft });
  }, [anchor]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Close on escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/20 bg-zinc-900/95 backdrop-blur-lg shadow-2xl"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="Event details"
    >
      {/* Header with color accent */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: event.color || '#6366F1' }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">{event.title}</h3>
            <p className="mt-1 text-sm text-white/70">{timeRange}</p>
            {event.where && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.where}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 active:bg-red-500/30 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Arrow pointer */}
      <div
        className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-white/20 bg-zinc-900"
        style={{
          left: position.flipLeft ? 'auto' : '1rem',
          right: position.flipLeft ? '1rem' : 'auto'
        }}
        aria-hidden
      />
    </div>
  );
}

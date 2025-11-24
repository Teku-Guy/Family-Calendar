'use client';

import { useEffect, useRef } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import EventPreviewContent from './EventPreviewContent';
import EventQuickActions from './EventQuickActions';

interface EventPreviewPopoverProps {
  event: any | null;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onEdit: (event: any) => void;
  onDelete: (event: any) => void;
  onDuplicate?: (event: any) => void;
  position?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}

export default function EventPreviewPopover({
  event,
  anchorEl,
  open,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  position = 'auto',
}: EventPreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Floating UI positioning
  const { x, y, strategy, refs } = useFloating({
    placement: position === 'auto' ? 'auto-start' : position,
    middleware: [
      offset(8), // 8px gap from anchor
      flip(), // Flip if no space
      shift({ padding: 16 }), // Keep 16px from viewport edges
    ],
    whileElementsMounted: autoUpdate,
  });

  // Set anchor element
  useEffect(() => {
    if (anchorEl) {
      refs.setReference(anchorEl);
    }
  }, [anchorEl, refs]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Add small delay to avoid immediate close on click that opened popover
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorEl]);

  if (!open || !event) return null;

  return (
    <div
      ref={(node) => {
        popoverRef.current = node;
        refs.setFloating(node);
      }}
      style={{
        position: strategy,
        top: y ?? 0,
        left: x ?? 0,
        zIndex: 50,
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="event-preview-title"
      className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Color indicator */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: event.color || '#3b82f6' }}
      />

      {/* Content */}
      <div className="p-4">
        <EventPreviewContent
          event={event}
          onTimeClick={() => {
            onEdit(event);
            onClose();
          }}
        />

        {/* Quick Actions */}
        <EventQuickActions
          onEdit={() => {
            onEdit(event);
            onClose();
          }}
          onDelete={() => {
            if (confirm(`Delete "${event.title}"?`)) {
              onDelete(event);
              onClose();
            }
          }}
          onDuplicate={
            onDuplicate
              ? () => {
                  onDuplicate(event);
                  onClose();
                }
              : undefined
          }
          isRecurring={!!event._series}
        />
      </div>
    </div>
  );
}

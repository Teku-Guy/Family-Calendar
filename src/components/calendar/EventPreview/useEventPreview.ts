'use client';

import { useState, useCallback, useRef } from 'react';

export interface EventPreviewState {
  event: any | null;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
}

export function useEventPreview() {
  const [previewState, setPreviewState] = useState<EventPreviewState>({
    event: null,
    anchorEl: null,
    isOpen: false,
  });

  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const showPreview = useCallback((event: any, anchorEl: HTMLElement) => {
    setPreviewState({
      event,
      anchorEl,
      isOpen: true,
    });
  }, []);

  const showPreviewWithDelay = useCallback((event: any, anchorEl: HTMLElement, delay = 500) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set new timeout
    hoverTimeoutRef.current = setTimeout(() => {
      showPreview(event, anchorEl);
    }, delay);
  }, [showPreview]);

  const cancelPreview = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewState({
      event: null,
      anchorEl: null,
      isOpen: false,
    });
    cancelPreview();
  }, [cancelPreview]);

  return {
    previewState,
    showPreview,
    showPreviewWithDelay,
    cancelPreview,
    closePreview,
  };
}

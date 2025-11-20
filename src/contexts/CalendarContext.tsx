'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { EventDraft } from '@/types/events';

/**
 * Modal state for event creation/editing
 */
type ModalState = {
  open: boolean;
  mode: 'create' | 'edit';
  draft: EventDraft | null;
};

/**
 * Calendar context value type
 */
type CalendarContextValue = {
  primaryCalendarId: string;
  modalState: ModalState;
  expandedDay: Date | null;
  openEventModal: (draft: EventDraft, mode: 'create' | 'edit') => void;
  closeEventModal: () => void;
  setExpandedDay: (date: Date | null) => void;
  setPrimaryCalendarId: (id: string) => void;
};

/**
 * Default modal state
 */
const defaultModalState: ModalState = {
  open: false,
  mode: 'create',
  draft: null,
};

/**
 * Calendar context for managing shared state across calendar components
 */
const CalendarContext = createContext<CalendarContextValue | null>(null);

/**
 * Provider props
 */
type CalendarProviderProps = {
  children: React.ReactNode;
  initialCalendarId?: string;
};

/**
 * Calendar provider component
 *
 * Manages shared state for modal operations and day expansion.
 */
export function CalendarProvider({
  children,
  initialCalendarId = '',
}: CalendarProviderProps) {
  const [primaryCalendarId, setPrimaryCalendarId] = useState(initialCalendarId);
  const [modalState, setModalState] = useState<ModalState>(defaultModalState);
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);

  const openEventModal = useCallback(
    (draft: EventDraft, mode: 'create' | 'edit') => {
      setModalState({
        open: true,
        mode,
        draft,
      });
    },
    []
  );

  const closeEventModal = useCallback(() => {
    setModalState(defaultModalState);
  }, []);

  const value: CalendarContextValue = {
    primaryCalendarId,
    modalState,
    expandedDay,
    openEventModal,
    closeEventModal,
    setExpandedDay,
    setPrimaryCalendarId,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

/**
 * Hook to access calendar context
 *
 * @throws Error if used outside of CalendarProvider
 */
export function useCalendarContext(): CalendarContextValue {
  const context = useContext(CalendarContext);

  if (!context) {
    throw new Error(
      'useCalendarContext must be used within a CalendarProvider'
    );
  }

  return context;
}

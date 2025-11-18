/**
 * Toast Notification System
 *
 * A lightweight toast notification system for showing success/error/info messages.
 * No external dependencies - uses React context and basic animations.
 *
 * @example
 * ```tsx
 * const { push } = useToast();
 * push({ title: 'Event created!', kind: 'success' });
 * push({ title: 'Failed to save', kind: 'error' });
 * ```
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Toast = {
  id: string;
  title: string;
  kind?: 'success' | 'error' | 'info';
  timeout?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toast Provider Component
 *
 * Wraps your app to provide toast notification functionality.
 * Place this in your root layout.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 11);
    const newToast: Toast = {
      id,
      kind: 'info',
      timeout: 3500,
      ...toast,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  // Auto-remove toasts after their timeout
  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => remove(toast.id), toast.timeout)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, remove]);

  const value = useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container - Fixed bottom-right */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const styles = {
            success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
            error: 'border-red-400/30 bg-red-400/10 text-red-200',
            info: 'border-white/20 bg-white/10 text-white',
          };

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto animate-slide-in-right rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur transition-all ${
                styles[toast.kind || 'info']
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1">{toast.title}</span>
                <button
                  onClick={() => remove(toast.id)}
                  className="shrink-0 opacity-60 hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add animation keyframes via global styles */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

/**
 * useToast Hook
 *
 * Access toast functionality in any component.
 * Must be used within a ToastProvider.
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

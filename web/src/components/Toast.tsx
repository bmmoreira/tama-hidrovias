'use client';

import React from 'react';
import { useEffect } from 'react';
import clsx from 'clsx';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

export type ToastProps = {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
  durationMs?: number;
};

export default function Toast({
  message,
  variant = 'success',
  onClose,
  durationMs = 4000,
}: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, onClose]);

  return (
    <div
      className={clsx(
        'fixed right-4 top-4 z-[80] flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur',
        variant === 'success'
          ? 'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/95 dark:text-emerald-100'
          : 'border-red-200 bg-red-50/95 text-red-900 dark:border-red-900 dark:bg-red-950/95 dark:text-red-100',
      )}
      role="status"
      aria-live="polite"
    >
      {variant === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 text-current/70 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/5"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: 'danger' | 'primary';
  icon?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  loading = false,
  tone = 'danger',
  icon,
  children,
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        data-testid="confirmation-backdrop"
      />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-start gap-3">
              {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
              <div>
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                {description ? (
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            {children}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60',
                  tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700',
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Props for the generic confirmation modal used before destructive actions.
 */
export type ConfirmationModalProps = {
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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton={loading}
        className="max-w-md rounded-2xl border border-border bg-card p-0"
        onPointerDownOutside={(event) => {
          if (loading) {
            event.preventDefault();
          }
        }}
      >
        <div data-testid="confirmation-backdrop" className="sr-only" />
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="flex-row items-start gap-3 space-y-0 pr-10">
            {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
            <div>
              <DialogTitle className="text-base text-gray-900 dark:text-slate-100">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {children}

          <DialogFooter className="pt-1">
            <DialogClose asChild>
              <button
                type="button"
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {cancelLabel}
              </button>
            </DialogClose>
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
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
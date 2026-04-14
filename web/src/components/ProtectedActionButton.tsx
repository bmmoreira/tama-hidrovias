'use client';

import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Props for {@link ProtectedActionButton}, combining native button attributes
 * with role-based access control flags.
 */
export type ProtectedActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  allowed: boolean;
  helperText?: string;
  deniedReason?: string;
  children: ReactNode;
};

export default function ProtectedActionButton({
  allowed,
  className,
  children,
  deniedReason = 'Você não tem permissão para executar esta ação.',
  disabled,
  helperText,
  title,
  ...props
}: ProtectedActionButtonProps) {
  const isDisabled = disabled || !allowed;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        {...props}
        disabled={isDisabled}
        title={isDisabled ? deniedReason : title}
        variant="default"
        className={clsx('disabled:bg-gray-300 disabled:text-gray-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500', className)}
      >
        {children}
      </Button>
      {!allowed && helperText ? (
        <p className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
          <Lock className="h-3 w-3" />
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
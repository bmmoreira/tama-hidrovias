'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Lock } from 'lucide-react';

type ProtectedActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
      <button
        {...props}
        disabled={isDisabled}
        title={isDisabled ? deniedReason : title}
        className={clsx(
          'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition',
          'disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-100',
          'enabled:bg-blue-600 enabled:hover:bg-blue-700',
          className,
        )}
      >
        {children}
      </button>
      {!allowed && helperText ? (
        <p className="inline-flex items-center gap-1 text-xs text-gray-400">
          <Lock className="h-3 w-3" />
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
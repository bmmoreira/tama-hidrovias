import React from 'react';
import clsx from 'clsx';
import { Eye } from 'lucide-react';

type ReadOnlyBadgeProps = {
  className?: string;
  label?: string;
  title?: string;
};

export default function ReadOnlyBadge({
  className,
  label = 'Modo leitura',
  title = 'Seu perfil pode visualizar dados, mas não executar ações de escrita.',
}: ReadOnlyBadgeProps) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
        className,
      )}
    >
      <Eye className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
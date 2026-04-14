import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

/** Small metric card used on the dashboard overview. */
export interface SummaryCardProps {
  title: string;
  value: string | number;
  Icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'purple';
  description?: string;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-sky-950/40',
    icon: 'bg-blue-100 text-blue-700 dark:bg-sky-900 dark:text-sky-300',
    value: 'text-blue-700 dark:text-sky-300',
  },
  green: {
    bg: 'bg-green-50 dark:bg-emerald-950/40',
    icon: 'bg-green-100 text-green-700 dark:bg-emerald-900 dark:text-emerald-300',
    value: 'text-green-700 dark:text-emerald-300',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    value: 'text-amber-700 dark:text-amber-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-violet-950/40',
    icon: 'bg-purple-100 text-purple-700 dark:bg-violet-900 dark:text-violet-300',
    value: 'text-purple-700 dark:text-violet-300',
  },
};

export default function SummaryCard({
  title,
  value,
  Icon,
  color = 'blue',
  description,
}: SummaryCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={clsx(
        'rounded-2xl border border-gray-100 p-5 shadow-sm dark:border-slate-800',
        colors.bg,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
          <p className={clsx('mt-1 text-3xl font-bold', colors.value)}>
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{description}</p>
          )}
        </div>
        <div className={clsx('rounded-xl p-3', colors.icon)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

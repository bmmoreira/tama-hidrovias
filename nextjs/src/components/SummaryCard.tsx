import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface SummaryCardProps {
  title: string;
  value: string | number;
  Icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'purple';
  description?: string;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-700',
    value: 'text-blue-700',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-700',
    value: 'text-green-700',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    value: 'text-amber-700',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-700',
    value: 'text-purple-700',
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
        'rounded-2xl border border-gray-100 p-5 shadow-sm',
        colors.bg,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={clsx('mt-1 text-3xl font-bold', colors.value)}>
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-400">{description}</p>
          )}
        </div>
        <div className={clsx('rounded-xl p-3', colors.icon)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

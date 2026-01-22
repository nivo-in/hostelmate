import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'default';
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  let colorClass = 'bg-gray-100 text-gray-700';

  if (variant === 'success') colorClass = 'bg-green-50 text-green-700';
  else if (variant === 'danger') colorClass = 'bg-red-50 text-red-700';
  else if (variant === 'warning') colorClass = 'bg-yellow-50 text-yellow-700';

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>{children}</span>
  );
}

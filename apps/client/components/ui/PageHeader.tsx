'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const NotificationBell = dynamic(() => import('./NotificationBell').then(m => ({ default: m.NotificationBell })), {
  ssr: false,
  loading: () => <div className="w-6 h-6" />,
})

type PageHeaderProps = {
  title: string;
  showBack?: boolean;
  onSignOut: () => void;
};

export function PageHeader({ title, showBack, onSignOut }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex flex-col gap-0.5">
        {showBack ? (
          // Sub-page: show back button only, "by Nivo" is in fixed bottom-left via layout
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-400 hover:text-gray-600 self-start transition-colors"
          >
            ← Back
          </button>
        ) : (
          // Home page: show "by Nivo" prominently at top-left
          <p className="text-xs uppercase text-gray-400 tracking-widest font-medium">by Nivo</p>
        )}
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <button
          onClick={onSignOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

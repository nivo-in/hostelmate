'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

type PageHeaderProps = {
  title: string;
  showBack?: boolean;
  onSignOut: () => void;
};

export function PageHeader({ title, showBack, onSignOut }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex flex-col gap-2">
        {showBack && (
          <button 
            onClick={() => router.back()} 
            className="text-xs text-gray-400 hover:text-gray-600 self-start transition-colors"
          >
            ← Back
          </button>
        )}
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">{title}</h1>
      </div>
      <button 
        onClick={onSignOut}
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const NotificationBell = dynamic(
  () => import('./NotificationBell').then((m) => ({ default: m.NotificationBell })),
  {
    ssr: false,
    loading: () => <div className="w-6 h-6" />,
  }
);

type PageHeaderProps = {
  title: string;
  showBack?: boolean;
  backHref?: string;
  onSignOut: () => void;
};

export function PageHeader({ title, showBack, backHref, onSignOut: _onSignOut }: PageHeaderProps) {
  const pathname = usePathname();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const executeSignOut = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    
    // Fire-and-forget sign out without awaiting
    import('@/lib/supabase/client')
      .then(({ createClient }) => createClient().auth.signOut())
      .catch((error) => console.error('Sign out error:', error));
      
    // Instant zero-latency redirect
    window.location.href = '/login';
  };

  // Infer the dashboard href if backHref isn't provided (e.g. /warden/complaints -> /warden/dashboard)
  let finalBackHref = backHref;
  if (showBack && !finalBackHref && pathname) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      finalBackHref = `/${segments[0]}/dashboard`;
    }
  }

  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex flex-col gap-0.5">
        {showBack ? (
          // Sub-page: show back button only, "by Nivo" is in fixed bottom-left via layout
          finalBackHref ? (
            <a
              href={finalBackHref}
              className="text-xs text-gray-400 hover:text-gray-600 self-start transition-colors"
            >
              ← Back
            </a>
          ) : (
            <button
              onClick={() => window.history.back()}
              className="text-xs text-gray-400 hover:text-gray-600 self-start transition-colors"
            >
              ← Back
            </button>
          )
        ) : (
          // Home page: show "by Nivo" prominently at top-left
          <p className="text-xs uppercase text-gray-400 tracking-widest font-medium">by Nivo</p>
        )}
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <button
          onClick={() => setShowConfirm(true)}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign Out
        </button>

        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 border border-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sign Out</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to sign out?</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isSigningOut}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeSignOut}
                  disabled={isSigningOut}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

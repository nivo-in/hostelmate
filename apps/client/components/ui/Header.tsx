'use client';

import { useState } from 'react';

interface HeaderProps {
  title: string;
  onSignOut: () => void;
}

export function Header({ title, onSignOut: _onSignOut }: HeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const executeSignOut = () => {
    if (isSigningOut) {return;}
    setIsSigningOut(true);
    
    // Fire-and-forget sign out without awaiting
    import('@/lib/supabase/client')
      .then(({ createClient }) => createClient().auth.signOut())
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Sign out error:', error);
      });
      
    // Instant zero-latency redirect
    window.location.href = '/login';
  };
  return (
    <header className="flex justify-between items-center mb-10">
      <div>
        <p className="text-xs uppercase text-gray-400 tracking-widest font-medium">by Nivo</p>
        <h1 className="text-2xl font-medium text-gray-900">{title}</h1>
      </div>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Sign out
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
    </header>
  );
}

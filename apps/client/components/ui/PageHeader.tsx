'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

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
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const executeSignOut = async () => {
    if (isSigningOut) {return;}
    setIsSigningOut(true);
    
    try {
      await _onSignOut();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
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
    <div style={{
      background: 'rgba(8,8,16,0.8)',
      backdropFilter: 'blur(16px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {showBack && (
          finalBackHref ? (
            <Link
              href={finalBackHref}
              style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
            >
              ← Back
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
            >
              ← Back
            </button>
          )
        )}
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0, marginLeft: showBack ? '12px' : '0' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <NotificationBell />
        <button
          onClick={() => setShowConfirm(true)}
          style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          Sign Out
        </button>

        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-[#111] rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 border border-white/10">
              <h3 className="text-lg font-medium text-white mb-2">Sign Out</h3>
              <p className="text-sm text-gray-400 mb-6">Are you sure you want to sign out?</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isSigningOut}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
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

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Error boundary for every dashboard route. Catches errors thrown during render
 * or in effects (e.g. an unhandled `useApi` rejection when an endpoint returns a
 * non-OK response) so a single failed request degrades gracefully instead of
 * crashing the whole page with the Next.js error overlay.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        background: '#080810',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '900px',
          height: '600px',
          pointerEvents: 'none',
          zIndex: 0,
          background: 'radial-gradient(ellipse at center, rgba(248,113,113,0.08) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '36px 32px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            background: 'rgba(248,113,113,0.1)',
            border: '0.5px solid rgba(248,113,113,0.25)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={{ fontSize: '17px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', margin: '0 0 8px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 24px' }}>
          We couldn&apos;t load this page. This is usually temporary — try again, or sign in
          again if the problem persists.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              background: '#fff',
              color: '#080810',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/login')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}

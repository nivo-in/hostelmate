import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  /** Spotlight tint at the top of the page. Defaults to the warden purple accent. */
  spotlight?: string;
  title?: string;
  subtitle?: string;
};

/**
 * Dark glassmorphism page backdrop matching the warden dashboard:
 * #080810 base, a soft radial spotlight, and the shared hover/animation classes
 * (.glass-card, .row-hover) used across feature pages.
 */
export function PageShell({ children, spotlight = 'rgba(124,92,252,0.1)', title, subtitle }: PageShellProps) {
  return (
    <div style={{ background: '#080810', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
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
          background: `radial-gradient(ellipse at center, ${spotlight} 0%, transparent 70%)`,
          animation: 'spotlightFade 1.2s ease-out forwards',
          opacity: 0,
        }}
      />
      <style>{`
        @keyframes spotlightFade { to { opacity: 1; } }
        @keyframes pageEnter { from { opacity: 0; } to { opacity: 1; } }
        /* Opacity-only entrance — never transform here, it would break the
           sticky PageHeader by creating a containing block. */
        .page-enter { animation: pageEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) { .page-enter { animation: none; } }
        .glass-card { transition: all 0.25s ease; }
        .glass-card:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .row-hover { transition: background 0.15s ease; }
        .row-hover:hover { background: rgba(255,255,255,0.03) !important; }
        .hm-input::placeholder { color: rgba(255,255,255,0.25); }
        .hm-input:focus { border-color: rgba(124,92,252,0.5) !important; }
        select.hm-input option { background: #14141f; color: #fff; }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-ghost:hover { color: rgba(255,255,255,0.9) !important; border-color: rgba(255,255,255,0.2) !important; }
      `}</style>
      <div className="page-enter" style={{ position: 'relative', zIndex: 1 }}>
        {title && (
          <div style={{ padding: '24px 32px 0', maxWidth: '1100px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 500, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0' }}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

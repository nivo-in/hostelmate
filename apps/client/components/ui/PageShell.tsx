import type { ReactNode } from 'react';

/**
 * Props for the PageShell component.
 */
type PageShellProps = {
  /** The children nodes to render within the page layout */
  children: ReactNode;
  /** Radial spotlight background colour tint. Defaults to warden purple accent ('rgba(124,92,252,0.1)'). */
  spotlight?: string;
  /** Optional page title header text rendered at the top */
  title?: string;
  /** Optional secondary subtitle text rendered beneath the title */
  subtitle?: string;
};

/**
 * Global dark glassmorphism layout shell component.
 * Provides a uniform base styling (`#080810`), custom keyframe animations,
 * role-specific spotlight backdrops, and common input styles.
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
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
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
        .hm-input-blue:focus { border-color: rgba(96,165,250,0.5) !important; }
        .hm-input-orange:focus { border-color: rgba(251,146,60,0.5) !important; }
        select.hm-input option { background: #14141f; color: #fff; }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-ghost:hover { color: rgba(255,255,255,0.9) !important; border-color: rgba(255,255,255,0.2) !important; }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 37%, rgba(255,255,255,0.04) 63%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
          border-radius: 6px;
        }
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

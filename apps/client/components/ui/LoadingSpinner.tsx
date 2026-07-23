/**
 * @file apps/client/components/ui/LoadingSpinner.tsx
 * Shared client component for layout renders and user interaction flows.
 */

type LoadingSpinnerProps = {
  /** Accent colour for the spinner arc. Defaults to warden purple. */
  color?: string;
  /** Size in pixels for the spinner ring. Defaults to 22. */
  size?: number;
  /** Optional label shown beneath the spinner. Defaults to "Loading…". */
  label?: string;
};

/**
 * Minimal dark-theme loading spinner used across all dashboard pages.
 * Accepts a role-specific accent colour so it matches the active theme:
 *  - Warden: `#7c5cfc` (default)
 *  - Student: `#fb923c`
 *  - Parent:  `#60a5fa`
 */
export function LoadingSpinner({ color = 'rgba(124,92,252,0.9)', size = 22, label = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '48px 24px',
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'hmSpin 0.7s linear infinite',
        }}
      />
      {label && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{label}</p>}
      <style>{`@keyframes hmSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

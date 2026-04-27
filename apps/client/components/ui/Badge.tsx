import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default' | 'purple' | 'orange';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /** Optional dot indicator shown before the label */
  dot?: boolean;
};

const styles: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.12)' },
  success: { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '0.5px solid rgba(74,222,128,0.25)' },
  danger:  { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '0.5px solid rgba(248,113,113,0.25)' },
  warning: { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.25)' },
  info:    { background: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.25)' },
  purple:  { background: 'rgba(124,92,252,0.12)', color: '#7c5cfc', border: '0.5px solid rgba(124,92,252,0.25)' },
  orange:  { background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '0.5px solid rgba(251,146,60,0.25)' },
};

const dotColor: Record<BadgeVariant, string> = {
  default: 'rgba(255,255,255,0.5)',
  success: '#4ade80',
  danger:  '#f87171',
  warning: '#fbbf24',
  info:    '#60a5fa',
  purple:  '#7c5cfc',
  orange:  '#fb923c',
};

/**
 * Status/label badge used across all dashboard pages.
 * Supports 7 colour variants (default, success, danger, warning, info, purple, orange)
 * and an optional leading dot indicator.
 */
export function Badge({ children, variant = 'default', dot = false }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...styles[variant],
      }}
    >
      {dot && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: dotColor[variant],
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
};

const styles: Record<string, React.CSSProperties> = {
  default: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.12)' },
  success: { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '0.5px solid rgba(74,222,128,0.25)' },
  danger: { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '0.5px solid rgba(248,113,113,0.25)' },
  warning: { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.25)' },
  info: { background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.25)' },
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

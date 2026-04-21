import type { ReactNode } from 'react';

type EmptyStateProps = {
  message: string;
  icon?: ReactNode;
};

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '48px 24px',
      }}
    >
      {icon && <div style={{ fontSize: '32px', opacity: 0.5 }}>{icon}</div>}
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>{message}</p>
    </div>
  );
}

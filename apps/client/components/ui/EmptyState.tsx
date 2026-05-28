/**
 * @file apps/client/components/ui/EmptyState.tsx
 * Shared client component for layout renders and user interaction flows.
 */

import type { ReactNode } from 'react';

type EmptyStateProps = {
  message: string;
  subtitle?: string;
  icon?: ReactNode;
};

/**
 * Generic empty-state placeholder used across all dashboard pages.
 * Renders a centred icon tile (glassmorphism), a bold message, and an
 * optional subtitle. All wrapped in a low-opacity container so it blends
 * naturally into the dark #080810 background.
 */
export function EmptyState({ message, subtitle, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{message}</p>
      {subtitle && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{subtitle}</p>
      )}
    </div>
  );
}

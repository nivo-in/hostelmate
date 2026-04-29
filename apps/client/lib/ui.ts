import type { CSSProperties } from 'react';

/**
 * Dark glassmorphism design tokens for the HostelMate dashboard.
 * Mirrors the warden dashboard aesthetic so every feature page stays pixel-consistent.
 */
export const ui = {
  // Surfaces
  bg: '#080810',
  panel: 'rgba(255,255,255,0.03)',
  panelHover: 'rgba(255,255,255,0.06)',
  panelElevated: 'rgba(255,255,255,0.07)',
  panelStrong: 'rgba(255,255,255,0.08)',

  // Borders
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderStrong: '0.5px solid rgba(255,255,255,0.12)',
  borderHover: '0.5px solid rgba(255,255,255,0.18)',

  // Text
  text: 'rgba(255,255,255,0.85)',
  textSoft: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  textFaint: 'rgba(255,255,255,0.3)',
  textGhost: 'rgba(255,255,255,0.22)',

  // Accents
  accent: '#7c5cfc',
  accentSpotlight: 'rgba(124,92,252,0.1)',
  green: '#4ade80',
  amber: '#fbbf24',
  red: '#f87171',
  blue: '#60a5fa',
  orange: '#fb923c',

  // Role-specific accent colours
  /** Warden portal accent — default purple */
  wardenAccent: '#7c5cfc',
  wardenAccentAlpha: 'rgba(124,92,252,0.15)',
  /** Student portal accent — warm orange */
  studentAccent: '#fb923c',
  studentAccentAlpha: 'rgba(251,146,60,0.15)',
  /** Parent portal accent — sky blue */
  parentAccent: '#60a5fa',
  parentAccentAlpha: 'rgba(96,165,250,0.15)',

  // Radii
  radius: '16px',
  radiusSm: '12px',
  radiusXs: '10px',
} as const;

/** Glass panel — the standard content card. */
export const panel: CSSProperties = {
  background: ui.panel,
  border: ui.border,
  borderRadius: ui.radius,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

/** Slightly elevated panel for stat tiles and emphasis. */
export const panelElevated: CSSProperties = {
  background: ui.panelElevated,
  border: ui.borderStrong,
  borderRadius: '14px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
};

/** Form input / select / textarea. */
export const input: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: ui.radiusXs,
  padding: '10px 12px',
  fontSize: '13px',
  color: ui.text,
  outline: 'none',
};

/** Primary (accent) button. */
export const buttonPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  background: ui.accent,
  border: 'none',
  borderRadius: ui.radiusXs,
  padding: '9px 16px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#fff',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

/** Secondary / ghost button. */
export const buttonGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  background: 'rgba(255,255,255,0.05)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: ui.radiusXs,
  padding: '9px 16px',
  fontSize: '13px',
  fontWeight: 500,
  color: ui.textSoft,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

/** Centered content container that sits under the sticky PageHeader. */
export const container: CSSProperties = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '28px 32px 64px',
  position: 'relative',
  zIndex: 1,
};

/** Label text above values. */
export const label: CSSProperties = {
  fontSize: '11px',
  color: ui.textMuted,
  marginBottom: '8px',
};

/** Section heading. */
export const sectionTitle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 500,
  color: ui.text,
  margin: 0,
};

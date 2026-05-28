/**
 * @file apps/client/components/ui/TiltCard.tsx
 * Shared client component for layout renders and user interaction flows.
 */

'use client';

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Props for the TiltCard component.
 */
type TiltCardProps = {
  /** React children rendered inside the card */
  children: ReactNode;
  /** Optional click handler callback */
  onClick?: () => void;
  /** Optional mouse/pointer hover entry callback */
  onMouseEnter?: () => void;
  /** Glow spotlight hex/rgb color code. Defaults to white. */
  accent?: string;
  /** Maximum tilt angle in degrees. Defaults to 3. */
  max?: number;
  /** Optional CSS class name */
  className?: string;
  /** Inline CSS styles */
  style?: CSSProperties;
};

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 3D card tilt animation component with hardware-accelerated pointer tracking.
 * Smoothly tilts the card towards the pointer and renders a custom radial glow spotlight.
 * Automatically respects `prefers-reduced-motion` preferences.
 */

export function TiltCard({
  children,
  onClick,
  onMouseEnter,
  accent = '#ffffff',
  max = 3,
  className,
  style,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const cur = useRef({ rx: 0, ry: 0, gx: 50, gy: 50, glow: 0 });
  const tgt = useRef({ rx: 0, ry: 0, gx: 50, gy: 50, glow: 0 });
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    let raf: number | null = null;
    const animate = () => {
      const c = cur.current;
      const t = tgt.current;
      // Increased from 0.12 to 0.35 for much faster, snappier response
      c.rx += (t.rx - c.rx) * 0.35;
      c.ry += (t.ry - c.ry) * 0.35;
      c.gx += (t.gx - c.gx) * 0.4;
      c.gy += (t.gy - c.gy) * 0.4;
      c.glow += (t.glow - c.glow) * 0.35;

      const el = ref.current;
      if (el) {
        el.style.transform = `perspective(1200px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg)`;
      }
      const g = glowRef.current;
      if (g) {
        g.style.opacity = c.glow.toFixed(3);
        g.style.background = `radial-gradient(240px circle at ${c.gx.toFixed(1)}% ${c.gy.toFixed(1)}%, ${accent}18, transparent 60%)`;
      }

      const settled =
        Math.abs(t.rx - c.rx) < 0.02 &&
        Math.abs(t.ry - c.ry) < 0.02 &&
        Math.abs(t.glow - c.glow) < 0.01 &&
        Math.abs(t.gx - c.gx) < 0.1 &&
        Math.abs(t.gy - c.gy) < 0.1;
      raf = settled ? null : requestAnimationFrame(animate);
    };

    kickRef.current = () => {
      if (raf === null) {raf = requestAnimationFrame(animate);}
    };
    return () => {
      if (raf) {cancelAnimationFrame(raf);}
    };
  }, [accent]);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch' || reduced()) {return;}
      const el = ref.current;
      if (!el) {return;}
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tgt.current.ry = (px - 0.5) * 2 * max;
      tgt.current.rx = -(py - 0.5) * 2 * max;
      tgt.current.gx = px * 100;
      tgt.current.gy = py * 100;
      kickRef.current();
    },
    [max]
  );

  const onLeave = useCallback(() => {
    tgt.current.rx = 0;
    tgt.current.ry = 0;
    tgt.current.glow = 0;
    kickRef.current();
  }, []);

  const onEnter = useCallback(() => {
    if (!reduced()) {
      tgt.current.glow = 1;
    }
    kickRef.current();
    onMouseEnter?.();
  }, [onMouseEnter]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerEnter={onEnter}
      className={className}
      style={{
        ...style,
        position: 'relative',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
    >
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0,
          willChange: 'opacity, background',
          borderRadius: 'inherit',
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
}
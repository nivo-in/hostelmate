'use client';

import { useEffect, useRef } from 'react';

type CursorGlowProps = {
  /** Full rgba() glow colour. Keep it faint — it sits behind the content. */
  color?: string;
  /** Diameter of the glow in px. */
  size?: number;
};

/**
 * A soft ambient glow that lazily trails the pointer behind the page content.
 * Spring-smoothed in a single rAF loop, transform-only, and disabled on
 * coarse/touch pointers and prefers-reduced-motion. Purely decorative.
 */
export function CursorGlow({ color = 'rgba(124,92,252,0.07)', size = 600 }: CursorGlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const cur = { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
    const tgt = { ...cur };
    let raf: number | null = null;

    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.1;
      cur.y += (tgt.y - cur.y) * 0.1;
      const el = ref.current;
      if (el) el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
      if (Math.abs(tgt.x - cur.x) > 0.5 || Math.abs(tgt.y - cur.y) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      tgt.x = e.clientX;
      tgt.y = e.clientY;
      if (raf == null) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: -size / 2,
        left: -size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'transform',
        mixBlendMode: 'plus-lighter',
      }}
    />
  );
}
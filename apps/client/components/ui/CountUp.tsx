/**
 * @file apps/client/components/ui/CountUp.tsx
 * Shared client component for layout renders and user interaction flows.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

/**
 * Animates a number from its previous value up to `value` with an ease-out
 * curve. Starts at 0 on first mount for a clean count-up entrance, then tweens
 * between updates (e.g. cached → fresh data). Honours prefers-reduced-motion.
 */
export function CountUp({ value, durationMs = 1000, decimals = 0, prefix = '', suffix = '' }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {return;}

    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(from + (to - from) * ease(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    if (rafRef.current) {cancelAnimationFrame(rafRef.current);}
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {cancelAnimationFrame(rafRef.current);}
    };
  }, [value, durationMs]);

  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  return (
    <>
      {prefix}
      {shown}
      {suffix}
    </>
  );
}

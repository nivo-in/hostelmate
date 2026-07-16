'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** Entrance delay in ms — use to stagger siblings (e.g. index * 45). */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
  /** Animation duration in ms. */
  duration?: number;
  /** How far below the viewport (as % of viewport height) to pre-trigger. */
  preload?: number;
  /** Re-hide and replay when scrolled back out of view. Default reveals once. */
  replay?: boolean;
  style?: CSSProperties;
  className?: string;
};

// Shared easing — matches the landing page's premium ease-out curve.
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Scroll-reveal wrapper: fades + slides its children in when they enter the
 * viewport. Animates only opacity/transform (GPU-friendly), uses a single
 * IntersectionObserver, and honours prefers-reduced-motion. Stagger groups of
 * siblings by passing an increasing `delay`.
 */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  duration = 460,
  preload = 15,
  replay = false,
  style,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {return;}

    // No IO or reduced motion → show immediately, no animation.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof IntersectionObserver === 'undefined' || reduce) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (!replay) {observer.disconnect();}
        } else if (replay) {
          setShown(false);
        }
      },
      // Pre-trigger while the element is still `preload`% below the viewport so
      // it has finished (or nearly) animating by the time it scrolls into view —
      // no late "pop". A tiny threshold fires as soon as any sliver qualifies.
      { threshold: 0.01, rootMargin: `0px 0px ${preload}% 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [replay, preload]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity ${duration}ms ${EASE} ${delay}ms, transform ${duration}ms ${EASE} ${delay}ms`,
        willChange: shown ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

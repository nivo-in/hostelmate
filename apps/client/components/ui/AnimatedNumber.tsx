/**
 * @file apps/client/components/ui/AnimatedNumber.tsx
 * Shared client component for layout renders and user interaction flows.
 */

'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Props for the AnimatedNumber component.
 */
interface AnimatedNumberProps {
  /** The target numeric value to animate towards */
  value: number;
  /** Animation duration in milliseconds (default: 1200ms) */
  duration?: number;
  /** Optional string appended after the number (e.g. '%', 'ms') */
  suffix?: string;
  /** Optional string prepended before the number (e.g. '₹', '$') */
  prefix?: string;
  /** If true, formats with commas using en-IN locale (e.g. 1,23,456) */
  format?: boolean;
}

/**
 * Counts up from 0 to `value` using an easeOutExpo curve.
 * Re-triggers the animation whenever `value` changes.
 * Commonly used in dashboard stat tiles for engaging data reveals.
 */

export function AnimatedNumber({ value, duration = 1200, suffix = '', prefix = '', format = false }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrame: number;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {startTimeRef.current = timestamp;}
      const progress = timestamp - startTimeRef.current;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing function (easeOutExpo)
      const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      
      setDisplayValue(Math.floor(ease * value));

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  const formattedStr = format ? displayValue.toLocaleString('en-IN') : displayValue.toString();

  return <>{prefix}{formattedStr}{suffix}</>;
}

'use client';

import { useEffect, useState } from 'react';

/**
 * Props for the AnimatedProgress component.
 */
interface AnimatedProgressProps {
  /** Target percentage fill value (0 to 100) */
  value: number;
  /** Fill background CSS color value (e.g. '#60a5fa' or a theme gradient) */
  color: string;
  /** Transition sweep duration in milliseconds (default: 1200ms) */
  duration?: number;
}

/**
 * Animated linear horizontal progress bar indicator.
 * Animates its width towards the target percentage using a custom easeOut cubic-bezier transition.
 */

export function AnimatedProgress({ value, color, duration = 1200 }: AnimatedProgressProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Small delay to ensure the component is mounted and the transition registers
    const timer = setTimeout(() => setWidth(value), 50);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div
      style={{
        width: `${width}%`,
        height: '100%',
        background: color,
        transition: `width ${duration}ms cubic-bezier(0.2, 0.9, 0.4, 1)`,
      }}
    />
  );
}

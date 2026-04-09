'use client';

import { useEffect, useState } from 'react';

interface AnimatedProgressProps {
  value: number; // percentage (0 to 100)
  color: string;
  duration?: number;
}

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

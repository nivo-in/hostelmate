import { useState, useEffect, useRef } from 'react';

/**
 * Throttles a value so it updates at most once per `interval` ms.
 * Unlike `useDebounce` (which delays the final value), `useThrottle`
 * lets through the first update immediately then blocks subsequent
 * changes until the interval expires.
 *
 * Useful for scroll handlers, resize observers, or any high-frequency
 * value that drives expensive renders.
 *
 * @template T - Type of the value being throttled
 * @param {T} value - The rapidly-changing source value
 * @param {number} interval - Minimum ms between state updates (e.g. 200)
 * @returns {T} The throttled value
 *
 * @example
 * const throttledScroll = useThrottle(scrollY, 100);
 * // throttledScroll updates at most 10 times per second
 */
export function useThrottle<T>(value: T, interval = 200): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timeout = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timeout);
    }
  }, [value, interval]);

  return throttledValue;
}

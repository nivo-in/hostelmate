import { useState, useEffect } from 'react';

/**
 * Delays updating the returned value until `delay` ms have passed since
 * the last change to `value`. Useful for search inputs to avoid firing
 * expensive API calls or useMemo recalculations on every keystroke.
 *
 * @template T - Type of the value being debounced
 * @param {T} value - The source value to debounce
 * @param {number} delay - Debounce interval in milliseconds (e.g. 300)
 * @returns {T} The debounced value
 *
 * @example
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * useEffect(() => { fetchResults(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * @file apps/client/hooks/useIsMounted.ts
 * Custom React hook managing local state and side effects.
 */

import { useState, useEffect } from 'react';

export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}

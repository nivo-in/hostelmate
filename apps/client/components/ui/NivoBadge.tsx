'use client';

import { usePathname } from 'next/navigation';

const HOME_PATHS = ['/warden/dashboard', '/student/dashboard', '/parent/dashboard'];

export function NivoBadge() {
  const pathname = usePathname();
  const isHomePage = HOME_PATHS.some((p) => pathname.endsWith(p));

  if (isHomePage) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 pointer-events-none select-none">
      <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">by Nivo</span>
    </div>
  );
}

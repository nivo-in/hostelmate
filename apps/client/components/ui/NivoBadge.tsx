'use client';

import { usePathname } from 'next/navigation';

const HOME_PATHS = ['/warden/dashboard', '/student/dashboard', '/parent/dashboard'];

/**
 * Renders a small "by Nivo" watermark badge fixed in the bottom-right corner
 * of the screen. Automatically hides itself on the three dashboard home pages
 * (student, warden, parent) where the branding is already prominent in the
 * top-bar header.
 */
export function NivoBadge() {
  const pathname = usePathname();
  const isHomePage = HOME_PATHS.some((p) => pathname.endsWith(p));

  if (isHomePage) {return null;}

  return (
    <div
      className="fixed bottom-5 right-5 z-40 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.15)',
          fontWeight: 500,
          fontFamily: 'inherit',
        }}
      >
        by Nivo
      </span>
    </div>
  );
}

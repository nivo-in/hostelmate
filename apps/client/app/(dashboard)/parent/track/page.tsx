/**
 * @file apps/client/app/(dashboard)/parent/track/page.tsx
 * Parent portal track monitoring page rendering ward status and payment options.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/ui/PageShell';

export default function ParentTrack() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/parent/dashboard');
  }, [router]);

  return (
    <PageShell title="Track Ward" subtitle="Redirecting to dashboard...">
      <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
        Redirecting to dashboard...
      </div>
    </PageShell>
  );
}

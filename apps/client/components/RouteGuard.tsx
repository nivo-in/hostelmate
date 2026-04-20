'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Fast path: role is already embedded in the JWT claims (app_metadata or
      // user_metadata) — no extra DB round-trip needed.
      const user = session.user;
      let role: string | undefined = user.app_metadata?.role ?? user.user_metadata?.role;

      // Slow path: if the role wasn't stored in JWT claims, fall back to DB.
      if (!role) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role;
      }

      // Determine required role from path
      let requiredRole: string | null = null;
      if (pathname.startsWith('/warden')) {requiredRole = 'warden';}
      if (pathname.startsWith('/student')) {requiredRole = 'student';}
      if (pathname.startsWith('/parent')) {requiredRole = 'parent';}

      if (requiredRole && role !== requiredRole) {
        router.push(`/${role}/dashboard`);
      } else {
        setAuthorized(true);
      }
    };

    checkAuth();
  }, [pathname]);

  if (authorized === null) {
    return (
      <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', border: '1.5px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.6)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Verifying access...
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

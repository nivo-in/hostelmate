'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const role = profile?.role;
      
      // Determine required role from path
      let requiredRole = null;
      if (pathname.startsWith('/warden')) requiredRole = 'warden';
      if (pathname.startsWith('/student')) requiredRole = 'student';
      if (pathname.startsWith('/parent')) requiredRole = 'parent';

      if (requiredRole && role !== requiredRole) {
        // User is trying to access a route they don't have permission for
        router.push(`/${role}/dashboard`);
      } else {
        setAuthorized(true);
      }
    };

    checkAuth();
  }, [pathname, router, supabase]);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-sm text-gray-400">Verifying access...</div>
      </div>
    );
  }

  return <>{children}</>;
}

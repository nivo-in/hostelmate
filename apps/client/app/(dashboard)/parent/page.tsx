/**
 * @file apps/client/app/(dashboard)/parent/page.tsx
 * Parent portal page.tsx monitoring page rendering ward status and payment options.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ParentRootPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect('/login');
  }

  redirect('/parent/dashboard');
}

/**
 * @file apps/client/app/(dashboard)/student/page.tsx
 * Student portal page.tsx dashboard subpage rendering status and actions.
 */

import { redirect } from 'next/navigation';

// The live student dashboard is the redesigned dark orange UI at /student/dashboard.
// This index route just forwards there so /student never lands on a stale page.
export default function StudentIndex() {
  redirect('/student/dashboard');
}

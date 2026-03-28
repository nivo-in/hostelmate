import { redirect } from 'next/navigation';

// The live warden dashboard is the redesigned dark UI at /warden/dashboard.
// This index route just forwards there so /warden never lands on a stale page.
export default function WardenIndex() {
  redirect('/warden/dashboard');
}

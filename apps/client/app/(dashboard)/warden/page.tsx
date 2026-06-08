import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function WardenDashboard() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const firstName = profile?.full_name?.split(' ')[0] || 'Warden';

  return (
    <div className="min-h-screen bg-[#ffffff] p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">Hello, {firstName}</h1>
          <p className="text-sm text-gray-400 mt-1">Warden Dashboard</p>
        </div>
        <button className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            emoji: '📋',
            title: 'Attendance',
            desc: 'Manage daily attendance',
            href: '/warden/attendance',
          },
          {
            emoji: '🏖️',
            title: 'Leave Management',
            desc: 'Review and approve leaves',
            href: '/warden/leaves',
          },
          {
            emoji: '🛠️',
            title: 'Complaints',
            desc: 'Resolve student complaints',
            href: '/warden/complaints',
          },
          {
            emoji: '🍲',
            title: 'Mess Management',
            desc: 'Update menu and view feedback',
            href: '/warden/mess',
          },
          {
            emoji: '📢',
            title: 'Notices',
            desc: 'Post and manage announcements',
            href: '/warden/notices',
          },
          {
            emoji: '👥',
            title: 'Staff Directory',
            desc: 'View hostel staff details',
            href: '/warden/staff',
          },
          {
            emoji: '🔍',
            title: 'Lost & Found',
            desc: 'Manage reported items',
            href: '/warden/lost-and-found',
          },
          {
            emoji: '📊',
            title: 'Complaint Analytics',
            desc: 'AI-powered maintenance insights',
            href: '/warden/complaints/analytics',
          },
          {
            emoji: '🚪',
            title: 'Visitor Management',
            desc: 'Manage guest check-ins',
            href: '/warden/visitors',
          },
          {
            emoji: '💰',
            title: 'Fee Management',
            desc: 'Collect and track hostel fees',
            href: '/warden/payments',
          },
        ].map((card) => (
          <Link href={card.href} key={card.title}>
            <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group h-full">
              <div className="text-2xl mb-3">{card.emoji}</div>
              <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
              <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

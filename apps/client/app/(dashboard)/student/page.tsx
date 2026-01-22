import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const firstName = profile?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="min-h-screen bg-[#ffffff] p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">Hello, {firstName}</h1>
          <p className="text-sm text-gray-400 mt-1">Student Dashboard</p>
        </div>
        <button className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Attendance', desc: 'View your attendance records', href: null, emoji: null },
          {
            title: 'Leave Requests',
            desc: 'Apply and track leave requests',
            href: null,
            emoji: null,
          },
          { title: 'Complaints', desc: 'Register and track complaints', href: null, emoji: null },
          { title: 'Mess Menu', desc: 'Weekly menu and reviews', href: null, emoji: null },
          { title: 'Notices', desc: 'Important announcements', href: null, emoji: null },
          { title: 'Lost & Found', desc: 'Report or find items', href: null, emoji: null },
          {
            emoji: '👥',
            title: 'Visitors',
            desc: 'Request visitor passes',
            href: '/student/visitors',
          },
          {
            emoji: '💳',
            title: 'Fee Payments',
            desc: 'Pay hostel and mess fees online',
            href: '/student/payments',
          },
        ].map((card) =>
          card.href ? (
            <Link href={card.href} key={card.title}>
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group h-full">
                {card.emoji && <div className="text-2xl mb-3">{card.emoji}</div>}
                <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
                <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
              </div>
            </Link>
          ) : (
            <div
              key={card.title}
              className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group h-full"
            >
              {card.emoji && <div className="text-2xl mb-3">{card.emoji}</div>}
              <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
              <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

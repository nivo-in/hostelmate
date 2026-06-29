import { MapPin, Palmtree, Phone, CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ParentDashboard() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const firstName = profile?.full_name?.split(' ')[0] || 'Parent';

  return (
    <div className="min-h-screen bg-[#ffffff] p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">Hello, {firstName}</h1>
          <p className="text-sm text-gray-400 mt-1">Parent Dashboard</p>
        </div>
        <button className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            icon: <MapPin size={24} strokeWidth={2.5} />,
            title: 'Track Student',
            desc: 'View student location and attendance',
            href: null,
          },
          {
            icon: <Palmtree size={24} />,
            title: 'Leave Status',
            desc: 'Track pending and approved leaves',
            href: null,
          },
          {
            icon: <Phone size={24} />,
            title: 'Contact Warden',
            desc: 'Get in touch with hostel warden',
            href: null,
          },
          {
            icon: <CreditCard size={24} />,
            title: 'Fee Payments',
            desc: "Pay ward's hostel fees",
            href: '/parent/payments',
          },
        ].map((card) =>
          card.href ? (
            <Link href={card.href} key={card.title}>
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group">
                <div className="mb-3 text-gray-500">{card.icon}</div>
                <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
                <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
              </div>
            </Link>
          ) : (
            <div
              key={card.title}
              className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group"
            >
              <div className="mb-3 text-gray-500">{card.icon}</div>
              <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
              <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WardenDashboard() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] || 'Warden'

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
          { title: 'Attendance', desc: 'Manage daily attendance' },
          { title: 'Leave Management', desc: 'Review and approve leaves' },
          { title: 'Complaints', desc: 'Resolve student complaints' },
          { title: 'Mess Management', desc: 'Update menu and view feedback' },
          { title: 'Notices', desc: 'Post and manage announcements' },
          { title: 'Staff Directory', desc: 'View hostel staff details' },
          { title: 'Lost & Found', desc: 'Manage reported items' }
        ].map((card) => (
          <div key={card.title} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors cursor-pointer group">
            <h2 className="font-medium text-gray-900 group-hover:text-black">{card.title}</h2>
            <p className="text-sm text-gray-400 mt-2">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

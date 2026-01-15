'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3" />
  </div>
)

export default function ParentDashboard() {
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const init = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setLoading(false); return }

      const [profileResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ])

      if (profileResult.data?.full_name) {
        setFirstName(profileResult.data.full_name.split(' ')[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    init()
  }, [init])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title={loading ? 'Hello 👋' : `Hello ${firstName} 👋`} onSignOut={handleSignOut} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card emoji="📍" title="Track Student" description="View real-time attendance" href="/parent/track" />
          <Card emoji="🏖️" title="Leave Status" description="Check leave approvals" href="/parent/leaves" />
          <Card emoji="📞" title="Contact Warden" description="Get warden details" href="/parent/contact" />
          <Card emoji="📢" title="Notices" description="Read hostel announcements" href="/parent/notices" />
          <Card emoji="💳" title="Fee Payments" description="Pay ward's hostel fees" href="/parent/payments" />
        </div>
      )}
    </div>
  )
}

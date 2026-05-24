'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'

export default function ParentDashboard() {
  const [firstName, setFirstName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        
        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0])
        }
      }
    }
    fetchProfile()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title={`Hello ${firstName} 👋`} onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card 
          emoji="📍" 
          title="Track Student" 
          description="View real-time attendance" 
          href="/parent/track" 
        />
        <Card 
          emoji="🏖️" 
          title="Leave Status" 
          description="Check leave approvals" 
          href="/parent/leaves" 
        />
        <Card 
          emoji="📞" 
          title="Contact Warden" 
          description="Get warden details" 
          href="/parent/contact" 
        />
        <Card 
          emoji="📢" 
          title="Notices" 
          description="Read hostel announcements" 
          href="/parent/notices" 
        />
      </div>
    </div>
  )
}

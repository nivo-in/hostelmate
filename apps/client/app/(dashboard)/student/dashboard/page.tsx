'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'

export default function StudentDashboard() {
  const [firstName, setFirstName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title={`Hello ${firstName} 👋`} onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card 
          emoji="📋" 
          title="Attendance" 
          description="Mark your daily attendance" 
          href="/student/attendance" 
        />
        <Card 
          emoji="🏖️" 
          title="Leave Request" 
          description="Apply for leave" 
          href="/student/leaves" 
        />
        <Card 
          emoji="🔧" 
          title="Complaints" 
          description="Report a maintenance issue" 
          href="/student/complaints" 
        />
        <Card 
          emoji="🍽️" 
          title="Mess" 
          description="View menu and rate meals" 
          href="/student/mess" 
        />
        <Card 
          emoji="📢" 
          title="Notices" 
          description="Read announcements" 
          href="/student/notices" 
        />
        <Card 
          emoji="🔍" 
          title="Lost & Found" 
          description="Report or find items" 
          href="/student/lost-found" 
        />
        <Card 
          emoji="⭐" 
          title="Staff Feedback" 
          description="Rate hostel staff" 
          href="/student/staff-feedback" 
        />
      </div>
    </div>
  )
}

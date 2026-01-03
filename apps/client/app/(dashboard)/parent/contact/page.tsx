'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ParentContact() {
  const [warden, setWarden] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchWarden = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'warden')
        .limit(1)
        .single()
      
      if (data) {
        setWarden(data)
      }
    }
    fetchWarden()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Contact Warden" onSignOut={handleSignOut} />
      
      <div className="max-w-md mx-auto p-8 border border-gray-100 rounded-xl text-center shadow-sm">
        <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
          👨‍💼
        </div>
        <h2 className="text-xl font-medium tracking-tight text-gray-900 mb-1">{warden?.full_name || 'Chief Warden'}</h2>
        <p className="text-sm text-gray-400 mb-6">Hostel Administration</p>
        
        <div className="space-y-4 text-sm text-gray-600 mb-8">
          <div className="flex items-center justify-center gap-2">
            <span>📞</span>
            <a href={`tel:${warden?.phone || '+1234567890'}`} className="hover:text-gray-900">{warden?.phone || '+1 234 567 890'}</a>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span>✉️</span>
            <a href={`mailto:${warden?.email || 'warden@hostelmate.com'}`} className="hover:text-gray-900">{warden?.email || 'warden@hostelmate.com'}</a>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span>🏢</span>
            <span>Block A, Admin Office</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-xs uppercase tracking-widest text-red-500 font-medium mb-3">Emergency Contact</h3>
          <a href={`tel:${warden?.phone || '+1234567890'}`} className="block w-full py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors">
            Call Now
          </a>
        </div>
      </div>
    </div>
  )
}

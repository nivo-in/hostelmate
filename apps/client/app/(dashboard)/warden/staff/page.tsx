'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface StaffProfile {
  id: string
  full_name?: string
  phone?: string
  email?: string
  role: string
  staff?: unknown[]
}

export default function StaffDirectory() {
  const router = useRouter()
  const supabase = createClient()
  
  const [staffList, setStaffList] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Warden',
    email: ''
  })

  const fetchStaff = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, staff(*)')
    
    if (data) {
      const filtered = data.filter((p: StaffProfile) => p.role === 'warden' || (p.staff && p.staff.length > 0) || ['admin', 'cleaner', 'security'].includes(p.role))
      setStaffList(filtered || [])
    } else {
      setStaffList([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const id = crypto.randomUUID()
    const roleLower = formData.role.toLowerCase()
    
    // Optimistic UI update
    setStaffList(prev => [{
      id,
      full_name: formData.name,
      phone: formData.phone,
      email: formData.email,
      role: roleLower
    }, ...(prev || [])])
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id,
        full_name: formData.name,
        phone: formData.phone,
        email: formData.email,
        role: roleLower
      })
      
    if (!profileError && roleLower !== 'warden') {
      await supabase.from('staff').insert({
        profile_id: id,
        role: roleLower
      })
    }
    
    setFormData({ name: '', phone: '', role: 'Warden', email: '' })
    // fetchStaff() // Commented to keep optimistic UI intact if backend isn't ready
  }

  const handleDelete = async (id: string) => {
    await supabase.from('profiles').delete().eq('id', id)
    fetchStaff()
  }

  const getRoleBadgeColor = (role: string) => {
    switch(role?.toLowerCase()) {
      case 'warden': return 'bg-gray-900 text-white'
      case 'admin': return 'bg-blue-50 text-blue-700'
      case 'cleaner': return 'bg-green-50 text-green-700'
      case 'security': return 'bg-orange-50 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <PageHeader title="Staff Directory" showBack onSignOut={handleSignOut} />
      
      <div className="mb-12 mt-8">
        <h2 className="text-xl font-medium tracking-tight text-gray-900 mb-6">Add New Staff</h2>
        <form onSubmit={handleSubmit} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 flex flex-col gap-4 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Full Name</label>
              <input
                required
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Phone</label>
              <input
                required
                type="tel"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email</label>
              <input
                required
                type="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Staff Role</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none bg-white"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="Warden">Warden</option>
                <option value="Admin">Admin</option>
                <option value="Cleaner">Cleaner</option>
                <option value="Security">Security</option>
              </select>
            </div>
          </div>
          <button type="submit" className="mt-2 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm hover:bg-gray-700 w-fit transition-colors">
            Add Staff Member
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-medium tracking-tight text-gray-900 mb-6">Current Staff</h2>
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-gray-400">Loading staff...</div>
          ) : staffList.length === 0 ? (
            <div className="text-sm text-gray-400">No staff found.</div>
          ) : (
            staffList.map((staff) => (
              <div key={staff.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 flex items-center justify-between transition-colors">
                <div className="grid grid-cols-4 gap-4 w-full mr-4 items-center">
                  <div className="font-medium text-gray-900">{staff.full_name}</div>
                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(staff.role)}`}>
                      {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{staff.phone}</div>
                  <div className="text-sm text-gray-500">{staff.email}</div>
                </div>
                <button 
                  onClick={() => handleDelete(staff.id)}
                  className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

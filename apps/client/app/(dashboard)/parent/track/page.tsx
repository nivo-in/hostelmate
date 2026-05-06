'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function ParentTrack() {
  const [history, setHistory] = useState<any[]>([])
  const [todayStatus, setTodayStatus] = useState<any>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const { apiGet } = useApi()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchStudent = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: parent } = await supabase.from('parents').select('student_id').eq('id', user.id).single()
        if (parent?.student_id) {
          setStudentId(parent.student_id)
        }
      }
    }
    fetchStudent()
  }, [])

  useEffect(() => {
    if (studentId) {
      apiGet(`/api/attendance/student/${studentId}`).then(res => {
        if (res.success) {
          setHistory(res.data)
          const today = new Date().toISOString().split('T')[0]
          const todayRec = res.data.find((r: any) => r.date === today)
          setTodayStatus(todayRec || { status: 'absent' })
        }
      })
    }
  }, [studentId])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Track Student" onSignOut={handleSignOut} />
      
      <div className="mb-10 flex flex-col items-center justify-center p-10 border border-gray-100 rounded-xl bg-gray-50/50">
        <h2 className="font-medium tracking-tight text-gray-900 mb-6 text-xl">Today's Status</h2>
        {todayStatus?.status === 'present' ? (
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-medium text-green-700">Present Today</p>
            <p className="text-sm text-gray-500 mt-2">Scanned at: {new Date(todayStatus.scan_time).toLocaleTimeString()}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-medium text-red-700">Not marked today</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">30-Day History</h2>
        <div className="grid grid-cols-7 gap-2">
          {days.map(dateStr => {
            const rec = history.find(h => h.date === dateStr)
            const status = rec?.status || 'none'
            const dNum = new Date(dateStr).getDate()
            
            let bgClass = 'bg-gray-100 text-gray-400'
            if (status === 'present') bgClass = 'bg-green-100 text-green-700 font-medium'
            if (status === 'absent') bgClass = 'bg-red-100 text-red-700 font-medium'
            if (status === 'leave') bgClass = 'bg-yellow-100 text-yellow-700 font-medium'

            return (
              <div key={dateStr} className={`aspect-square flex items-center justify-center rounded-lg text-sm ${bgClass}`} title={`${dateStr} - ${status}`}>
                {dNum}
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-gray-500 justify-center">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-100"></div> Present</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-100"></div> Absent</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-100"></div> Leave</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-100"></div> No Record</div>
        </div>
      </div>
    </div>
  )
}

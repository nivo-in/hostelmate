'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenAttendance() {
  const [qrUrl, setQrUrl] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [stats, setStats] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  
  const { apiGet } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const generateQR = async () => {
    const today = new Date().toISOString().split('T')[0]
    const data = JSON.stringify({ hostel: 'hostelmate', date: today, token: `${today}-secret123` })
    const url = await QRCode.toDataURL(data, { width: 256 })
    setQrUrl(url)
    setCountdown(60)
  }

  useEffect(() => {
    generateQR()
    const int1 = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          generateQR()
          return 60
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(int1)
  }, [])

  useEffect(() => {
    apiGet('/api/attendance/stats').then(res => {
      if (res.success) setStats(res.data)
    })
    apiGet('/api/attendance/today').then(res => {
      if (res.success) setList(res.data)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Attendance Management" onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="md:col-span-1 p-6 border border-gray-100 rounded-xl text-center flex flex-col items-center">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Daily QR</h2>
          {qrUrl && <img src={qrUrl} alt="QR Code" className="w-48 h-48 mb-4" />}
          <p className="text-xs text-gray-400">Refreshes in: {countdown}s</p>
        </div>
        
        <div className="md:col-span-2 p-6 border border-gray-100 rounded-xl">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Today's Stats</h2>
          {stats && (
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-medium text-gray-900">{stats.present_today}</p>
                <p className="text-xs text-gray-400 mt-1">Present</p>
              </div>
              <div>
                <p className="text-3xl font-medium text-gray-900">{stats.absent_today}</p>
                <p className="text-xs text-gray-400 mt-1">Absent</p>
              </div>
              <div>
                <p className="text-3xl font-medium text-gray-900">{stats.total_students}</p>
                <p className="text-xs text-gray-400 mt-1">Total</p>
              </div>
              <div>
                <p className="text-3xl font-medium text-green-600">{stats.percentage}%</p>
                <p className="text-xs text-gray-400 mt-1">Percentage</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Attendance List</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="py-2">Name</th>
              <th className="py-2">Roll No</th>
              <th className="py-2">Status</th>
              <th className="py-2">Scan Time</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3 text-gray-900">{item.name}</td>
                <td className="py-3 text-gray-900">{item.roll_number}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'present' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 text-gray-500">{new Date(item.scan_time).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

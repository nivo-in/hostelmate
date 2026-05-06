'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'

export default function StudentAttendance() {
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])
  
  const { profile } = useProfile()
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profile?.id) {
      apiGet(`/api/attendance/student/${profile.id}`).then(res => {
        if (res.success) setHistory(res.data.slice(0, 30))
      })
    }
  }, [profile?.id])

  const startScanner = () => {
    setScanning(true)
    setMessage('')
    setError('')
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false)
      scanner.render(async (text) => {
        scanner.clear()
        setScanning(false)
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const res = await apiPost('/api/attendance/mark', {
              token: text,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            })
            if (res.success) {
              setMessage('Attendance marked successfully ✓')
              if (profile?.id) {
                const historyRes = await apiGet(`/api/attendance/student/${profile.id}`)
                if (historyRes.success) setHistory(historyRes.data.slice(0, 30))
              }
            } else {
              setError(res.error || 'Failed to mark attendance')
            }
          }, (err) => setError('Geolocation required: ' + err.message))
        } else {
          setError('Geolocation not supported by this browser.')
        }
      }, (err) => {
        // ignore scan errors
      })
    }, 100)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Attendance" onSignOut={handleSignOut} />
      
      <div className="mb-10 p-6 border border-gray-100 rounded-xl">
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Mark Attendance</h2>
        
        {!scanning ? (
          <button onClick={startScanner} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">
            Start Scanner
          </button>
        ) : (
          <div>
            <div id="qr-reader" className="w-full max-w-sm mx-auto mb-4 border border-gray-200"></div>
            <button onClick={() => {
              setScanning(false)
              document.getElementById('qr-reader')!.innerHTML = ''
            }} className="bg-red-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-red-600">
              Stop Scanner
            </button>
          </div>
        )}

        {message && <p className="mt-4 text-green-600 text-sm">{message}</p>}
        {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">History (Last 30 days)</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map(item => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3 text-gray-900">{item.date}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'present' ? 'bg-green-50 text-green-700' : 
                    item.status === 'absent' ? 'bg-red-50 text-red-700' : 
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

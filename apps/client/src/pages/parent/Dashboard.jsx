import { useAuth } from '../../context/AuthContext'

export default function ParentDashboard() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">HostelMate</p>
            <h1 className="text-2xl font-medium tracking-tight text-gray-900">
              Parent Dashboard
            </h1>
          </div>
          <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
        <div className="border border-gray-100 rounded-xl p-6">
          <p className="text-sm text-gray-500">Parent dashboard — features coming soon.</p>
        </div>
      </div>
    </div>
  )
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/shared/Login'
import StudentDashboard from './pages/student/Dashboard'
import WardenDashboard from './pages/warden/Dashboard'
import ParentDashboard from './pages/parent/Dashboard'

function RoleRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-400">Setting up your account...</p>
    </div>
  )

  const routes = {
    student: '/student/dashboard',
    warden: '/warden/dashboard',
    parent: '/parent/dashboard'
  }

  return <Navigate to={routes[profile.role] ?? '/login'} replace />
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/student/dashboard" element={
        <ProtectedRoute allowedRole="student">
          <StudentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/warden/dashboard" element={
        <ProtectedRoute allowedRole="warden">
          <WardenDashboard />
        </ProtectedRoute>
      } />
      <Route path="/parent/dashboard" element={
        <ProtectedRoute allowedRole="parent">
          <ParentDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
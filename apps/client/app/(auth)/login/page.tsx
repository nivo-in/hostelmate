'use client'

import { useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const WardenFaceVerification = lazy(() => import('@/components/face/WardenFaceVerification'))

type LoginStep =
  | 'credentials'      // default — show email/password form
  | 'face-verify'      // warden face verification step
  | 'done'             // redirecting

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<LoginStep>('credentials')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<string | null>(null)



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setIsLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      const role = profile?.role

      if (role === 'warden') {
        // Pause and do face verification before granting access
        setPendingUserId(data.user.id)
        setPendingRole('warden')
        setStep('face-verify')
        setIsLoading(false)
      } else if (role === 'student') {
        router.push('/student/dashboard')
      } else if (role === 'parent') {
        router.push('/parent/dashboard')
      } else {
        setError('No role assigned to this account.')
        setIsLoading(false)
      }
    }
  }

  const handleFaceVerified = () => {
    setStep('done')
    router.push('/warden/dashboard')
  }

  const handleFaceFailed = async (reason: string) => {
    // Sign out the warden since face verification failed
    await createClient().auth.signOut()
    setError(`Security check failed: ${reason}`)
    setStep('credentials')
    setPendingUserId(null)
    setPendingRole(null)
  }

  const handleFaceSkip = async () => {
    // Do NOT allow skipping warden face verification — it's a security gate
    await createClient().auth.signOut()
    setError('Face verification is required for warden login. Please register your face first.')
    setStep('credentials')
    setPendingUserId(null)
    setPendingRole(null)
  }

  // ── Face Verification Screen ──
  if (step === 'face-verify' && pendingUserId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <Suspense fallback={
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading face recognition...
              </div>
            </div>
          }>
            <WardenFaceVerification
              wardenId={pendingUserId}
              onVerified={handleFaceVerified}
              onFailed={handleFaceFailed}
              onSkip={handleFaceSkip}
            />
          </Suspense>
        </div>
      </div>
    )
  }

  // ── Redirecting Screen ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Redirecting...
        </div>
      </div>
    )
  }

  // ── Login Form ──
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="text-xs tracking-widest uppercase text-gray-400">by Nivo</p>
          <h1 className="text-3xl font-medium tracking-tight text-gray-900 mt-2">HostelMate</h1>
          <p className="text-sm text-gray-400 mt-2 mb-10">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-900 mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

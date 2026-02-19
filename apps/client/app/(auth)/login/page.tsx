'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ROLE_EMAIL_HINTS: Record<string, string[]> = {
  warden: ['warden', 'admin', 'staff', 'rector', 'hod', 'principal'],
  parent: ['parent', 'guardian', 'father', 'mother', 'dad', 'mom'],
  student: [],
}

function detectRole(email: string): 'student' | 'warden' | 'parent' {
  const lower = email.toLowerCase()
  for (const [role, hints] of Object.entries(ROLE_EMAIL_HINTS)) {
    if (hints.some(h => lower.includes(h))) {
      return role as 'student' | 'warden' | 'parent'
    }
  }
  return 'student'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState<'student' | 'warden' | 'parent'>('student')
  const [autoDetected, setAutoDetected] = useState(false)
  const supabase = createClient()

  const cardRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(function tickFn() {
    const el = cardRef.current
    if (!el) return
    current.current.x = lerp(current.current.x, target.current.x, 0.06)
    current.current.y = lerp(current.current.y, target.current.y, 0.06)
    el.style.transform = `rotateY(${current.current.y}deg) rotateX(${current.current.x}deg)`
    if (
      Math.abs(current.current.x - target.current.x) > 0.005 ||
      Math.abs(current.current.y - target.current.y) > 0.005
    ) {
      animRef.current = requestAnimationFrame(tickFn)
    } else {
      animRef.current = null
    }
  }, [])

  const startAnim = useCallback(() => {
    if (!animRef.current) animRef.current = requestAnimationFrame(tick)
  }, [tick])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    target.current = { x: dy * -10, y: dx * 10 }
    startAnim()
  }, [startAnim])

  const handleMouseLeave = useCallback(() => {
    target.current = { x: 0, y: 0 }
    startAnim()
  }, [startAnim])

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  useEffect(() => {
    if (email.length > 3) {
      const detected = detectRole(email)
      if (detected !== 'student') {
        setRole(detected)
        setAutoDetected(true)
      } else {
        setAutoDetected(false)
      }
    } else {
      setAutoDetected(false)
    }
  }, [email])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

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

      const routes: Record<string, string> = {
        student: '/student/dashboard',
        warden: '/warden/dashboard',
        parent: '/parent/dashboard'
      }

      const route = routes[profile?.role || 'student']
      if (route) window.location.href = route
      else {
        setError('No role assigned.')
        setIsLoading(false)
      }
    }
  }

  const roleColors = {
    student: '#4ade80',
    warden: '#a78bfa',
    parent: '#60a5fa'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080810',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Animated glow background */}
      <div style={{
        position: 'fixed',
        top: '-20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '600px',
        background: `radial-gradient(ellipse at center, ${roleColors[role]}18 0%, ${roleColors[role]}08 35%, transparent 70%)`,
        transition: 'background 1.2s ease',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div style={{
        position: 'fixed',
        inset: 0,
        opacity: 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, perspective: '1000px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={cardRef}
          style={{
            background: 'rgba(10, 14, 28, 0.95)',
            border: `0.5px solid ${roleColors[role]}40`,
            borderRadius: '20px',
            padding: '40px',
            width: '400px',
            transformStyle: 'preserve-3d',
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px ${roleColors[role]}20`,
            transition: 'border-color 0.8s ease, box-shadow 0.8s ease',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '18px', fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
              HostelMate
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              by Nivo Technologies
            </div>
          </div>

          {/* Role tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
            {(['student', 'warden', 'parent'] as const).map(r => (
              <button
                key={r}
                onClick={() => { setRole(r); setAutoDetected(false) }}
                style={{
                  flex: 1,
                  padding: '9px 8px',
                  background: role === r ? `${roleColors[r]}18` : 'rgba(255,255,255,0.04)',
                  border: `0.5px solid ${role === r ? roleColors[r] + '50' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: role === r ? roleColors[r] : 'rgba(255,255,255,0.38)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  fontWeight: role === r ? 500 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Auto-detect hint */}
          {autoDetected && (
            <div style={{
              marginBottom: '16px',
              background: `${roleColors[role]}10`,
              border: `0.5px solid ${roleColors[role]}30`,
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              color: roleColors[role],
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: roleColors[role], flexShrink: 0 }} />
              Role auto-detected as {role}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px', letterSpacing: '0.2px' }}>
                Email address
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@college.edu"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = `${roleColors[role]}60`}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px', letterSpacing: '0.2px' }}>
                Password
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = `${roleColors[role]}60`}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: '16px',
                background: 'rgba(248,113,113,0.08)',
                border: '0.5px solid rgba(248,113,113,0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? 'rgba(255,255,255,0.7)' : '#fff',
                color: '#080810',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

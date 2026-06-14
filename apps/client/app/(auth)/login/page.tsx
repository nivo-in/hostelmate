'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '../../landing.module.css'

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
  const [isHovered, setIsHovered] = useState(false)
  const supabase = createClient()

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

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={styles.site} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '48px',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'fixed',
        top: mounted ? '50%' : '-15%',
        left: '50%',
        transform: mounted ? 'translate(-50%, -50%)' : 'translateX(-50%)',
        width: '900px',
        height: '600px',
        background: `radial-gradient(ellipse at center, ${roleColors[role]}24 0%, ${roleColors[role]}14 35%, ${roleColors[role]}08 60%, transparent 75%)`,
        transition: 'top 1.5s cubic-bezier(0.16, 1, 0.3, 1), transform 1.5s cubic-bezier(0.16, 1, 0.3, 1), background 1.2s ease',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div className={styles.noise} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '522px' }}>
        <div
          className={styles.loginCard}
          style={{ 
            cursor: 'default',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            borderColor: isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            boxShadow: isHovered ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Logo */}
          <div className={styles.loginLogo}>HostelMate</div>
          <div className={styles.loginBy}>by Nivo Technologies</div>

          {/* Role tabs */}
          <div className={styles.roleTabs}>
            {(['student', 'warden', 'parent'] as const).map(r => (
              <button
                type="button"
                key={r}
                onClick={() => { setRole(r); setAutoDetected(false) }}
                className={`${styles.roleTab} ${role === r ? styles.roleTabActive : ''}`}
                style={{ cursor: 'pointer', textTransform: 'capitalize' }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Auto-detect hint */}
          {autoDetected && (
            <div className={styles.loginHint} style={{ marginBottom: '16px', marginTop: 0 }}>
              <div className={styles.loginHintDot} />
              <div className={styles.loginHintText}>Role auto-detected as {role}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className={styles.loginField}>
              <div className={styles.loginLabel}>Email address</div>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className={styles.loginInput}
                style={{ opacity: 1, transition: 'border-color 0.2s', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div className={styles.loginField}>
              <div className={styles.loginLabel}>Password</div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.loginInput}
                style={{ opacity: 1, transition: 'border-color 0.2s', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
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
              className={styles.loginBtn}
              style={{
                opacity: isLoading ? 0.7 : 1,
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

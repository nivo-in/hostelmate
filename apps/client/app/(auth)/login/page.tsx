'use client'

import { useState, useEffect, useRef } from 'react'
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
    student: '#fb923c',
    warden: '#a78bfa',
    parent: '#60a5fa'
  }

  const [mounted, setMounted] = useState(false)
  const [bgRole, setBgRole] = useState(role)
  const [bgDimmed, setBgDimmed] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fadeOutOverlay = () => {
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'none'
        overlayRef.current.style.opacity = '1'
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (overlayRef.current) {
              overlayRef.current.style.transition = 'opacity 0.58s ease'
              overlayRef.current.style.opacity = '0'
            }
          })
        })
      }
    }

    fadeOutOverlay()

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        fadeOutOverlay()
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (role === bgRole) return
    setBgDimmed(true)
    const timer = setTimeout(() => {
      setBgRole(role)
      setBgDimmed(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [role, bgRole])

  useEffect(() => {
    const handlePageHide = () => {
      try { sessionStorage.setItem('navigatingBackFromLogin', 'true') } catch {}
    }
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      handlePageHide()
    }
  }, [])

  return (
    <div className={styles.site} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '48px',
      overflow: 'hidden',
    }}>
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#080810',
          opacity: 1,
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      />
      <div style={{
        position: 'fixed',
        top: mounted ? '-5%' : '-15%',
        left: mounted ? '65%' : '50%',
        transform: `translateX(-50%) scale(${bgDimmed ? 0.85 : 1})`,
        width: '900px',
        height: '600px',
        opacity: bgDimmed ? 0.5 : 1,
        background: `radial-gradient(ellipse at center, ${roleColors[bgRole]}24 0%, ${roleColors[bgRole]}14 35%, ${roleColors[bgRole]}08 60%, ${roleColors[bgRole]}00 75%)`,
        transition: 'top 2.0s cubic-bezier(0.16, 1, 0.3, 1), left 2.0s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s ease-in-out, opacity 0.4s ease-in-out, background 0.4s ease',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div style={{
        position: 'fixed',
        bottom: mounted ? '-25%' : '5%',
        left: '-8%',
        transform: `scale(${bgDimmed ? 0.85 : 1})`,
        width: '500px',
        height: '400px',
        opacity: bgDimmed ? 0.5 : 1,
        background: `radial-gradient(ellipse at center, ${roleColors[bgRole]}0D 0%, ${roleColors[bgRole]}00 65%)`,
        transition: 'bottom 2.0s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s ease-in-out, opacity 0.4s ease-in-out, background 0.4s ease',
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

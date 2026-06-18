'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type Hls from 'hls.js'
import styles from '../../landing.module.css'

function GooglyEyes({ isHidden, onToggle, cursorX, cursorY }: {
  isHidden: boolean
  onToggle: () => void
  cursorX: number
  cursorY: number
}) {
  const eye1Ref = useRef<HTMLDivElement>(null)
  const eye2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHidden) return
    ;[eye1Ref, eye2Ref].forEach(eyeRef => {
      const eye = eyeRef.current
      if (!eye) return
      const rect = eye.getBoundingClientRect()
      const eyeCX = rect.left + rect.width / 2
      const eyeCY = rect.top + rect.height / 2
      const dx = cursorX - eyeCX
      const dy = cursorY - eyeCY
      const angle = Math.atan2(dy, dx)
      const dist = Math.min(Math.hypot(dx, dy), 5)
      const pupilX = Math.cos(angle) * dist
      const pupilY = Math.sin(angle) * dist
      const pupil = eye.querySelector('.pupil') as HTMLElement
      if (pupil) {
        pupil.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`
      }
    })
  }, [cursorX, cursorY, isHidden])

  const lashAngles = [-32, -11, 11, 32]

  return (
    <div
      onClick={onToggle}
      title={isHidden ? 'Show password' : 'Hide password'}
      style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '20px',
          paddingTop: '6px',
        }}
      >
        {lashAngles.map((deg, j) => (
          <div
            key={j}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: '1.5px',
              height: isHidden ? '1px' : '5px',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: '1px',
              transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${deg}deg)`,
              transition: 'height 0.22s ease, opacity 0.22s ease',
              opacity: isHidden ? 0 : 0.75,
              pointerEvents: 'none',
            }}
          />
        ))}
        <div
          ref={eye1Ref}
          style={{
            width: '20px',
            height: '20px',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: '50%',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 1.5px 0 rgba(15,12,30,0.4)',
          }}
        >
          <div
            className="pupil"
            style={{
              width: '9px',
              height: '9px',
              background: '#08080f',
              borderRadius: '50%',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'transform 0.08s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: '4px',
              width: '4px',
              height: '2px',
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '50%',
              pointerEvents: 'none',
              opacity: isHidden ? 0 : 1,
              transition: 'opacity 0.18s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(12, 11, 22, 0.97)',
              transformOrigin: 'top center',
              transform: isHidden ? 'scaleY(1)' : 'scaleY(0)',
              transition: isHidden
                ? 'transform 0.24s cubic-bezier(0.55, 0, 0.45, 1)'
                : 'transform 0.30s cubic-bezier(0.2, 0.9, 0.4, 1)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: '20px',
          paddingTop: '6px',
        }}
      >
        {lashAngles.map((deg, j) => (
          <div
            key={j}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: '1.5px',
              height: isHidden ? '1px' : '5px',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: '1px',
              transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${deg}deg)`,
              transition: 'height 0.22s ease, opacity 0.22s ease',
              opacity: isHidden ? 0 : 0.75,
              pointerEvents: 'none',
            }}
          />
        ))}
        <div
          ref={eye2Ref}
          style={{
            width: '20px',
            height: '20px',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: '50%',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 1.5px 0 rgba(15,12,30,0.4)',
          }}
        >
          <div
            className="pupil"
            style={{
              width: '9px',
              height: '9px',
              background: '#08080f',
              borderRadius: '50%',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'transform 0.08s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: '4px',
              width: '4px',
              height: '2px',
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '50%',
              pointerEvents: 'none',
              opacity: isHidden ? 0 : 1,
              transition: 'opacity 0.18s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(12, 11, 22, 0.97)',
              transformOrigin: 'top center',
              transform: isHidden ? 'scaleY(1)' : 'scaleY(0)',
              transition: isHidden
                ? 'transform 0.24s cubic-bezier(0.55, 0, 0.45, 1)'
                : 'transform 0.30s cubic-bezier(0.2, 0.9, 0.4, 1)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      </div>
    </div>
  )
}


const ROLE_EMAIL_HINTS: Record<string, string[]> = {
  warden: ['warden', 'admin', 'staff', 'rector', 'hod', 'principal'],
  parent: ['parent', 'guardian', 'father', 'mother', 'dad', 'mom'],
  student: ['student', 'scholar', 'ug', 'pg', 'btech', 'mtech', 'phd'],
}

function detectRole(email: string): 'student' | 'warden' | 'parent' | null {
  const lower = email.toLowerCase()
  for (const [role, hints] of Object.entries(ROLE_EMAIL_HINTS)) {
    if (hints.some(h => lower.includes(h))) {
      return role as 'student' | 'warden' | 'parent'
    }
  }
  return null
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState<'student' | 'warden' | 'parent'>('student')
  const [autoDetected, setAutoDetected] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [globalCursorX, setGlobalCursorX] = useState(0)
  const [globalCursorY, setGlobalCursorY] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem('login_show_password')
    if (saved !== null) {
      setShowPassword(saved === 'true')
    }
  }, [])

  // FIX E — Force repaint on mount to prevent black screen from back navigation
  useEffect(() => {
    document.body.style.opacity = '0'
    requestAnimationFrame(() => {
      document.body.style.transition = 'opacity 0.3s ease'
      document.body.style.opacity = '1'
    })
    return () => {
      document.body.style.opacity = ''
      document.body.style.transition = ''
    }
  }, [])

  // Global cursor tracking for googly eyes
  useEffect(() => {
    const track = (e: MouseEvent) => {
      setGlobalCursorX(e.clientX)
      setGlobalCursorY(e.clientY)
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  useEffect(() => {
    if (email.length > 3) {
      const detected = detectRole(email)
      if (detected) {
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
  const [bgDimmed, setBgDimmed] = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoOpacity, setVideoOpacity] = useState(0)

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const src = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";
    let hlsInstance: Hls | null = null;

    import("hls.js").then(({ default: HlsClass }) => {
      if (HlsClass.isSupported()) {
        hlsInstance = new HlsClass();
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      }
    });

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        setVideoOpacity(0.65);
      }, 2300); // 2.0s transition + 0.3s delay
      return () => clearTimeout(timer);
    }
  }, [mounted]);

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
    const timer1 = setTimeout(() => setMounted(true), 50)
    const timer2 = setTimeout(() => setBgDimmed(false), 300)
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
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

      {/* Background HLS Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: videoOpacity,
          transition: 'opacity 1.9s ease-in-out',
          pointerEvents: 'none',
        }}
      />

      {/* Spotlights (zIndex: 1 so they are on top of the video but behind the card) */}
      <div style={{
        position: 'fixed',
        top: 'calc(-15% - 30px)',
        left: '50%',
        transform: `translateX(-50%) scale(${bgDimmed ? 0.85 : 1})`,
        width: '900px',
        height: '600px',
        opacity: bgDimmed ? 0.5 : 1,
        background: `radial-gradient(ellipse at center, ${roleColors[bgRole]}2B 0%, ${roleColors[bgRole]}18 35%, ${roleColors[bgRole]}0A 60%, ${roleColors[bgRole]}00 75%)`,
        transition: 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out, background 0.4s ease',
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{
        position: 'fixed',
        bottom: 'calc(5% + 30px)',
        left: '-8%',
        transform: `scale(${bgDimmed ? 0.85 : 1})`,
        width: '500px',
        height: '400px',
        opacity: bgDimmed ? 0.5 : 1,
        background: `radial-gradient(ellipse at center, ${roleColors[bgRole]}10 0%, ${roleColors[bgRole]}00 65%)`,
        transition: 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out, background 0.4s ease',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Matte noise overlay */}
      <div className={styles.noise} style={{ zIndex: 5, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '522px' }}>
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

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px', letterSpacing: '0.2px' }}>
                Password
              </div>
              {/* overflow:hidden clips the hands at the input bottom edge so they appear to slide up from beneath */}
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '11px 60px 11px 14px',
                    fontSize: '14px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box' as const,
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = `${roleColors[role]}60`}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <GooglyEyes
                  isHidden={!showPassword}
                  onToggle={() => {
                    setShowPassword(p => {
                      const next = !p
                      localStorage.setItem('login_show_password', String(next))
                      return next
                    })
                  }}
                  cursorX={globalCursorX}
                  cursorY={globalCursorY}
                />
              </div>
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
// compatibility
// compatibility

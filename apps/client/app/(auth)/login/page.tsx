/**
 * @file apps/client/app/(auth)/login/page.tsx
 * Source code module for HostelMate page.tsx.
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type Hls from 'hls.js'
import styles from '../../landing.module.css'
import WardenFaceVerification from '@/components/face/WardenFaceVerification'


function SingleEye({ eyeRef, isHidden }: {
  eyeRef: React.RefObject<HTMLDivElement | null>
  isHidden: boolean
}) {
  return (
    <div style={{ position: 'relative', width: '22px', height: '22px' }}>
      <div
        ref={eyeRef}
        style={{
          width: '22px',
          height: '22px',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: '50%',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 1.5px 0 rgba(15,12,30,0.4), 0 1px 4px rgba(0,0,0,0.4)',
        }}
      >
        <div
          className="pupil"
          style={{
            width: '10px',
            height: '10px',
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
            top: '4px',
            left: '5px',
            width: '4px',
            height: '2.5px',
            background: 'rgba(255,255,255,0.75)',
            borderRadius: '50%',
            pointerEvents: 'none',
            opacity: isHidden ? 0.3 : 1,
            transition: 'opacity 0.22s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'rgba(10, 9, 22, 0.96)',
            height: isHidden ? '55%' : '0%',
            transition: isHidden
              ? 'height 0.28s cubic-bezier(0.55, 0, 0.45, 1)'
              : 'height 0.32s cubic-bezier(0.2, 0.9, 0.4, 1)',
            borderRadius: '0 0 4px 4px',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: isHidden ? '9px' : '-3px',
          left: '-1px',
          right: '-1px',
          height: '10px',
          background: 'rgba(10, 9, 22, 0.0)',
          borderBottom: '2.5px solid rgba(255,255,255,0.55)',
          borderRadius: '0 0 50% 50%',
          transition: isHidden
            ? 'top 0.28s cubic-bezier(0.55, 0, 0.45, 1), opacity 0.28s ease'
            : 'top 0.32s cubic-bezier(0.2, 0.9, 0.4, 1), opacity 0.32s ease',
          opacity: isHidden ? 0.85 : 0.55,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function GooglyEyes({ isHidden, onToggle, cursorX, cursorY }: {
  isHidden: boolean
  onToggle: () => void
  cursorX: number
  cursorY: number
}) {
  const eye1Ref = useRef<HTMLDivElement>(null)
  const eye2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHidden) {return
    ;}[eye1Ref, eye2Ref].forEach(eyeRef => {
      const eye = eyeRef.current
      if (!eye) {return}
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
      <SingleEye eyeRef={eye1Ref} isHidden={isHidden} />
      <SingleEye eyeRef={eye2Ref} isHidden={isHidden} />
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
  const [showFaceVerification, setShowFaceVerification] = useState(false)
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

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
        if (role !== detected) {
          setRole(detected)
          setAutoDetected(true)
        }
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

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      if (data.user) {
        let userRole = data.user.app_metadata?.role || data.user.user_metadata?.role;
        
        // Only fetch from profiles if role is not in the JWT metadata (saves ~1-1.5s)
        if (!userRole) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()
          userRole = profile?.role;
        }

        if (userRole === 'warden') {
          setAuthenticatedUserId(data.user.id)
          setShowFaceVerification(true)
          setIsLoading(false)
          return
        }

        const routes: Record<string, string> = {
          student: '/student/dashboard',
          warden: '/warden/dashboard',
          parent: '/parent/dashboard'
        }

        const route = routes[userRole || 'student']
        if (route) {router.push(route)}
        else {
          setError('No role assigned.')
          setIsLoading(false)
        }
      }
    } catch (err: unknown) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error: Failed to connect to server. If you are using a free Supabase instance, it might be paused.')
      } else {
        setError('An unexpected error occurred during login.')
      }
      setIsLoading(false)
    }
  }

  const roleColors = {
    student: '#fb923c',
    warden: '#a78bfa',
    parent: '#60a5fa'
  }

  const [bgRole, setBgRole] = useState(role)
  const [bgDimmed, setBgDimmed] = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoOpacity, setVideoOpacity] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {return;}

    const src = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";
    let hlsInstance: Hls | null = null;

    import("hls.js").then(({ default: HlsClass }) => {
      if (HlsClass.isSupported()) {
        hlsInstance = new HlsClass({
          capLevelToPlayerSize: false,
          abrEwmaDefaultEstimate: 50000000, // Tricks HLS into starting with the highest quality level instantly
        });
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
    if (videoLoaded) {
      // Wait 1.3s after first frame before starting the fade-in
      const timer = setTimeout(() => setVideoOpacity(0.82), 1000)
      return () => clearTimeout(timer)
    }
  }, [videoLoaded]);

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
    const timer2 = setTimeout(() => setBgDimmed(false), 300)
    return () => {
      clearTimeout(timer2)
    }
  }, [])

  useEffect(() => {
    if (role === bgRole) {return}
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
      {/* Back to home */}
      <div style={{
        position: 'absolute',
        top: '24px',
        right: '32px',
        zIndex: 10,
      }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.35)',
            textDecoration: 'none',
            transition: 'color 0.2s, transform 0.2s, background 0.2s',
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
            e.currentTarget.style.transform = 'translateX(-2px)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
            e.currentTarget.style.transform = 'translateX(0)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
          </svg>
          Back to home
        </Link>
      </div>

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
        onLoadedData={() => setVideoLoaded(true)}
        onPlaying={() => setVideoLoaded(true)} // Keep onPlaying as a fallback
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: videoOpacity,
          transition: 'opacity 1.2s ease-in-out',
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
          {showFaceVerification && authenticatedUserId ? (
            <div style={{ background: 'transparent', borderRadius: '16px', overflow: 'hidden' }}>
              <WardenFaceVerification
                wardenId={authenticatedUserId}
                onVerified={() => { router.push('/warden/dashboard') }}
                onFailed={(reason) => {
                  setError(reason)
                  setShowFaceVerification(false)
                }}
                onSkip={() => { router.push('/warden/dashboard') }}
              />
            </div>
          ) : (
            <>
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
                style={{ cursor: 'pointer', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                {r === 'student' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>}
                {r === 'warden' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                {r === 'parent' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
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
                autoComplete="username"
                spellCheck={false}
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
                  autoComplete="current-password"
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
// compatibility
// compatibility

// layout stable

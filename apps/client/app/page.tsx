'use client'

import React, { useRef, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './landing.module.css'

function PreviewSingleEye({ eyeRef }: {
  eyeRef: React.RefObject<HTMLDivElement | null>
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
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: '-3px',
          left: '-1px',
          right: '-1px',
          height: '10px',
          background: 'rgba(10, 9, 22, 0.0)',
          borderBottom: '2.5px solid rgba(255,255,255,0.55)',
          borderRadius: '0 0 50% 50%',
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function PreviewGooglyEyes() {
  const eye1Ref = useRef<HTMLDivElement>(null)
  const eye2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const eyes = [eye1Ref, eye2Ref]
      eyes.forEach(eyeRef => {
        const eye = eyeRef.current
        if (!eye) return
        const rect = eye.getBoundingClientRect()
        const eyeCX = rect.left + rect.width / 2
        const eyeCY = rect.top + rect.height / 2
        const dx = e.clientX - eyeCX
        const dy = e.clientY - eyeCY
        const angle = Math.atan2(dy, dx)
        const dist = Math.min(Math.hypot(dx, dy), 5)
        const pupilX = Math.cos(angle) * dist
        const pupilY = Math.sin(angle) * dist
        const pupil = eye.querySelector('.pupil') as HTMLElement
        if (pupil) {
          pupil.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`
        }
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none',
        zIndex: 3,
      }}
    >
      <PreviewSingleEye eyeRef={eye1Ref} />
      <PreviewSingleEye eyeRef={eye2Ref} />
    </div>
  )
}

const PROXIMITY = 96 // px — how close to a floating card triggers it

function isNear(rect: DOMRect, x: number, y: number) {
  return (
    x >= rect.left - PROXIMITY &&
    x <= rect.right + PROXIMITY &&
    y >= rect.top - PROXIMITY &&
    y <= rect.bottom + PROXIMITY
  )
}

function activateCard(el: HTMLDivElement, translate: string) {
  el.style.opacity = '1'
  el.style.transform = `scale(1.04) translate(${translate})`
  el.style.zIndex = '10'
  el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.45)'
}

function resetCard(el: HTMLDivElement, translate: string) {
  el.style.opacity = '0.85'
  el.style.transform = `scale(0.94) translate(${translate})`
  el.style.zIndex = '1'
  el.style.boxShadow = ''
}

function HowItWorksCard({
  item, index, cardRef, staggerClass, cardRevealClass,
}: {
  item: { step: string; color: string; title: string; desc: string }
  index: number
  cardRef: (_el: HTMLDivElement | null) => void
  staggerClass: string
  cardRevealClass: string
}) {
  const [hovered, setHovered] = useState(false)
  const col = index % 3
  return (
    <div
      ref={cardRef}
      className={`${cardRevealClass} ${staggerClass}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.055)' : '#080810',
        padding: '32px 28px',
        borderLeft: col > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        borderTop: index >= 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.22s ease',
        cursor: 'default',
      }}
    >
      <div style={{ fontSize: '11px', color: item.color, letterSpacing: '2px', marginBottom: '20px', fontWeight: 500 }}>{item.step}</div>
      <div style={{ fontSize: '15px', fontWeight: 500, color: hovered ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)', marginBottom: '10px', letterSpacing: '-0.2px', transition: 'color 0.22s ease' }}>{item.title}</div>
      <div style={{ fontSize: '13px', color: hovered ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.35)', lineHeight: 1.7, transition: 'color 0.22s ease' }}>{item.desc}</div>
    </div>
  )
}

export default function Home() {
  const [transitioning, setTransitioning] = useState(false)
  const loginCardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const [hoveredNavIdx, setHoveredNavIdx] = useState<number | null>(null)
  const [isNavPressed, setIsNavPressed] = useState(false)
  const [navPillStyle, setNavPillStyle] = useState({ left: 0, width: 0, opacity: 0, scale: 1 })
  const navItemsRef = useRef<(HTMLAnchorElement | null)[]>([])

  // FAQ ask-a-question
  const [faqQuestion, setFaqQuestion] = useState('')
  const [faqSent, setFaqSent] = useState(false)

  // Section reveal refs
  const howItWorksRef = useRef<HTMLElement>(null)
  const howItWorksCardsRef = useRef<(HTMLDivElement | null)[]>([])
  const pricingRef = useRef<HTMLElement>(null)
  const pricingCardsRef = useRef<(HTMLDivElement | null)[]>([])
  const faqRef = useRef<HTMLElement>(null)
  const faqCardsRef = useRef<(HTMLDivElement | null)[]>([])
  const faqAskRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Disable browser scroll restoration completely
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    // Check if we just came back from login
    const wasFromLogin = sessionStorage.getItem('navigatingBackFromLogin') === 'true'
    
    if (wasFromLogin) {
      sessionStorage.removeItem('navigatingBackFromLogin')
      
      // Instead of forcing top, let's instantly jump to the login card position
      // so the transition looks seamless
      const loginCardTop = document.getElementById('login-section')?.offsetTop || window.innerHeight * 9
      
      // Force immediate scroll without animation
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(0, loginCardTop)
      
      // Small delay to ensure browser doesn't override us, then reset scroll behavior
      requestAnimationFrame(() => {
        window.scrollTo(0, loginCardTop)
        document.documentElement.style.scrollBehavior = 'smooth'
        
        // We also need to hide the cylinder immediately to prevent visual glitches
        if (cylinderSceneRef.current) {
          cylinderSceneRef.current.style.visibility = 'hidden'
          cylinderSceneRef.current.style.opacity = '0'
        }
      })
    } else {
      // Normal visit - always start at top
      window.scrollTo(0, 0)
    }

    // Also handle page show event (back/forward cache)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const fromLogin = sessionStorage.getItem('navigatingBackFromLogin') === 'true'
        if (fromLogin) {
          sessionStorage.removeItem('navigatingBackFromLogin')
          const loginTop = document.getElementById('login-section')?.offsetTop || window.innerHeight * 9
          document.documentElement.style.scrollBehavior = 'auto'
          window.scrollTo(0, loginTop)
        } else {
          // Page was restored from bfcache
          window.scrollTo(0, 0)
          // Reset cylinder rotation
          if (cylinderSceneRef.current) {
            cylinderSceneRef.current.style.visibility = 'hidden'
            cylinderSceneRef.current.style.opacity = '0'
          }
        }
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  useEffect(() => {
    if (hoveredNavIdx !== null && navItemsRef.current[hoveredNavIdx]) {
      const el = navItemsRef.current[hoveredNavIdx]
      if (el) {
        setNavPillStyle({
          left: el.offsetLeft,
          width: el.offsetWidth,
          opacity: 1,
          scale: isNavPressed ? 1.05 : 1
        })
      }
    } else {
      setNavPillStyle(prev => ({ ...prev, opacity: 0, scale: 1 }))
    }
  }, [hoveredNavIdx, isNavPressed])
  const features = [
    {
      tag: 'Biometric',
      title: 'Face recognition attendance',
      desc: 'Multi-angle facial recognition with real-time blink liveness detection. Marks attendance in under 2 seconds — works offline with cached data when connectivity drops.',
      stroke: '#4ade80',
      bg: 'rgba(74,222,128,0.1)',
      glowPos: '44% 42%',
      path: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      details: ['5-angle facial scan', 'Blink liveness detection', 'Anti-spoofing protection', 'Works offline with cached data']
    },
    {
      tag: 'Real-time',
      title: 'Live parent tracking',
      desc: 'Attendance updates reach parents the instant it is marked via WebSocket, not polling. Curfew violations and leave status changes are pushed in real time — zero delay.',
      stroke: '#a78bfa',
      bg: 'rgba(167,139,250,0.1)',
      glowPos: '58% 58%',
      path: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4l3 3',
      details: ['WebSocket real-time updates', 'Curfew violation alerts', 'Leave status notifications', 'Emergency broadcast to parents']
    },
    {
      tag: 'GPT-4o mini',
      title: 'AI complaint analysis',
      desc: 'GPT-4o mini reads every complaint and assigns urgency in seconds. It suggests resolution steps and flags recurring patterns so wardens resolve issues before they escalate.',
      stroke: '#fbbf24',
      bg: 'rgba(251,191,36,0.1)',
      glowPos: '56% 42%',
      path: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      details: ['Auto-category detection', 'Urgency flagging', 'AI-suggested resolution', 'Predictive maintenance patterns']
    },
    {
      tag: 'Razorpay',
      title: 'Online fee collection',
      desc: 'Razorpay-powered collection for hostel and mess charges. Parents pay directly from their portal with monthly or yearly billing cycles and automatic overdue reminders.',
      stroke: '#60a5fa',
      bg: 'rgba(96,165,250,0.1)',
      glowPos: '42% 56%',
      path: 'M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM2 10h20',
      details: ['Razorpay payment gateway', 'Monthly and yearly billing', 'Parent portal payments', 'Automatic due reminders']
    },
    {
      tag: 'Instant',
      title: 'Emergency broadcast',
      desc: 'One tap broadcasts alerts to every student, warden, and parent simultaneously. Night curfew violations trigger automatic notifications without any manual intervention.',
      stroke: '#f87171',
      bg: 'rgba(248,113,113,0.1)',
      glowPos: '50% 60%',
      path: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      details: ['Instant broadcast to all', 'Night curfew auto-detection', 'Violation parent alerts', 'Emergency contact system']
    },
    {
      tag: 'Analytics',
      title: 'Maintenance analytics',
      desc: 'Analyses 30 days of complaint history to surface recurring maintenance patterns. Block-wise comparisons and staff scoring help prevent issues before they escalate again.',
      stroke: '#34d399',
      bg: 'rgba(52,211,153,0.1)',
      glowPos: '50% 40%',
      path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      details: ['30-day pattern analysis', 'Block-wise comparisons', 'Staff performance scoring', 'Warden KPI dashboard']
    },
    {
      tag: 'Management',
      title: 'Room allocation',
      desc: 'Assign rooms, process transfer requests, and monitor block occupancy from a single dashboard. Full room lifecycle management with real-time availability tracking.',
      stroke: '#fb923c',
      bg: 'rgba(251,146,60,0.1)',
      glowPos: '40% 55%',
      path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      details: ['Room assignment dashboard', 'Transfer request system', 'Block and room management', 'Occupancy tracking']
    },
    {
      tag: 'Digital',
      title: 'Visitor management',
      desc: 'Digitises the entire guest check-in flow with mandatory warden approval. Every visit is logged with timestamps, relationship type, and contact details for full traceability.',
      stroke: '#e879f9',
      bg: 'rgba(232,121,249,0.1)',
      glowPos: '60% 44%',
      path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      details: ['Warden approval flow', 'Check-in and check-out log', 'Parent visitor notifications', 'Relationship verification']
    },
    {
      tag: 'Staff',
      title: 'Staff performance',
      desc: 'Daily attendance for cleaners, security, and admin staff tracked alongside student star ratings. Monthly performance reports and KPI scores keep the entire team accountable.',
      stroke: '#38bdf8',
      bg: 'rgba(56,189,248,0.1)',
      glowPos: '58% 50%',
      path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      details: ['Daily present/absent toggle', 'Student star ratings', 'Monthly performance report', 'Attendance percentage tracking']
    },
  ]

  const cylinderRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  
  const currentRot = useRef(0)
  const targetRot = useRef(0)
  const wheelAnimRef = useRef<number | null>(null)

  const tickWheel = useCallback(function tickWheelFn() {
    if (window.innerWidth <= 768) {
      if (cylinderRef.current) cylinderRef.current.style.transform = ''
      cardsRef.current.forEach(card => {
        if (!card) return
        card.style.transform = ''
        card.style.opacity = ''
        card.style.pointerEvents = ''
        card.style.filter = ''
      })
      wheelAnimRef.current = requestAnimationFrame(tickWheelFn)
      return
    }

    currentRot.current += (targetRot.current - currentRot.current) * 0.025
    const RADIUS = window.innerWidth > 1024 ? 445 : 335

    if (cylinderRef.current) {
      cylinderRef.current.style.transform = `rotateY(${currentRot.current}deg)`
    }

    cardsRef.current.forEach((card, i) => {
      if (!card) return
      const cardAngle = i * 40
      
      let absRot = (cardAngle + currentRot.current) % 360
      if (absRot < 0) absRot += 360
      if (absRot > 180) absRot = 360 - absRot

      let opacity = 1
      let scale = 1
      let pointerEvents = 'auto'

      if (absRot < 40) {
        const progress = absRot / 40
        opacity = 1 - (1 - 0.45) * progress
        scale = 1 - (1 - 0.9) * progress
      } else if (absRot < 80) {
        const progress = (absRot - 40) / 40
        opacity = 0.45 - (0.45 - 0.15) * progress
        scale = 0.9 - (0.9 - 0.8) * progress
      } else {
        opacity = 0.15 - (0.15 - 0.05) * Math.min(1, (absRot - 80) / 100)
        scale = 0.8
        pointerEvents = 'none'
      }

      let blur = 0
      if (absRot > 40) {
        blur = Math.min((absRot - 40) * 0.1, 4)
      }

      card.style.opacity = opacity.toString()
      card.style.filter = `blur(${blur}px)`
      card.style.transform = `rotateY(${cardAngle}deg) translateZ(${RADIUS}px) scale(${scale})`
      card.style.pointerEvents = pointerEvents as "auto" | "none"
    })

    if (Math.abs(targetRot.current - currentRot.current) > 0.01) {
      wheelAnimRef.current = requestAnimationFrame(tickWheelFn)
    } else {
      currentRot.current = targetRot.current
      wheelAnimRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth <= 768) return
      if (!scrollWrapperRef.current) return

      const rect = scrollWrapperRef.current.getBoundingClientRect()

      const isInFeaturesZone = rect.top <= 0 && rect.bottom >= window.innerHeight
      if (!isInFeaturesZone && cylinderSceneRef.current) {
        // Only hide when NOT animating in/out via entryProgress/bufferProgress
        // (those ranges are handled below — don't force-zero here)
      }

      // Leave 100vh buffer at the end of the rotation to absorb scroll momentum
      const scrollSpace = rect.height - window.innerHeight * 2
      let progress = 0
      
      if (scrollSpace > 0) {
        progress = Math.max(0, Math.min(1, -rect.top / scrollSpace))
      }

      // Parallax for Hero
      if (heroTextRef.current) {
        const y = window.scrollY
        if (y < window.innerHeight) {
          // Slide upwards and fade out
          heroTextRef.current.style.transform = `translateY(${-y * 0.4}px)`
          heroTextRef.current.style.opacity = `${1 - y / (window.innerHeight * 0.4)}`
        }
      }

      // Slide in/out for carousel and "What's inside" text
      if (whatsInsideRef.current && cylinderSceneRef.current) {
        let entryProgress = 1
        if (rect.top > 0) {
          entryProgress = Math.max(0, 1 - (rect.top / window.innerHeight))
        }

        let bufferProgress = 0
        if (-rect.top > scrollSpace) {
          bufferProgress = Math.min(1, (-rect.top - scrollSpace) / window.innerHeight)
        }

        let opacityH = 1
        let opacityC = 1
        let yH = 0
        let yC = 0
        let scaleC = 1

        const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

        if (entryProgress < 1) {
          // Let IntersectionObserver CSS handle text entry
          whatsInsideRef.current.style.opacity = ''
          whatsInsideRef.current.style.transform = ''
          
          // Cylinder still fades in via scroll physics
          const cylinderP = Math.max(0, Math.min(1, (entryProgress - 0.2) * 1.5))
          const easeC = easeOutQuart(cylinderP)

          opacityC = easeC
          yC = (1 - easeC) * 150
          scaleC = 0.95 + easeC * 0.05
        } else if (bufferProgress > 0) {
          // Slide out to top during momentum buffer
          const easeProgress = easeOutQuart(bufferProgress)
          opacityH = Math.max(0, 1 - easeProgress)
          opacityC = opacityH
          yH = -easeProgress * 150
          yC = yH
          scaleC = Math.max(0.9, 1 - easeProgress * 0.05)
        }

        if (entryProgress >= 1 || bufferProgress > 0) {
          whatsInsideRef.current.style.opacity = `${opacityH}`
          whatsInsideRef.current.style.transform = `translateY(${yH}px)`
        }

        cylinderSceneRef.current.style.opacity = `${opacityC}`
        cylinderSceneRef.current.style.transform = `translateY(${yC}px) scale(${scaleC})`
      }


      
      const safeProgress = Math.max(0, Math.min(1, progress))
      targetRot.current = safeProgress * -360
      
      if (!wheelAnimRef.current) wheelAnimRef.current = requestAnimationFrame(tickWheel)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    currentRot.current = targetRot.current
    
    if (!wheelAnimRef.current) wheelAnimRef.current = requestAnimationFrame(tickWheel)

    const onResize = () => {
      handleScroll()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', onResize)
      if (wheelAnimRef.current) cancelAnimationFrame(wheelAnimRef.current)
    }
  }, [tickWheel])
  const cardRef = useRef<HTMLDivElement>(null)
  const fc1Ref = useRef<HTMLDivElement>(null)
  const fc2Ref = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  const loginLeftRef = useRef<HTMLDivElement>(null)
  const loginRightRef = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)
  const whatsInsideRef = useRef<HTMLDivElement>(null)
  const cylinderSceneRef = useRef<HTMLDivElement>(null)
  const loginWrapperRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const target = useRef({ x: 3.6, y: -7.2 })
  const current = useRef({ x: 3.6, y: -7.2 })

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.revealVisible)
        } else {
          entry.target.classList.remove(styles.revealVisible)
        }
      })
    }, { threshold: 0.25 })

    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.revealVisible)
        }
        // cards only animate in once — no remove on exit
      })
    }, { threshold: 0.12 })

    if (footerRef.current) observer.observe(footerRef.current)
    if (whatsInsideRef.current) observer.observe(whatsInsideRef.current)
    if (loginLeftRef.current) observer.observe(loginLeftRef.current)
    if (loginRightRef.current) observer.observe(loginRightRef.current)

    // New sections
    if (howItWorksRef.current) observer.observe(howItWorksRef.current)
    if (pricingRef.current) observer.observe(pricingRef.current)
    if (faqRef.current) observer.observe(faqRef.current)
    if (faqAskRef.current) cardObserver.observe(faqAskRef.current)

    howItWorksCardsRef.current.forEach(el => { if (el) cardObserver.observe(el) })
    pricingCardsRef.current.forEach(el => { if (el) cardObserver.observe(el) })
    faqCardsRef.current.forEach(el => { if (el) cardObserver.observe(el) })

    return () => { observer.disconnect(); cardObserver.disconnect() }
  }, [])
  const activeStates = useRef({ fc1: false, fc2: false })
  const timers = useRef<{ fc1: number | null, fc2: number | null }>({ fc1: null, fc2: null })

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(function tickFn() {
    const el = cardRef.current
    if (!el) return
    current.current.x = lerp(current.current.x, target.current.x, 0.025)
    current.current.y = lerp(current.current.y, target.current.y, 0.025)
    el.style.transform = `rotateY(${current.current.y}deg) rotateX(${current.current.x}deg)`
    if (Math.abs(current.current.x - target.current.x) > 0.005 || Math.abs(current.current.y - target.current.y) > 0.005) {
      animRef.current = requestAnimationFrame(tickFn)
    } else {
      animRef.current = null
    }
  }, [])

  const startAnim = useCallback(() => {
    if (!animRef.current) animRef.current = requestAnimationFrame(tick)
  }, [tick])

  const handleLoginCardClick = useCallback(() => {
    if (transitioning) return
    setTransitioning(true)

    try {
      sessionStorage.setItem('fromLoginTransition', 'true')
      sessionStorage.setItem('loginScrollY', window.scrollY.toString())
      sessionStorage.setItem('loginExitTime', Date.now().toString())
    } catch {
      // Ignore
    }

    const card = loginCardRef.current
    if (!card) {
      window.location.href = '/login'
      return
    }

    const rect = card.getBoundingClientRect()
    const viewportCX = window.innerWidth / 2
    const viewportCY = window.innerHeight / 2
    const cardCX = rect.left + rect.width / 2
    const cardCY = rect.top + rect.height / 2

    const translateX = viewportCX - cardCX
    const translateY = viewportCY - cardCY

    card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease'
    card.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.04)`
    card.style.boxShadow = '0 40px 80px rgba(0,0,0,0.6)'
    card.style.zIndex = '999'

    if (overlayRef.current) {
      overlayRef.current.style.transition = 'opacity 0.25s ease'
      overlayRef.current.style.opacity = '1'
    }

    setTimeout(() => {
      window.location.href = '/login'
    }, 250)
  }, [transitioning])

  const handleNavSigninClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (transitioning) return
    setTransitioning(true)

    try {
      sessionStorage.setItem('fromLoginTransition', 'true')
      sessionStorage.setItem('loginScrollY', window.scrollY.toString())
      sessionStorage.setItem('loginExitTime', Date.now().toString())
    } catch {
      // Ignore
    }

    if (overlayRef.current) {
      overlayRef.current.style.transition = 'opacity 0.25s ease'
      overlayRef.current.style.opacity = '1'
    }

    setTimeout(() => {
      window.location.href = '/login'
    }, 250)
  }, [transitioning])

  useEffect(() => {
    const doReverseTransition = () => {
      setTransitioning(false)
      
      if (loginCardRef.current) {
        loginCardRef.current.style.transition = 'none'
        loginCardRef.current.style.transform = ''
        loginCardRef.current.style.boxShadow = ''
        loginCardRef.current.style.zIndex = ''
        requestAnimationFrame(() => {
          if (loginCardRef.current) loginCardRef.current.style.transition = ''
        })
      }

      if (overlayRef.current) {
        if (overlayRef.current.style.opacity !== '1') {
          overlayRef.current.style.transition = 'none'
          overlayRef.current.style.opacity = '1'
          // Force layout reflow
          void overlayRef.current.offsetHeight
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (overlayRef.current) {
              overlayRef.current.style.transition = 'opacity 0.35s ease'
              overlayRef.current.style.opacity = '0'
            }
          })
        })

        setTimeout(() => {
          if (overlayRef.current) overlayRef.current.style.transition = 'opacity 0.4s ease'
        }, 350)
      }
    }

    const scrollToExactPosition = () => {
      let targetScrollY = 0; // Default to top
      try {
        const stored = sessionStorage.getItem('loginScrollY')
        const exitTime = sessionStorage.getItem('loginExitTime')
        if (stored !== null) {
          if (exitTime) {
            const timeDiff = Date.now() - parseInt(exitTime, 10)
            if (timeDiff > 10 * 60 * 1000) { // 10 minutes idle
              targetScrollY = 0
            } else {
              targetScrollY = parseInt(stored, 10)
            }
          } else {
            targetScrollY = parseInt(stored, 10)
          }
        }
      } catch { }

      const applyScroll = () => {
        if (!isNaN(targetScrollY) && targetScrollY >= 0) {
          window.scrollTo({ top: targetScrollY, behavior: 'instant' })
          
          // Synchronize layout bounds synchronously
          if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect()
            const scrollSpace = Math.max(1, rect.height - window.innerHeight * 2)
            let progress = 0
            if (-rect.top > 0) {
              progress = Math.min(1, -rect.top / scrollSpace)
            }
            targetRot.current = progress * -360
            currentRot.current = targetRot.current
          }
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
      }

      // Aggressively enforce scroll for 1 second to overpower Next.js native
      // scroll restoration and layout hydration clamping after BFCache eviction.
      applyScroll()
      let attempts = 0
      const interval = setInterval(() => {
        applyScroll()
        attempts++
        if (attempts > 20) { // 1000ms
          clearInterval(interval)
          window.dispatchEvent(new Event('scroll'))
        }
      }, 50)
    }

    const handleReturnFromLogin = () => {
      scrollToExactPosition()
      doReverseTransition()
    }

    try {
      if (sessionStorage.getItem('navigatingBackFromLogin') === 'true') {
        sessionStorage.removeItem('navigatingBackFromLogin')
        handleReturnFromLogin()
      } else if (sessionStorage.getItem('playReverseTransition') === 'true') {
        sessionStorage.removeItem('playReverseTransition')
        handleReturnFromLogin()
      }
    } catch {
      // Ignore
    }

    const handlePageShow = (e: PageTransitionEvent) => {
      try {
        if (e.persisted || sessionStorage.getItem('navigatingBackFromLogin') === 'true') {
          sessionStorage.removeItem('navigatingBackFromLogin')
          handleReturnFromLogin()
        }
      } catch { /* ignore */ }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Bulletproof scroll position tracking constantly and on exit
  useEffect(() => {
    let ticking = false
    const saveScroll = () => {
      try {
        sessionStorage.setItem('loginScrollY', window.scrollY.toString())
        sessionStorage.setItem('loginExitTime', Date.now().toString())
      } catch {}
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(saveScroll)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('beforeunload', saveScroll)
    window.addEventListener('pagehide', saveScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('beforeunload', saveScroll)
      window.removeEventListener('pagehide', saveScroll)
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return

    // Tilt
    const rect = el.getBoundingClientRect()
    const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)))
    const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)))
    target.current = { x: dy * -12.6, y: dx * 12.6 }
    startAnim()

    // Proximity — fires even when hovering the main card's edge
    const fc1 = fc1Ref.current
    if (fc1) {
      if (isNear(fc1.getBoundingClientRect(), e.clientX, e.clientY)) {
        if (!activeStates.current.fc1 && !timers.current.fc1) {
          timers.current.fc1 = window.setTimeout(() => {
            activeStates.current.fc1 = true
            timers.current.fc1 = null
            activateCard(fc1, '0px, 0px')
          }, 585)
        }
      } else {
        if (timers.current.fc1) {
          window.clearTimeout(timers.current.fc1)
          timers.current.fc1 = null
        }
        activeStates.current.fc1 = false
        resetCard(fc1, '4px, 4px')
      }
    }

    const fc2 = fc2Ref.current
    if (fc2) {
      if (isNear(fc2.getBoundingClientRect(), e.clientX, e.clientY)) {
        if (!activeStates.current.fc2 && !timers.current.fc2) {
          timers.current.fc2 = window.setTimeout(() => {
            activeStates.current.fc2 = true
            timers.current.fc2 = null
            activateCard(fc2, '0px, 0px')
          }, 585)
        }
      } else {
        if (timers.current.fc2) {
          window.clearTimeout(timers.current.fc2)
          timers.current.fc2 = null
        }
        activeStates.current.fc2 = false
        resetCard(fc2, '-4px, -4px')
      }
    }
  }, [startAnim])

  const handleMouseLeave = useCallback(() => {
    target.current = { x: 3.6, y: -7.2 }
    startAnim()

    if (timers.current.fc1) {
      window.clearTimeout(timers.current.fc1)
      timers.current.fc1 = null
    }
    activeStates.current.fc1 = false
    if (fc1Ref.current) resetCard(fc1Ref.current, '4px, 4px')

    if (timers.current.fc2) {
      window.clearTimeout(timers.current.fc2)
      timers.current.fc2 = null
    }
    activeStates.current.fc2 = false
    if (fc2Ref.current) resetCard(fc2Ref.current, '-4px, -4px')
  }, [startAnim])

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (timers.current.fc1) window.clearTimeout(timers.current.fc1)
      if (timers.current.fc2) window.clearTimeout(timers.current.fc2)
    }
  }, [])

  return (
    <div className={styles.site}>
      <div className={styles.glow} />
      <div className={styles.glow2} />
      <div className={styles.noise} />
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#080810',
          opacity: 0,
          zIndex: 998,
          pointerEvents: 'none',
          transition: 'opacity 0.4s ease'
        }}
      />

      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.logoDot} />
          HostelMate
          <span className={styles.logoSub}>by Nivo</span>
        </div>
        <div 
          className={styles.navCenter}
          onMouseLeave={() => { setHoveredNavIdx(null); setIsNavPressed(false); }}
          onMouseUp={() => setIsNavPressed(false)}
          onPointerCancel={() => setIsNavPressed(false)}
        >
          <div 
            className={styles.navPill}
            style={{
              width: navPillStyle.width,
              opacity: navPillStyle.opacity,
              transform: `translateX(${navPillStyle.left}px) scale(${navPillStyle.scale})`
            }}
          />
          {['Features', 'How it works', 'Pricing', 'FAQ'].map((label, i) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/\s+/g, '')}`}
              className={styles.navLink}
              draggable={false}
              ref={(el) => { navItemsRef.current[i] = el }}
              onMouseEnter={() => setHoveredNavIdx(i)}
              onMouseDown={() => setIsNavPressed(true)}
            >
              {label}
            </a>
          ))}
        </div>
        <div className={styles.navRight}>
          <Link href="/login" onClick={handleNavSigninClick} className={styles.navSignin}>Sign in</Link>
          <button className={styles.navBtn}>Request demo ↗</button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div ref={heroTextRef}>
          <h1 className={styles.heroTitle}>
            Run your hostel.<br />
            <span className={styles.heroTitleDim}>Not paperwork.</span>
          </h1>
          <p className={styles.heroSub}>
            Smart hostel management built for Indian institutions. Attendance, complaints, mess, fees — all in one place.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.btnPrimary}>Request a demo</button>
            <button className={styles.btnGhost}>See how it works</button>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.trustDots}>
              <div className={styles.trustDot} />
              <div className={styles.trustDot} />
              <div className={styles.trustDot} />
            </div>
            <span className={styles.heroTrustText}>Built for 500+ student hostels</span>
          </div>
        </div>

        <div
          className={styles.heroVisual}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={fc1Ref} className={styles.floatingCard}>
            <div className={styles.floatingIcon} style={{ background: 'rgba(74,222,128,0.12)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <div className={styles.floatingTextTop}>Attendance marked</div>
              <div className={styles.floatingTextSub}>Face verified · just now</div>
            </div>
          </div>

          <div ref={cardRef} className={styles.dashboard3d} style={{ transform: 'rotateY(-8deg) rotateX(4deg)' }}>
            <div className={styles.dashHeader}>
              <span className={styles.dashTitle}>Warden dashboard</span>
              <span className={styles.dashDate} suppressHydrationWarning>Today, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
            </div>
            <div className={styles.dashStats}>
              <div className={styles.dashStat}>
                <div className={styles.dashStatLabel}>Attendance</div>
                <div className={`${styles.dashStatVal} ${styles.green}`}>87%</div>
              </div>
              <div className={styles.dashStat}>
                <div className={styles.dashStatLabel}>Pending leaves</div>
                <div className={`${styles.dashStatVal} ${styles.amber}`}>4</div>
              </div>
              <div className={styles.dashStat}>
                <div className={styles.dashStatLabel}>Open complaints</div>
                <div className={`${styles.dashStatVal} ${styles.red}`}>2</div>
              </div>
            </div>
            <div className={styles.dashCards}>
              <div className={styles.dashCard}>
                <div className={styles.dashCardLabel}>Mess rating</div>
                <div className={styles.dashCardVal}>4.2 / 5</div>
                <div className={styles.dashBar}><div className={styles.dashBarFill} style={{ width: '84%', background: '#4ade80' }} /></div>
              </div>
              <div className={styles.dashCard}>
                <div className={styles.dashCardLabel}>Fees collected</div>
                <div className={styles.dashCardVal}>₹18.4L</div>
                <div className={styles.dashBar}><div className={styles.dashBarFill} style={{ width: '75%', background: '#a78bfa' }} /></div>
              </div>
              <div className={styles.dashCard}>
                <div className={styles.dashCardLabel}>Staff present</div>
                <div className={styles.dashCardVal}>12 / 14</div>
                <div className={styles.dashBar}><div className={styles.dashBarFill} style={{ width: '86%', background: '#60a5fa' }} /></div>
              </div>
              <div className={styles.dashCard}>
                <div className={styles.dashCardLabel}>Curfew violations</div>
                <div className={styles.dashCardVal}>0 tonight</div>
                <div className={styles.dashBar}><div className={styles.dashBarFill} style={{ width: '0%', background: '#f87171' }} /></div>
              </div>
            </div>
          </div>

          <div ref={fc2Ref} className={styles.floatingCard2}>
            <div className={styles.floatingIcon} style={{ background: 'rgba(139,92,246,0.15)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div>
              <div className={styles.floatingTextTop} style={{ fontSize: '11px' }}>Face scan active</div>
              <div className={styles.floatingTextSub}>Liveness + 5-angle</div>
            </div>
          </div>
        </div>
        <div className={styles.heroScrollHint}>
          <span className={styles.heroScrollHintText}>Scroll to explore</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </section>

      <div className={styles.featuresScrollWrapper} ref={scrollWrapperRef}>
        <section id="features" className={styles.features}>
          <div ref={whatsInsideRef} className={`${styles.featuresHeader} ${styles.revealUp}`}>
            <div className={styles.featuresLabel}>What&apos;s inside</div>
          </div>

          <div ref={cylinderSceneRef} className={styles.cylinderScene}>
            <div ref={cylinderRef} className={styles.cylinder}>
              {features.map((f, i) => (
                <div 
                  key={i} 
                  className={styles.cylinderCard}
                  ref={(el) => {
                    cardsRef.current[i] = el;
                  }}
                  style={{
                    background: `radial-gradient(ellipse at ${f.glowPos}, ${f.bg} 0%, transparent 50%), rgba(10, 14, 28, 0.92)`,
                  }}
                >
                  <div className={styles.featureIconRow}>
                    <div
                      className={styles.featureIcon}
                      style={{ background: f.bg, borderColor: f.stroke + '38' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke={f.stroke}>
                        <path d={f.path}/>
                      </svg>
                    </div>
                    <span className={styles.featureTag} style={{ color: f.stroke + '99' }}>{f.tag}</span>
                  </div>
                  <div className={styles.featureTitle}>{f.title}</div>
                  <div className={styles.featureDesc}>{f.desc}</div>
                  <div className={styles.featureDetails}>
                    {f.details.map((d, j) => (
                      <div key={j} className={styles.featureDetailItem}>
                        <div className={styles.featureDetailDot} style={{ background: f.stroke + '59' }} />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div id="login-section" ref={loginWrapperRef} className={styles.loginScrollWrapper}>
        <section className={styles.loginPreview}>
          <div className={styles.sectionEyebrow}>Sign in experience</div>
          <div className={styles.loginLayout}>
            <div ref={loginLeftRef} className={`${styles.revealUp} ${styles.stagger1}`}>
              <h2 className={styles.loginLeftH2}>
                Your role.<br />Your dashboard.
              </h2>
              <p className={styles.loginLeftP}>
                Three distinct experiences — student, warden, and parent — each designed around what actually matters to that person. No clutter, no irrelevant data.
              </p>
              <div className={styles.loginRoleList}>
                <div className={styles.loginRoleItem}>
                  <div className={styles.loginRoleDot} style={{background:'#fb923c'}}/>
                  <div>
                    <div className={styles.loginRoleTitle}>Student</div>
                    <div className={styles.loginRoleDesc}>Attendance, leaves, fees, complaints</div>
                  </div>
                </div>
                <div className={styles.loginRoleItem}>
                  <div className={styles.loginRoleDot} style={{background:'#a78bfa'}}/>
                  <div>
                    <div className={styles.loginRoleTitle}>Warden</div>
                    <div className={styles.loginRoleDesc}>Full management, analytics, approvals</div>
                  </div>
                </div>
                <div className={styles.loginRoleItem}>
                  <div className={styles.loginRoleDot} style={{background:'#60a5fa'}}/>
                  <div>
                    <div className={styles.loginRoleTitle}>Parent</div>
                    <div className={styles.loginRoleDesc}>Live tracking, fee payments, notices</div>
                  </div>
                </div>
              </div>
            </div>
            <div
              ref={(node) => {
                loginRightRef.current = node;
                loginCardRef.current = node;
              }}
              className={`${styles.loginCard} ${styles.loginCardClickable} ${styles.revealUp} ${styles.stagger2}`}
              style={{cursor: 'pointer'}}
              onClick={handleLoginCardClick}
            >
              <div className={styles.loginLogo}>HostelMate</div>
              <div className={styles.loginBy}>by Nivo Technologies</div>
              <div className={styles.roleTabs}>
                <div className={`${styles.roleTab} ${styles.roleTabActive}`}>Student</div>
                <div className={styles.roleTab}>Warden</div>
                <div className={styles.roleTab}>Parent</div>
              </div>
              <div className={styles.loginField}>
                <div className={styles.loginLabel}>Email address</div>
                <div className={styles.loginInput}>student@college.edu</div>
              </div>
              <div className={styles.loginField}>
                <div className={styles.loginLabel}>Password</div>
                <div className={styles.loginInput} style={{ position: 'relative', paddingRight: '60px' }}>
                  ••••••••••
                  <PreviewGooglyEyes />
                </div>
              </div>
              <button className={styles.loginBtn}>Sign in</button>
            </div>
          </div>
        </section>
      </div>

      {/* HOW IT WORKS — sticky wrapper */}
      <div className={styles.sectionStickyWrapper}>
        <div className={styles.stickyPageSection}>
          <section
            id="howitworks"
            ref={howItWorksRef as React.RefObject<HTMLElement>}
            style={{ width: '100%', maxWidth: '1200px', padding: '0 48px' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
              How it works
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.6px', color: '#fff', marginBottom: '28px', lineHeight: 1.15 }}>
              Live in 15 minutes. <span style={{ color: 'rgba(255,255,255,0.28)' }}>Zero learning curve.</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
              {[
                { step: '01', color: '#4ade80', title: 'Create your hostel', desc: 'Name it, add blocks and rooms. Skeleton is live in 15 min.' },
                { step: '02', color: '#a78bfa', title: 'Add students & staff', desc: 'CSV import or individual invite. One face scan = lifetime pass.' },
                { step: '03', color: '#60a5fa', title: 'Connect parents', desc: 'Link a parent email. They get a live portal — no app needed.' },
                { step: '04', color: '#fbbf24', title: 'Attendance marks itself', desc: 'Face matched in 2s at entry. QR fallback always available.' },
                { step: '05', color: '#f87171', title: 'AI triages complaints', desc: 'GPT-4o mini assigns urgency and suggests a fix. Warden just reviews.' },
                { step: '06', color: '#34d399', title: 'Fees collect themselves', desc: 'Razorpay reminders auto-go. Parents pay from their portal.' },
              ].map((item, i) => (
                <HowItWorksCard
                  key={i}
                  item={item}
                  index={i}
                  cardRef={el => { howItWorksCardsRef.current[i] = el }}
                  staggerClass={[styles.stagger5, styles.stagger6, styles.stagger7, styles.stagger8, styles.stagger9, styles.stagger10][i]}
                  cardRevealClass={styles.cardReveal}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* PRICING — sticky wrapper */}
      <div className={styles.sectionStickyWrapper}>
        <div className={styles.stickyPageSection}>
          <section
            id="pricing"
            ref={pricingRef as React.RefObject<HTMLElement>}
            style={{ width: '100%', maxWidth: '1200px', padding: '0 48px' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Pricing</div>
            <h2 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.6px', color: '#fff', marginBottom: '6px', lineHeight: 1.1 }}>
              Simple pricing. <span style={{ color: 'rgba(255,255,255,0.28)' }}>No surprises.</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '28px', lineHeight: 1.6 }}>
              First 10 hostels get 3 months free. No credit card required.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              {[
                {
                  name: 'Starter', price: 'Free', sub: 'First 3 months',
                  color: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)',
                  dot: 'rgba(255,255,255,0.3)',
                  features: ['Up to 200 students', 'All core modules', 'Face recognition', 'Email support'],
                  cta: 'Get started free', ctaBg: 'rgba(255,255,255,0.08)', ctaColor: 'rgba(255,255,255,0.7)',
                },
                {
                  name: 'Pro', price: '₹4,999', sub: 'per month',
                  color: 'rgba(124,92,252,0.08)', border: 'rgba(124,92,252,0.3)',
                  dot: '#a78bfa',
                  features: ['Unlimited students', 'AI complaint triage', 'Razorpay integration', 'Priority support'],
                  cta: 'Request demo', ctaBg: '#7c5cfc', ctaColor: '#fff',
                },
                {
                  name: 'Max', price: '₹9,999', sub: 'per month',
                  color: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.3)',
                  dot: '#fb923c',
                  features: ['Everything in Pro', 'Multi-hostel management', 'Custom analytics & reports', 'Dedicated account manager'],
                  cta: 'Contact sales', ctaBg: '#fb923c', ctaColor: '#080810',
                },
              ].map((plan, i) => (
                <div
                  key={i}
                  ref={el => { pricingCardsRef.current[i] = el }}
                  className={`${styles.cardReveal} ${[styles.stagger5, styles.stagger6, styles.stagger7][i]}`}
                  style={{ background: plan.color, border: `0.5px solid ${plan.border}`, borderRadius: '16px', padding: '26px 24px' }}
                >
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>{plan.name}</div>
                  <div style={{ fontSize: '30px', fontWeight: 500, color: '#fff', letterSpacing: '-1px', marginBottom: '3px' }}>{plan.price}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginBottom: '20px' }}>{plan.sub}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '9px', marginBottom: '20px' }}>
                    {plan.features.map((f, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: plan.dot, flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                  <button style={{ width: '100%', background: plan.ctaBg, color: plan.ctaColor, border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* FAQ — sticky wrapper */}
      <div className={styles.sectionStickyWrapper}>
        <div className={styles.stickyPageSection}>
          <section
            id="faq"
            ref={faqRef as React.RefObject<HTMLElement>}
            style={{ width: '100%', maxWidth: '1200px', padding: '0 48px' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '28px' }}>FAQ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
              {[
                { q: 'How long does setup take?', a: 'Under 30 minutes. Add your hostel details, create student accounts, and you\'re live.' },
                { q: 'Does face recognition work without internet?', a: 'Face matching runs in the browser — no data leaves the device during verification.' },
                { q: 'Can parents pay fees directly?', a: 'Yes. Parents have their own portal with Razorpay integration for hostel and mess fees.' },
                { q: 'Is student data secure?', a: 'Row-level security on all tables. JWT auth. Face descriptors stored as numbers, not images.' },
              ].map((item, i) => (
                <div
                  key={i}
                  ref={el => { faqCardsRef.current[i] = el }}
                  className={`${styles.cardReveal} ${[styles.stagger5, styles.stagger6, styles.stagger7, styles.stagger8][i]}`}
                  style={{ background: '#080810', padding: '22px 24px' }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)', marginBottom: '8px' }}>{item.q}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.65 }}>{item.a}</div>
                </div>
              ))}
            </div>

            {/* Ask a question */}
            <div
              ref={faqAskRef}
              className={`${styles.faqAskBox} ${styles.cardReveal} ${styles.stagger8}`}
              style={{ marginTop: '0', padding: '22px 24px' }}
            >
              <div className={styles.faqAskLabel}>Still have a question?</div>
              {faqSent ? (
                <div className={styles.faqAskSent}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  Got it — we&apos;ll be in touch soon.
                </div>
              ) : (
                <div className={styles.faqAskRow}>
                  <input
                    className={styles.faqAskInput}
                    type="text"
                    placeholder="Type your question…"
                    value={faqQuestion}
                    onChange={e => setFaqQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && faqQuestion.trim()) setFaqSent(true) }}
                  />
                  <button className={styles.faqAskBtn} onClick={() => { if (faqQuestion.trim()) setFaqSent(true) }}>
                    Send
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        ref={footerRef}
        className={`${styles.footer} ${styles.revealUp} ${styles.stagger3}`}
        style={{ position: 'relative', bottom: 'auto', left: 'auto', width: 'auto', maxWidth: '1200px', margin: '0 auto' }}
      >
        <div className={styles.footerLeft}>HostelMate — Nivo Technologies</div>
        <div className={styles.footerRight}>Private · Not for distribution</div>
      </footer>
    </div>
  )
}
// layout behavior
// layout behavior


// stability check 1
// stability check 2
// stability check 3
// stability check 4
// stability check 5
// stability check 6
// stability check 7
// stability check 8
// stability check 9
// stability check 10
// stability check 11
// stability check 12
// stability check 13
// stability check 14
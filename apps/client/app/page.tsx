'use client'

import Link from 'next/link'
import { useRef, useCallback, useEffect } from 'react'
import styles from './landing.module.css'

const PROXIMITY = 48 // px — how close to a floating card triggers it

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

export default function Home() {
  const cardRef = useRef<HTMLDivElement>(null)
  const fc1Ref = useRef<HTMLDivElement>(null)
  const fc2Ref = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const target = useRef({ x: 4, y: -8 })
  const current = useRef({ x: 4, y: -8 })
  const activeStates = useRef({ fc1: false, fc2: false })
  const timers = useRef<{ fc1: number | null, fc2: number | null }>({ fc1: null, fc2: null })

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(function tickFn() {
    const el = cardRef.current
    if (!el) return
    current.current.x = lerp(current.current.x, target.current.x, 0.07)
    current.current.y = lerp(current.current.y, target.current.y, 0.07)
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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return

    // Tilt
    const rect = el.getBoundingClientRect()
    const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)))
    const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)))
    target.current = { x: dy * -14, y: dx * 14 }
    startAnim()

    // Proximity — fires even when hovering the main card's edge
    const fc1 = fc1Ref.current
    if (fc1) {
      if (isNear(fc1.getBoundingClientRect(), e.clientX, e.clientY)) {
        if (!activeStates.current.fc1 && !timers.current.fc1) {
          timers.current.fc1 = window.setTimeout(() => {
            activeStates.current.fc1 = true
            activateCard(fc1, '0px, 0px')
          }, 225)
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
            activateCard(fc2, '0px, 0px')
          }, 225)
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
    target.current = { x: 4, y: -8 }
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

      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.logoDot} />
          HostelMate
          <span className={styles.logoSub}>by Nivo</span>
        </div>
        <div className={styles.navCenter}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#howitworks" className={styles.navLink}>How it works</a>
          <a href="#pricing" className={styles.navLink}>Pricing</a>
          <a href="#faq" className={styles.navLink}>FAQ</a>
        </div>
        <div className={styles.navRight}>
          <Link href="/login" className={styles.navSignin}>Sign in</Link>
          <button className={styles.navBtn}>Request demo ↗</button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
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
              <span className={styles.dashDate}>Today, June 7</span>
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
      </section>

      <section id="features" className={styles.features}>
        <div className={styles.featuresLabel}>What&apos;s inside</div>
        <div className={styles.featuresGrid}>
          {[
            { icon: '#4ade80', stroke: '#4ade80', tag: 'Anti-spoofing', title: 'Face recognition attendance', desc: '5-angle scan with blink detection. No phone handover proxy possible.', path: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
            { icon: '#a78bfa', stroke: '#a78bfa', tag: 'Real-time', title: 'Live parent tracking', desc: "Parents see attendance the moment it's marked via WebSocket.", path: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4l3 3' },
            { icon: '#fbbf24', stroke: '#fbbf24', tag: 'GPT-4o mini', title: 'AI complaint analysis', desc: 'Auto-categorises and flags urgent issues. Suggests resolution steps.', path: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
            { icon: '#60a5fa', stroke: '#60a5fa', tag: 'Razorpay', title: 'Online fee collection', desc: 'Mess + hostel fees. Monthly or yearly. Parents can pay directly.', path: 'M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM2 10h20' },
            { icon: '#f87171', stroke: '#f87171', tag: 'Instant', title: 'Emergency broadcast', desc: 'One click to notify all students and staff simultaneously.', path: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
            { icon: '#34d399', stroke: '#34d399', tag: 'Predictive', title: 'Maintenance analytics', desc: 'Pattern detection from complaint history. Prevents recurring issues.', path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          ].map((f, i) => (
            <div key={i} className={styles.featureCell}>
              <div className={styles.featureIconRow}>
                <div className={styles.featureIcon} style={{ background: `rgba(${f.icon === '#4ade80' ? '74,222,128' : f.icon === '#a78bfa' ? '167,139,250' : f.icon === '#fbbf24' ? '251,191,36' : f.icon === '#60a5fa' ? '96,165,250' : f.icon === '#f87171' ? '248,113,113' : '52,211,153'},0.1)` }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.stroke} strokeWidth="1.5"><path d={f.path} /></svg>
                </div>
                <span className={styles.featureTag}>{f.tag}</span>
              </div>
              <div className={styles.featureTitle}>{f.title}</div>
              <div className={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.loginPreview}>
        <div className={styles.sectionEyebrow}>Sign in experience</div>
        <div className={styles.loginLayout}>
          <div>
            <h2 className={styles.loginLeftH2}>Three roles.<br />One clean login.</h2>
            <p className={styles.loginLeftP}>Students, wardens, and parents each get a tailored dashboard. The 3D cursor-reactive background activates on the login screen — subtle motion that makes it feel alive without distracting.</p>
            <div className={styles.loginTags}>
              <span className={styles.loginTag}>cursor parallax</span>
              <span className={styles.loginTag}>magnetic buttons</span>
              <span className={styles.loginTag}>3D card tilt</span>
              <span className={styles.loginTag}>smooth transitions</span>
            </div>
          </div>
          <div className={styles.loginCard}>
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
              <div className={styles.loginInput}>••••••••••</div>
            </div>
            <button className={styles.loginBtn}>Sign in</button>
            <div className={styles.loginHint}>
              <div className={styles.loginHintDot} />
              <div className={styles.loginHintText}>Move your cursor on the login page — a 3D depth field responds to your mouse position using Three.js particles</div>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>HostelMate — Nivo Technologies</div>
        <div className={styles.footerRight}>Private · Not for distribution</div>
      </footer>
    </div>
  )
}

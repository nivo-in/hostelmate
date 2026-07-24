/**
 * @file apps/client/app/demo/page.tsx
 * Source code module for HostelMate page.tsx.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { container, input } from '@/lib/ui';
import landingStyles from '../landing.module.css';

type Institution = { name: string; city: string; state?: string; type?: string };

const GREEN = '#4ade80';

// Green accent button — matches the landing-page spotlight palette.
const greenBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(74,222,128,0.12)',
  border: '0.5px solid rgba(74,222,128,0.35)',
  borderRadius: '10px',
  fontWeight: 500,
  color: GREEN,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

// Accepts institutional, custom-domain, and personal emails alike.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Configure the demo video via env (NEXT_PUBLIC_DEMO_VIDEO_ID = YouTube id).
const DEMO_VIDEO_ID = process.env.NEXT_PUBLIC_DEMO_VIDEO_ID || '';

type BentoFeature = {
  id: string;
  tag: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  stroke: string;
  bg: string;
  glow: string;
  gridArea: string;
  iconSize: number;
  iconBoxSize: number;
  pad: string;
  titleSize: number;
  hero?: boolean;
  isRow?: boolean;
  iconMarginLeft?: string;
};

const BENTO_FEATURES: BentoFeature[] = [
  {
    id: 'ai',
    tag: 'Llama 3.1 8b',
    title: 'Autonomous AI Assistant',
    desc: 'Powers the Warden Assistant and student helper — understands natural language to post notices, approve leaves, and triage complaint urgency in seconds.',
    icon: <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
    stroke: '#fbbf24', bg: 'rgba(251,191,36,0.14)', glow: '28% 18%',
    gridArea: '1 / 1 / 4 / 6',
    iconSize: 115, iconBoxSize: 170, pad: '26px', titleSize: 19, hero: true,
  },
  {
    id: 'biometric',
    tag: 'Biometric',
    title: 'Face attendance',
    desc: 'Multi-angle facial recognition with blink liveness detection. Marks attendance in under 2 seconds — works offline.',
    icon: <path d="M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01" />,
    stroke: '#4ade80', bg: 'rgba(74,222,128,0.14)', glow: '82% 12%',
    gridArea: '1 / 6 / 3 / 13',
    iconSize: 56, iconBoxSize: 96, pad: '24px', titleSize: 16,
  },
  {
    id: 'realtime',
    tag: 'Real-time',
    title: 'Live parent tracking',
    desc: 'Attendance and curfew updates reach parents the instant they happen, over WebSocket.',
    icon: <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4l3 3" />,
    stroke: '#a78bfa', bg: 'rgba(167,139,250,0.14)', glow: '50% 120%',
    gridArea: '3 / 6 / 4 / 13',
    iconSize: 46, iconBoxSize: 80, pad: '0 22px 0 12px', isRow: true, titleSize: 15,
  },
  {
    id: 'razorpay',
    tag: 'Razorpay',
    title: 'Fee collection',
    desc: 'Online payments with automatic reminders.',
    icon: <path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM2 10h20" />,
    stroke: '#60a5fa', bg: 'rgba(96,165,250,0.14)', glow: '50% 120%',
    gridArea: '4 / 1 / 5 / 7',
    iconSize: 46, iconBoxSize: 80, pad: '0 22px 0 0', isRow: true, titleSize: 15, iconMarginLeft: '-18px',
  },
  {
    id: 'emergency',
    tag: 'Instant',
    title: 'Emergency broadcast',
    desc: 'One tap alerts every student, warden & parent.',
    icon: <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    stroke: '#f87171', bg: 'rgba(248,113,113,0.14)', glow: '50% 120%',
    gridArea: '4 / 7 / 5 / 13',
    iconSize: 46, iconBoxSize: 80, pad: '0 22px 0 12px', isRow: true, titleSize: 15, iconMarginLeft: '-10px',
  },
];

export default function DemoPage() {
  const { apiGet, apiPost } = useApi();

  const [collegeName, setCollegeName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<Institution[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);
  const [buildings, setBuildings] = useState('');
  const [students, setStudents] = useState('');
  const [query, setQuery] = useState('');

  const [hoveredNavIdx, setHoveredNavIdx] = useState<number | null>(null);
  const [isNavPressed, setIsNavPressed] = useState(false);
  const [navPillStyle, setNavPillStyle] = useState({ left: 0, width: 0, opacity: 0, scale: 1 });
  const navItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (hoveredNavIdx !== null && navItemsRef.current[hoveredNavIdx]) {
      const el = navItemsRef.current[hoveredNavIdx];
      if (el) {
        setNavPillStyle({
          left: el.offsetLeft,
          width: el.offsetWidth,
          opacity: 1,
          scale: isNavPressed ? 1.05 : 1
        });
      }
    } else {
      setNavPillStyle(prev => ({ ...prev, opacity: 0, scale: 1 }));
    }
  }, [hoveredNavIdx, isNavPressed]);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');

  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(landingStyles.revealVisible);
        } else {
          entry.target.classList.remove(landingStyles.revealVisible);
        }
      });
    }, { threshold: 0.1 });

    revealRefs.current.forEach(el => {
      if (el) {observer.observe(el);}
    });

    return () => {
      document.documentElement.style.scrollBehavior = '';
      observer.disconnect();
    };
  }, []);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced live institution search against the backend index.
  useEffect(() => {
    if (picked || collegeName.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiGet(
          `/api/v1/institutions/search?q=${encodeURIComponent(collegeName)}`
        );
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [collegeName, picked]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // On leaving this page, tell the landing page to re-arm its 3D carousel loop
  // (returning from a route can otherwise leave the cylinder collapsed).
  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem('navigatingBackFromDemo', 'true');
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleSendOtp = async () => {
    if (!EMAIL_RE.test(email)) {
      setOtpError('Please enter a valid email address');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await apiPost('/api/v1/demo/send-otp', { email });
      if (res.success) {
        setOtpSent(true);
      } else {
        setOtpError(res.error || 'Failed to send code');
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Please enter the 6-digit code');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await apiPost('/api/v1/demo/verify-otp', { email, otp });
      if (res.success) {
        setIsVerified(true);
        setVerifyToken(res.token || '');
      } else {
        setOtpError(res.error || 'Invalid code');
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {return;}

    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/api/v1/demo/submit', {
        email,
        token: verifyToken,
        collegeName,
        buildings,
        students,
        query,
      });
      if (res.success) {
        setIsSubmitted(true);
      } else {
        setError(res.error || 'Failed to submit request');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Nav-tab click: center short sections in the viewport; pin the tall form 7px
  // below the nav's real bottom edge.
  const GAP_BELOW_NAV = 7;
  const navBottom = () => document.querySelector('nav')?.getBoundingClientRect().bottom ?? 64;

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) {return;}
    const nb = navBottom();
    const absoluteTop = window.scrollY + el.getBoundingClientRect().top;
    // The form (#book) is tall — always pin its top just below the nav. Short
    // sections center in the viewport.
    const fits = id !== 'book' && el.offsetHeight < window.innerHeight - nb;
    let target = fits
      ? absoluteTop - (window.innerHeight - el.offsetHeight) / 2
      : absoluteTop - (nb + GAP_BELOW_NAV);
    // Nudge the Features section 3px lower in the scroll.
    if (id === 'features') {target -= 3;}
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });

    // The form's exact rest position matters (rounded corners must clear the
    // nav). Re-measure after the smooth scroll settles and correct any drift to
    // land an exact 7px gap below the nav.
    if (id === 'book') {
      setTimeout(() => {
        const diff = el.getBoundingClientRect().top - (navBottom() + GAP_BELOW_NAV + 36);
        if (Math.abs(diff) > 1) {window.scrollBy({ top: diff, behavior: 'smooth' });}
      }, 550);
    }
  };

  return (
    <div className={landingStyles.site} style={{ minHeight: '100vh', position: 'relative' }}>
      <div className={landingStyles.glow} />
      <div className={landingStyles.glow2} />
      <div className={landingStyles.noise} />

      
      <nav className={landingStyles.nav}>
        <style>{`
          .hm-input::placeholder { color: rgba(255,255,255,0.25); }
          .hm-input:focus { border-color: rgba(74,222,128,0.5) !important; }
          select.hm-input option { background: #14141f; color: #fff; }
          .demo-green-btn:hover { background: rgba(74,222,128,0.2) !important; border-color: rgba(74,222,128,0.55) !important; }

          /* ---- Scroll snap: scroll a little past a section and it settles on the next ---- */
          @media (min-width: 721px) {
            html { scroll-snap-type: y proximity; }
            .snap-section { scroll-snap-align: center; }
            .snap-section-top { scroll-snap-align: start; }
          }

          /* ---- Bento ---- */
          .bento-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            grid-template-rows: repeat(4, minmax(104px, 1fr));
            gap: 14px;
          }
          .bento-card {
            position: relative;
            display: flex;
            overflow: hidden;
            background: rgba(255,255,255,0.025);
            border: 0.5px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            transition: transform .4s cubic-bezier(.16,1,.3,1), border-color .4s ease, background .4s ease, box-shadow .4s ease;
          }
          .bento-card:hover {
            transform: translateY(-4px);
            border-color: var(--stroke);
            background: rgba(255,255,255,0.05);
            box-shadow: 0 18px 44px -16px var(--stroke);
          }
          .bento-glow {
            position: absolute; inset: 0; z-index: 0; pointer-events: none;
            background: radial-gradient(circle at var(--glow), var(--bg), transparent 62%);
            opacity: .5; transition: opacity .4s ease;
          }
          .bento-card:hover .bento-glow { opacity: 1; }
          .bento-tag {
            position: absolute; top: 0; right: 0; z-index: 2;
            padding: 7px 11px; font-size: 10px; font-weight: 600;
            letter-spacing: .5px; text-transform: uppercase;
            color: var(--stroke); background: var(--bg);
            border-bottom-left-radius: 12px;
          }
          .bento-icon {
            position: relative; z-index: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            border-radius: 12px;
            color: rgba(255,255,255,0.5);
            background: rgba(255,255,255,0.04);
            border: 0.5px solid rgba(255,255,255,0.06);
            transition: color .4s ease, background .4s ease, border-color .4s ease, transform .4s cubic-bezier(.16,1,.3,1);
          }
          .bento-card:hover .bento-icon {
            color: var(--stroke); background: var(--bg);
            border-color: var(--stroke); transform: scale(1.08);
          }
          .bento-title { font-weight: 600; color: rgba(255,255,255,0.92); margin: 0 0 6px; letter-spacing: -0.2px; transition: color .3s ease; }
          .bento-card:hover .bento-title { color: #fff; }
          .bento-desc { font-size: 12.5px; color: rgba(255,255,255,0.5); line-height: 1.45; margin: 0; transition: color .3s ease; }
          .bento-card:hover .bento-desc { color: rgba(255,255,255,0.72); }
          @media (max-width: 720px) {
            .bento-grid { display: flex; flex-direction: column; }
            .bento-card { grid-area: auto !important; min-height: 104px; }
          }
        `}</style>
        <div className={landingStyles.navLogo}>
          HostelMate
          <span className={landingStyles.logoSub}>by Nivo</span>
        </div>
        <div 
          className={landingStyles.navCenter}
          onMouseLeave={() => { setHoveredNavIdx(null); setIsNavPressed(false); }}
          onMouseUp={() => setIsNavPressed(false)}
          onPointerCancel={() => setIsNavPressed(false)}
        >
          <div 
            className={landingStyles.navPill}
            style={{
              width: navPillStyle.width,
              opacity: navPillStyle.opacity,
              transform: `translateX(${navPillStyle.left}px) scale(${navPillStyle.scale})`
            }}
          />
          {['Demo', 'Features', 'Book'].map((label, i) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className={landingStyles.navLink}
              draggable={false}
              ref={(el) => { navItemsRef.current[i] = el }}
              onClick={(e) => scrollToSection(e, label.toLowerCase())}
              onMouseEnter={() => setHoveredNavIdx(i)}
              onMouseDown={() => setIsNavPressed(true)}
            >
              {label}
            </a>
          ))}
        </div>
        <div className={landingStyles.navRight}>
          <Link href="/login" className={landingStyles.navSignin}>Sign in</Link>
          <Link href="/" className={landingStyles.navBtn}>Back to home ↗</Link>
        </div>
      </nav>

      <div style={{ ...container, padding: '40px 20px', maxWidth: '1000px', position: 'relative', zIndex: 10 }}>
        {/* SECTION 2 - Hero text */}
        <div 
          id="demo"
          ref={(el) => { revealRefs.current[0] = el; }}
          className={`${landingStyles.revealUp} snap-section`}
          style={{ textAlign: 'center', marginBottom: '48px' }}
        >
          <h1
            style={{
              fontSize: 'clamp(40px, 5vw, 56px)',
              fontWeight: 600,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginBottom: '20px',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            See HostelMate in action
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.5)',
              maxWidth: '860px',
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Watch how a hostel goes from manual chaos to automated clarity in under 5 minutes.
          </p>
        </div>

        {/* SECTION 3 - Demo video */}
        <div
          ref={(el) => { revealRefs.current[1] = el; }}
          className={`${landingStyles.revealUp} ${landingStyles.stagger1} snap-section`}
          style={{
            maxWidth: '860px',
            margin: '0 auto 71px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '0.5px solid rgba(255,255,255,0.1)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            position: 'relative',
            paddingTop: '56.25%',
            background: 'rgba(255,255,255,0.02)',
            isolation: 'isolate',
          }}
        >
          {DEMO_VIDEO_ID ? (
            <iframe
              src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}`}
              title="HostelMate product demo"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                opacity: 0.99,
                transform: 'translateZ(0)',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p style={{ fontSize: '13px', margin: 0 }}>Product walkthrough coming soon</p>
            </div>
          )}
        </div>

        {/* SECTION 3.5 - Features Bento Box */}
        <div 
          id="features"
          ref={(el) => { revealRefs.current[2] = el; }}
          className={`${landingStyles.revealUp} ${landingStyles.stagger1} snap-section`}
          style={{ maxWidth: '860px', margin: '0 auto 106px' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.5px' }}>Everything you need</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', marginTop: '8px' }}>One platform to replace five different tools.</p>
          </div>
          <div className="bento-grid">
            {BENTO_FEATURES.map((f) => (
              <div
                key={f.id}
                className="bento-card"
                style={{
                  gridArea: f.gridArea,
                  padding: f.pad,
                  flexDirection: f.isRow ? 'row' : 'column',
                  alignItems: f.isRow ? 'center' : 'flex-start',
                  justifyContent: f.hero ? 'space-between' : 'center',
                  '--stroke': f.stroke,
                  '--bg': f.bg,
                  '--glow': f.glow,
                } as React.CSSProperties}
              >
                <span className="bento-glow" />
                <span className="bento-tag">{f.tag}</span>
                <div
                  className="bento-icon"
                  style={{
                    width: `${f.iconBoxSize}px`,
                    height: `${f.iconBoxSize}px`,
                    marginBottom: f.isRow ? 0 : '16px',
                    marginRight: f.isRow ? '16px' : 0,
                    marginLeft: f.iconMarginLeft || 0,
                  }}
                >
                  <svg width={f.iconSize} height={f.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                    {f.icon}
                  </svg>
                </div>
                <div style={{ position: 'relative', zIndex: 1, paddingRight: f.isRow ? '8px' : 0 }}>
                  <h3 className="bento-title" style={{ fontSize: `${f.titleSize}px` }}>{f.title}</h3>
                  <p className="bento-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4 - Form */}
        <div
          id="book"
          ref={(el) => { revealRefs.current[3] = el; }}
          className={`${landingStyles.revealUp} ${landingStyles.stagger2} snap-section-top`}
          style={{
            scrollMarginTop: '132px',
            maxWidth: '860px',
            margin: '0 auto',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '24px 40px 40px',
          }}
        >
          {isSubmitted ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  background: 'rgba(74,222,128,0.1)',
                  color: '#4ade80',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
                Request submitted!
              </h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                We&apos;ll reach out to <span style={{ color: '#fff' }}>{email}</span> within 24
                hours.
              </p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    letterSpacing: '-0.5px',
                    marginBottom: '8px',
                  }}
                >
                  Ready to get started?
                </h2>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  Fill in your details and we&apos;ll reach out within 24 hours.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                <div style={{ position: 'relative' }} ref={wrapRef}>
                  <label
                    htmlFor="institution"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    Institution name
                  </label>
                  <input
                    id="institution"
                    type="text"
                    autoComplete="off"
                    role="combobox"
                    aria-controls="institution-listbox"
                    aria-expanded={showDropdown && results.length > 0}
                    aria-autocomplete="list"
                    value={collegeName}
                    onChange={(e) => {
                      setCollegeName(e.target.value);
                      setPicked(false);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search your college or university"
                    className="hm-input"
                    style={{ ...input, width: '100%', colorScheme: 'dark' }}
                  />
                  {showDropdown && collegeName.trim() && !picked && (
                    <div
                      id="institution-listbox"
                      role="listbox"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '8px',
                        background: '#111',
                        border: '0.5px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        zIndex: 10,
                      }}
                    >
                      {results.map((c, i) => (
                        <div
                          key={`${c.name}-${i}`}
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setCollegeName(c.name);
                            setPicked(true);
                            setShowDropdown(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom:
                              i < results.length - 1
                                ? '0.5px solid rgba(255,255,255,0.05)'
                                : 'none',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                            {[c.city, c.state, c.type].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      ))}
                      {!searching && results.length === 0 && (
                        <div
                          style={{
                            padding: '12px 16px',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.4)',
                          }}
                        >
                          No match — we&apos;ll use &ldquo;{collegeName.trim()}&rdquo; as entered.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="buildings"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    Number of hostel buildings
                  </label>
                  <input
                    id="buildings"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g. 3"
                    value={buildings}
                    onChange={(e) => setBuildings(e.target.value)}
                    className="hm-input"
                    style={{ ...input, width: '100%', colorScheme: 'dark' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="students"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    Approximate students
                  </label>
                  <select
                    id="students"
                    value={students}
                    onChange={(e) => setStudents(e.target.value)}
                    className="hm-input"
                    style={{
                      ...input,
                      width: '100%',
                      colorScheme: 'dark',
                      appearance: 'none',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <option value="" disabled>
                      Select range
                    </option>
                    <option value="Under 100">Under 100</option>
                    <option value="100-300">100-300</option>
                    <option value="300-500">300-500</option>
                    <option value="500-1000">500-1000</option>
                    <option value="1000+">1000+</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="query"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    Your query (optional)
                  </label>
                  <textarea
                    id="query"
                    rows={4}
                    placeholder="Any specific requirements or questions?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="hm-input"
                    style={{ ...input, width: '100%', colorScheme: 'dark', resize: 'vertical' }}
                  />
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '0.5px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                  }}
                >
                  <label
                    htmlFor="email"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '8px',
                    }}
                  >
                    Your work email *
                  </label>

                  {isVerified ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#4ade80',
                        fontSize: '13px',
                        fontWeight: 500,
                        padding: '12px 16px',
                        background: 'rgba(74,222,128,0.1)',
                        borderRadius: '10px',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {email} verified
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          id="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="name@institution.edu"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setOtpSent(false);
                          }}
                          disabled={otpSent}
                          className="hm-input"
                          style={{ ...input, flex: 1, colorScheme: 'dark' }}
                        />
                        {!otpSent && (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={otpLoading || !email}
                            className="demo-green-btn"
                            style={{ ...greenBtn, padding: '0 16px', fontSize: '13px' }}
                          >
                            {otpLoading ? 'Sending...' : 'Send code'}
                          </button>
                        )}
                      </div>

                      {otpSent && !isVerified && (
                        <div style={{ marginTop: '16px' }}>
                          <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '8px' }}>
                            ✓ Code sent — check your inbox (and spam)
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              aria-label="6-digit verification code"
                              placeholder="Enter 6-digit code"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                              className="hm-input"
                              style={{
                                ...input,
                                flex: 1,
                                colorScheme: 'dark',
                                letterSpacing: '2px',
                                textAlign: 'center',
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={otpLoading || otp.length !== 6}
                              className="demo-green-btn"
                              style={{ ...greenBtn, padding: '0 16px', fontSize: '13px' }}
                            >
                              {otpLoading ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {otpError && (
                    <p
                      role="alert"
                      style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}
                    >
                      {otpError}
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isVerified || loading}
                  style={{
                    background: isVerified ? '#fff' : 'rgba(255,255,255,0.1)',
                    color: isVerified ? '#000' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isVerified ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    marginTop: '8px',
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

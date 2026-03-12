'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadModels,
  getFaceDetection,
  isSamePerson,
  bestMatchDistance,
  calculateEAR,
  EAR_BLINK_THRESHOLD,
  applyEMA,
} from '@/lib/faceRecognition';
import { createClient } from '@/lib/supabase/client';

interface WardenFaceVerificationProps {
  wardenId: string;
  onVerified: () => void;
  onFailed: (_failureReason: string) => void;
  onSkip: () => void;
}

type Status =
  | 'loading-models'
  | 'requesting-camera'
  | 'fetching-descriptor'
  | 'scanning'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'camera-denied'
  | 'no-face-data'
  | 'liveness-failed'
  | 'max-attempts'
  | 'error';

// interface FacePosition { x: number; y: number; }

const MAX_ATTEMPTS = 5;
// Frame-diff: avg pixel change < this over MANY frames = photo spoof
const FRAME_DIFF_LIVE_THRESHOLD = 6; // out of 255
const FRAME_DIFF_MIN_FRAMES = 10; // need this many frames before hard-blocking

export default function WardenFaceVerification({
  wardenId,
  onVerified,
  onFailed,
  onSkip,
}: WardenFaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false); // controls recursive tick loop
  const storedDescriptorsRef = useRef<number[][] | null>(null);

  // EMA smoothed distance
  const smoothedDistRef = useRef<number>(1.0);

  // Attempt tracking
  const failedAttemptsRef = useRef(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Liveness
  const blinkDetectedRef = useRef(false);
  const lastEARRef = useRef<number>(1.0);

  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const frameDiffScoresRef = useRef<number[]>([]);

  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onFailedRef.current = onFailed;
    onSkipRef.current = onSkip;
  });

  const [status, setStatus] = useState<Status>('loading-models');
  // const [smoothedDist, setSmoothedDist] = useState<number | null>(null);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [showBlinkPrompt, setShowBlinkPrompt] = useState(true);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Frame-difference liveness ─────────────────────────────────────────────
  const computeFrameDiff = useCallback(
    (box: { x: number; y: number; width: number; height: number }): number | null => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      const SAMPLE = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = SAMPLE;
      canvas.height = SAMPLE;
      ctx.drawImage(
        video,
        Math.max(0, box.x),
        Math.max(0, box.y),
        box.width,
        box.height,
        0,
        0,
        SAMPLE,
        SAMPLE
      );

      const current = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
      const prev = prevFrameDataRef.current;

      let avgDiff = 0;
      if (prev && prev.length === current.length) {
        let totalDiff = 0;
        const pixelCount = SAMPLE * SAMPLE;
        for (let i = 0; i < current.length; i += 4) {
          const curGray = 0.299 * current[i] + 0.587 * current[i + 1] + 0.114 * current[i + 2];
          const prevGray = 0.299 * prev[i] + 0.587 * prev[i + 1] + 0.114 * prev[i + 2];
          totalDiff += Math.abs(curGray - prevGray);
        }
        avgDiff = totalDiff / pixelCount;
      }

      prevFrameDataRef.current = new Uint8ClampedArray(current);
      return avgDiff;
    },
    []
  );

  const startVerificationLoop = useCallback(() => {
    runningRef.current = true;
    setShowBlinkPrompt(true);

    const tick = async () => {
      if (!runningRef.current || !videoRef.current || !storedDescriptorsRef.current) return;
      try {
        setStatus('verifying');
        const detection = await getFaceDetection(videoRef.current);
        if (!runningRef.current) return;

        if (!detection) {
          setStatus('scanning');
        } else {
          const { descriptor, landmarks, box } = detection;

          // ── Blink detection ──────────────────────────────────────────────
          const ear = calculateEAR(landmarks);
          if (!blinkDetectedRef.current) {
            if (lastEARRef.current >= EAR_BLINK_THRESHOLD && ear < EAR_BLINK_THRESHOLD) {
              blinkDetectedRef.current = true;
              setBlinkDetected(true);
              setShowBlinkPrompt(false);
            }
          }
          lastEARRef.current = ear;

          // ── Frame-difference liveness ────────────────────────────────────
          const frameDiff = computeFrameDiff(box);
          if (frameDiff !== null) {
            const scores = frameDiffScoresRef.current;
            scores.push(frameDiff);
            if (scores.length > 12) scores.shift();
          }

          // ── EMA distance smoothing ───────────────────────────────────────
          const rawDist = bestMatchDistance(descriptor, storedDescriptorsRef.current);
          smoothedDistRef.current = applyEMA(smoothedDistRef.current, rawDist);
          // setSmoothedDist(smoothedDistRef.current);

          // ── Gate 1: Blink mandatory ──────────────────────────────────────
          if (!blinkDetectedRef.current) {
            setStatus('scanning');
          } else {
            // ── Gate 2: Frame-diff hard-block ──────────────────────────────
            const scores = frameDiffScoresRef.current;
            if (scores.length >= FRAME_DIFF_MIN_FRAMES) {
              const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
              if (avgScore < FRAME_DIFF_LIVE_THRESHOLD) {
                runningRef.current = false;
                stopCamera();
                setStatus('liveness-failed');
                onFailedRef.current(
                  'Liveness check failed — please use a live camera, not a photo.'
                );
                return;
              }
            }

            // ── Face match ────────────────────────────────────────────────
            const { match } = isSamePerson(descriptor, storedDescriptorsRef.current);
            if (match) {
              runningRef.current = false;
              stopCamera();
              setStatus('verified');
              setTimeout(() => onVerifiedRef.current(), 300);
              return;
            } else {
              failedAttemptsRef.current += 1;
              setFailedAttempts(failedAttemptsRef.current);
              if (failedAttemptsRef.current >= MAX_ATTEMPTS) {
                runningRef.current = false;
                stopCamera();
                setStatus('max-attempts');
                onFailedRef.current('Identity could not be verified. Access denied.');
                return;
              } else {
                setStatus('scanning');
              }
            }
          }
        }
      } catch {
        setStatus('scanning');
      }
      if (runningRef.current) setTimeout(tick, 50);
    };

    tick();
  }, [stopCamera, computeFrameDiff]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStatus('loading-models');
        await loadModels();
        if (cancelled) return;

        setStatus('fetching-descriptor');
        const supabase = createClient();
        const { data, error } = await supabase
          .from('warden_face_descriptors')
          .select(
            'descriptor, descriptor_straight, descriptor_left, descriptor_right, descriptor_up, descriptor_down'
          )
          .eq('warden_id', wardenId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          onSkipRef.current();
          return;
        }

        // Prefer named angle columns, fall back to legacy descriptor array
        const namedAngles: (number[] | null)[] = [
          data.descriptor_straight,
          data.descriptor_left,
          data.descriptor_right,
          data.descriptor_up,
          data.descriptor_down,
        ];
        const hasNamedAngles = namedAngles.some((d) => d !== null && d.length > 0);

        if (hasNamedAngles) {
          storedDescriptorsRef.current = namedAngles.filter(
            (d): d is number[] => d !== null && d.length > 0
          );
        } else {
          const raw = data.descriptor;
          if (Array.isArray(raw) && raw.length > 0) {
            storedDescriptorsRef.current = Array.isArray(raw[0])
              ? (raw as number[][])
              : [raw as number[]];
          } else {
            onSkipRef.current();
            return;
          }
        }

        setStatus('requesting-camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('scanning');
        startVerificationLoop();
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setStatus('camera-denied');
        } else {
          setStatus('error');
          console.error(msg);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [wardenId, startVerificationLoop, stopCamera]);

  // ── Derived UI ─────────────────────────────────────────────────────────────
  const isVerified = status === 'verified';
  // const isFailed = ['failed', 'liveness-failed', 'max-attempts'].includes(status);
  // const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
  const showVideo = ![
    'loading-models',
    'fetching-descriptor',
    'camera-denied',
    'error',
    'verified',
    'failed',
    'liveness-failed',
    'max-attempts',
    'no-face-data',
  ].includes(status);

  // const confidence =
  //   smoothedDist !== null
  //     ? Math.max(0, Math.min(100, Math.round((1 - smoothedDist / 0.6) * 100)))
  //     : null;

  // const barColor =
  //   confidence === null
  //     ? '#e5e7eb'
  //     : confidence >= 70
  //       ? '#16a34a'
  //       : confidence >= 40
  //         ? '#f59e0b'
  //         : '#ef4444';

  // const livenessColor = blinkDetected ? '#16a34a' : '#f59e0b';
  // const livenessText = blinkDetected
  //   ? '👁 Liveness: ✓ Confirmed'
  //   : "👁 Blink once to verify you're real";

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#04040a', zIndex: 50 }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at top center, rgba(167,139,250,0.08) 0%, transparent 70%)',
        transition: 'background 1s ease',
      }} />

      {/* Camera Feed */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.35,
          filter: 'blur(0px)',
          transform: 'scaleX(-1)',
          display: showVideo ? 'block' : 'none'
        }}
      />
      
      {/* Hidden canvas for frame-diff liveness */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => {
            if (onSkipRef.current) onSkipRef.current();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            padding: '6px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
          </svg>
          Back
        </button>
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: 500, letterSpacing: '-0.3px' }}>HostelMate</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>by Nivo</span>
        </div>
      </div>

      {/* Center content */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '100%' }}>
        <svg style={{ width: '28px', height: '28px', color: 'rgba(167,139,250,0.8)', marginBottom: '20px', display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>

        <h2 style={{ fontSize: '22px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>Warden verification</h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.38)', marginTop: '8px', margin: '8px 0 0 0' }}>Look directly at the camera</p>

        <div style={{
          marginTop: '28px',
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: '100px',
          padding: '8px 18px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: status === 'verifying' ? '#fbbf24' : isVerified ? '#4ade80' : status === 'failed' || status === 'max-attempts' ? '#f87171' : '#a78bfa',
            animation: 'pulseDot 1.5s infinite'
          }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            {status === 'verifying' ? 'Verifying identity...' : isVerified ? 'Identity confirmed' : status === 'failed' || status === 'max-attempts' ? 'Face not recognized' : 'Scanning face...'}
          </span>
        </div>

        {showBlinkPrompt && !blinkDetected && (
          <div style={{
            marginTop: '16px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
            animation: 'fadeIn 1s ease forwards'
          }}>
            Blink once to confirm liveness
          </div>
        )}
      </div>

      {/* Scanning frame corner overlays */}
      {showVideo && !isVerified && (
        <>
          <div style={{ position: 'absolute', top: 'calc(50% - 140px)', left: 'calc(50% - 140px)', width: '24px', height: '24px', borderTop: '1.5px solid rgba(167,139,250,0.5)', borderLeft: '1.5px solid rgba(167,139,250,0.5)', borderRadius: '2px 0 0 0' }} />
          <div style={{ position: 'absolute', top: 'calc(50% - 140px)', right: 'calc(50% - 140px)', width: '24px', height: '24px', borderTop: '1.5px solid rgba(167,139,250,0.5)', borderRight: '1.5px solid rgba(167,139,250,0.5)', borderRadius: '0 2px 0 0' }} />
          <div style={{ position: 'absolute', bottom: 'calc(50% - 140px)', left: 'calc(50% - 140px)', width: '24px', height: '24px', borderBottom: '1.5px solid rgba(167,139,250,0.5)', borderLeft: '1.5px solid rgba(167,139,250,0.5)', borderRadius: '0 0 0 2px' }} />
          <div style={{ position: 'absolute', bottom: 'calc(50% - 140px)', right: 'calc(50% - 140px)', width: '24px', height: '24px', borderBottom: '1.5px solid rgba(167,139,250,0.5)', borderRight: '1.5px solid rgba(167,139,250,0.5)', borderRadius: '0 0 2px 0' }} />

          <div style={{
            position: 'absolute',
            width: '280px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)',
            left: 'calc(50% - 140px)',
            animation: 'scanLine 2.5s ease-in-out infinite'
          }} />
        </>
      )}

      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: '32px', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
          Attempt {Math.min(MAX_ATTEMPTS, failedAttempts + 1)} / {MAX_ATTEMPTS}
        </div>
        {failedAttempts >= 3 && (
          <button
            onClick={() => {
              if (onSkipRef.current) onSkipRef.current();
            }}
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginTop: '12px',
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            Skip verification
          </button>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: calc(50% - 140px); opacity: 0; }
          10% { opacity: 1; }
          50% { top: calc(50% + 140px); }
          90% { opacity: 1; }
          100% { top: calc(50% - 140px); opacity: 0; }
        }
        @keyframes pulseDot {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

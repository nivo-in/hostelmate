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

interface FacePosition {
  x: number;
  y: number;
}

const MAX_ATTEMPTS = 5;
// Motion: std < this px across MOTION_HISTORY frames = static image
const MOTION_STD_THRESHOLD = 1.2;
const MOTION_HISTORY_FRAMES = 6;
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

  // Liveness tracking
  const blinkDetectedRef = useRef(false);
  const faceDetectedRef = useRef(false);
  const lastEARRef = useRef<number>(1.0);

  const facePositionHistoryRef = useRef<FacePosition[]>([]);
  // Frame-diff: store previous frame pixel data for comparison
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
  // const [showBlinkPrompt, setShowBlinkPrompt] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);

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

  // ── Motion (face-position) liveness (secondary) ───────────────────────────
  const checkPositionMotion = useCallback((pos: FacePosition): boolean => {
    const history = facePositionHistoryRef.current;
    history.push(pos);
    if (history.length > MOTION_HISTORY_FRAMES) history.shift();
    if (history.length < MOTION_HISTORY_FRAMES) return true; // collecting

    const xs = history.map((p) => p.x);
    const ys = history.map((p) => p.y);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const stdX = Math.sqrt(xs.reduce((s, x) => s + (x - meanX) ** 2, 0) / xs.length);
    const stdY = Math.sqrt(ys.reduce((s, y) => s + (y - meanY) ** 2, 0) / ys.length);
    return Math.max(stdX, stdY) >= MOTION_STD_THRESHOLD;
  }, []);

  const startVerificationLoop = useCallback(() => {
    runningRef.current = true;
    
    // Fail if no blink is detected within 12 seconds
    setTimeout(() => {
      if (runningRef.current && !blinkDetectedRef.current) {
        runningRef.current = false;
        stopCamera();
        setStatus('liveness-failed');
        if (onFailedRef.current) {
          onFailedRef.current('Liveness check timed out. Please try again.');
        }
      }
    }, 12000);

    const tick = async () => {
      if (!runningRef.current || !videoRef.current || !storedDescriptorsRef.current) return;
      try {
        const detection = await getFaceDetection(videoRef.current);
        if (!runningRef.current) return;

        if (!detection) {
          if (faceDetectedRef.current) {
            faceDetectedRef.current = false;
            setFaceDetected(false);
          }
          setStatus('scanning');
        } else {
          if (!faceDetectedRef.current) {
            faceDetectedRef.current = true;
            setFaceDetected(true);
          }
          const { descriptor, landmarks, box } = detection;

          // ── Blink detection ──────────────────────────────────────────────
          const ear = calculateEAR(landmarks);
          if (!blinkDetectedRef.current) {
            if (lastEARRef.current >= EAR_BLINK_THRESHOLD && ear < EAR_BLINK_THRESHOLD) {
              blinkDetectedRef.current = true;
              setBlinkDetected(true);
              // setShowBlinkPrompt(false);
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

          // ── Position motion ──────────────────────────────────────────────
          checkPositionMotion({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

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
            if (!storedDescriptorsRef.current) return;
            const { match } = isSamePerson(descriptor, storedDescriptorsRef.current);
            if (match) {
              runningRef.current = false;
              stopCamera();
              setStatus('verified');
              onVerifiedRef.current(); // Redirect immediately
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
  }, [stopCamera, computeFrameDiff, checkPositionMotion]);

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
    <div style={{ position: 'relative', width: '100%', height: '460px', background: '#04040a', overflow: 'hidden' }}>
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
          opacity: 1,
          transform: 'scaleX(-1)',
          display: showVideo ? 'block' : 'none'
        }}
      />
      
      {/* Title at top of camera window */}
      <div style={{ position: 'absolute', top: '24px', width: '100%', textAlign: 'center', zIndex: 10 }}>
        <h2 style={{ fontSize: '20px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          Warden verification
        </h2>
      </div>
      
      {/* Hidden canvas for frame-diff liveness */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* External floating status (Rendered outside the card via fixed positioning) */}
      <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, textAlign: 'center', width: '100%', pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: '100px',
          padding: '8px 18px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: status === 'verifying' ? '#fbbf24' : isVerified ? '#4ade80' : status === 'failed' || status === 'max-attempts' ? '#f87171' : '#a78bfa',
            transition: 'background-color 0.4s ease',
            animation: 'pulseDot 1.5s infinite'
          }} />
          <div style={{ display: 'grid', placeItems: 'center', height: '20px' }}>
            <span style={{
              gridArea: '1/1', whiteSpace: 'nowrap',
              fontSize: '13px', color: 'rgba(255,255,255,0.95)',
              transition: 'opacity 0.3s ease',
              opacity: status === 'verifying' ? 1 : 0,
              willChange: 'opacity'
            }}>
              Verifying identity...
            </span>
            <span style={{
              gridArea: '1/1', whiteSpace: 'nowrap',
              fontSize: '13px', color: 'rgba(255,255,255,0.95)',
              transition: 'opacity 0.3s ease',
              opacity: isVerified ? 1 : 0,
              willChange: 'opacity'
            }}>
              Identity confirmed
            </span>
            <span style={{
              gridArea: '1/1', whiteSpace: 'nowrap',
              fontSize: '13px', color: 'rgba(255,255,255,0.95)',
              transition: 'opacity 0.3s ease',
              opacity: (status === 'failed' || status === 'max-attempts') ? 1 : 0,
              willChange: 'opacity'
            }}>
              Face not recognized
            </span>
            <span style={{
              gridArea: '1/1', whiteSpace: 'nowrap',
              fontSize: '13px', color: 'rgba(255,255,255,0.95)',
              transition: 'opacity 0.3s ease',
              opacity: (status !== 'verifying' && !isVerified && status !== 'failed' && status !== 'max-attempts') ? 1 : 0,
              willChange: 'opacity'
            }}>
              Scanning face...
            </span>
          </div>
        </div>
      </div>

      {/* Scanning frame corner overlays */}
      {showVideo && !isVerified && (
        <>
          <div style={{ position: 'absolute', top: '16px', left: '16px', width: '24px', height: '24px', borderTop: '3.5px solid rgba(131,75,241,0.95)', borderLeft: '3.5px solid rgba(131,75,241,0.95)', borderRadius: '4px 0 0 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '24px', height: '24px', borderTop: '3.5px solid rgba(131,75,241,0.95)', borderRight: '3.5px solid rgba(131,75,241,0.95)', borderRadius: '0 4px 0 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '24px', height: '24px', borderBottom: '3.5px solid rgba(131,75,241,0.95)', borderLeft: '3.5px solid rgba(131,75,241,0.95)', borderRadius: '0 0 0 4px', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '24px', height: '24px', borderBottom: '3.5px solid rgba(131,75,241,0.95)', borderRight: '3.5px solid rgba(131,75,241,0.95)', borderRadius: '0 0 4px 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
        </>
      )}

      {/* Bottom bar inside the card (Blink Prompt, Instruction Text & Skip) */}
      <div style={{ position: 'absolute', bottom: '22px', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ position: 'relative', height: '20px', marginBottom: '12px' }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            transition: 'opacity 0.6s ease',
            opacity: (!faceDetected && !isVerified) ? 1 : 0,
            pointerEvents: 'none'
          }}>
            Please look directly at the camera
          </div>
          <div style={{
            position: 'absolute',
            width: '100%',
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            transition: 'opacity 0.6s ease',
            opacity: (faceDetected && !blinkDetected && !isVerified) ? 1 : 0,
            pointerEvents: 'none'
          }}>
            Blink once to confirm liveness
          </div>
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
        @keyframes pulseDot {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cornerBreathe {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

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
  onFailed: (reason: string) => void;
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

interface FacePosition { x: number; y: number; }

const MAX_ATTEMPTS = 5;
// Frame-diff: avg pixel change < this over MANY frames = photo spoof
const FRAME_DIFF_LIVE_THRESHOLD = 6;   // out of 255
const FRAME_DIFF_MIN_FRAMES = 10;      // need this many frames before hard-blocking

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
  const facePositionHistoryRef = useRef<FacePosition[]>([]);
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
  const [errorMsg, setErrorMsg] = useState('');
  const [smoothedDist, setSmoothedDist] = useState<number | null>(null);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [showBlinkPrompt, setShowBlinkPrompt] = useState(true);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
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
        Math.max(0, box.x), Math.max(0, box.y),
        box.width, box.height,
        0, 0, SAMPLE, SAMPLE
      );

      const current = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
      const prev = prevFrameDataRef.current;

      let avgDiff = 0;
      if (prev && prev.length === current.length) {
        let totalDiff = 0;
        const pixelCount = SAMPLE * SAMPLE;
        for (let i = 0; i < current.length; i += 4) {
          const curGray  = 0.299 * current[i] + 0.587 * current[i + 1] + 0.114 * current[i + 2];
          const prevGray = 0.299 * prev[i]    + 0.587 * prev[i + 1]    + 0.114 * prev[i + 2];
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
          setSmoothedDist(smoothedDistRef.current);

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
                onFailedRef.current('Liveness check failed — please use a live camera, not a photo.');
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
              : [(raw as number[])];
          } else {
            onSkipRef.current();
            return;
          }
        }

        setStatus('requesting-camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
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
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
          setStatus('camera-denied');
        } else {
          setStatus('error');
          setErrorMsg(msg);
        }
      }
    };

    init();
    return () => { cancelled = true; stopCamera(); };
  }, [wardenId, startVerificationLoop, stopCamera]);

  // ── Derived UI ─────────────────────────────────────────────────────────────
  const isVerified = status === 'verified';
  const isFailed = ['failed', 'liveness-failed', 'max-attempts'].includes(status);
  const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
  const showVideo = !['loading-models', 'fetching-descriptor', 'camera-denied', 'error', 'verified', 'failed', 'liveness-failed', 'max-attempts', 'no-face-data'].includes(status);

  const confidence =
    smoothedDist !== null
      ? Math.max(0, Math.min(100, Math.round((1 - smoothedDist / 0.6) * 100)))
      : null;

  const barColor =
    confidence === null ? '#e5e7eb'
    : confidence >= 70 ? '#16a34a'
    : confidence >= 40 ? '#f59e0b'
    : '#ef4444';

  const livenessColor = blinkDetected ? '#16a34a' : '#f59e0b';
  const livenessText = blinkDetected
    ? '👁 Liveness: ✓ Confirmed'
    : '👁 Blink once to verify you\'re real';

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900">Warden Security Check</h2>
        <p className="text-sm text-gray-400 mt-1">Face verification required for warden access</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {status === 'loading-models'
            ? 'Loading face recognition...'
            : status === 'fetching-descriptor'
            ? 'Loading your face data...'
            : 'Starting camera...'}
        </div>
      )}

      {/* Camera */}
      <div className="relative w-full max-w-sm">
        {/* Hidden canvas for frame-diff liveness */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <video
          ref={videoRef}
          muted
          playsInline
          className="rounded-2xl w-full"
          style={{ display: showVideo ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />

        {showVideo && (
          <>
            {/* Oval face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative" style={{ width: '42%', paddingTop: '58%' }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 136" fill="none">
                  <ellipse
                    cx="50" cy="68" rx="48" ry="66"
                    stroke={status === 'verifying' ? '#3b82f6' : '#ffffff'}
                    strokeWidth="3"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))', transition: 'stroke 0.2s ease' }}
                  />
                </svg>
              </div>
            </div>

            {/* Status chip */}
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <div
                className="flex items-center gap-2 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-sm transition-all"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </div>
                Scanning face...
              </div>
            </div>

            {/* Blink prompt overlay */}
            {showBlinkPrompt && !blinkDetected && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-yellow-500/80 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Please blink to verify you&apos;re real
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Liveness indicator */}
      {showVideo && (
        <div
          className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-300"
          style={{
            color: livenessColor,
            borderColor: livenessColor,
            background: blinkDetected ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)',
            animation: blinkDetected ? 'none' : 'livenessGlow 1.5s ease-in-out infinite',
          }}
        >
          {livenessText}
        </div>
      )}

      {/* Confidence meter */}
      {showVideo && confidence !== null && (
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Match confidence</span>
            <span>{confidence}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${confidence}%`,
                background: barColor,
                transition: 'width 300ms ease-out, background 300ms ease-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Attempt counter */}
      {showVideo && failedAttempts > 0 && (
        <p className="text-xs text-gray-400">
          Attempt {failedAttempts}/{MAX_ATTEMPTS} — hold still and look directly at the camera
        </p>
      )}

      {/* Verified */}
      {isVerified && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-700">Identity confirmed ✓</p>
        </div>
      )}

      {/* Failed states */}
      {status === 'liveness-failed' && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
            <span className="text-2xl">👁</span>
          </div>
          <p className="text-sm font-medium text-orange-600">Liveness check failed</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Please use a live camera, not a photo.
          </p>
        </div>
      )}

      {(status === 'failed' || status === 'max-attempts') && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-600">Face not recognized</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            {status === 'max-attempts'
              ? 'Maximum attempts reached. Access denied.'
              : 'Make sure lighting is good and face the camera directly.'}
          </p>
        </div>
      )}

      {/* Error states */}
      {status === 'camera-denied' && (
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <span className="text-2xl">📷</span>
          <p className="text-sm font-medium text-gray-700">Camera access required</p>
          <p className="text-xs text-gray-400">
            Enable camera permissions in your browser settings, then refresh.
          </p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center max-w-xs">{errorMsg}</p>
      )}

      {/* Security badges */}
      <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
        {['🔒 5-Angle Scan', '👁 Liveness Check', '🛡 Warden Auth'].map((badge) => (
          <span
            key={badge}
            className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5"
          >
            {badge}
          </span>
        ))}
      </div>

      <button
        id="skip-warden-face-verification-btn"
        onClick={() => onSkipRef.current()}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Skip verification
      </button>

      <style>{`
        @keyframes livenessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 0 4px rgba(245,158,11,0.15); }
        }
      `}</style>
    </div>
  );
}

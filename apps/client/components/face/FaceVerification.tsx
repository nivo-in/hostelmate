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

interface FaceVerificationProps {
  studentId: string;
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

interface FacePosition {
  x: number;
  y: number;
}

const MAX_ATTEMPTS = 5;
// Motion: std < this px across MOTION_HISTORY frames = static image
const MOTION_STD_THRESHOLD = 1.2;
const MOTION_HISTORY_FRAMES = 6;
// Frame-diff: avg pixel change < this over MANY frames = photo spoof
// Only used to BLOCK after a blink is already confirmed + we have lots of data.
// A blink alone is strong enough liveness — frame-diff is a secondary hard-block.
const FRAME_DIFF_LIVE_THRESHOLD = 6; // out of 255
const FRAME_DIFF_MIN_FRAMES = 10;    // need this many frames before we hard-block

export default function FaceVerification({
  studentId,
  onVerified,
  onFailed,
  onSkip,
}: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // hidden canvas for frame-diff
  const streamRef = useRef<MediaStream | null>(null);
  // Simple running flag — avoids stacking async detections
  const runningRef = useRef(false);
  const storedDescriptorsRef = useRef<number[][] | null>(null);

  // EMA smoothed distance
  const smoothedDistRef = useRef<number>(1.0);

  // Attempt tracking
  const failedAttemptsRef = useRef(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Liveness tracking
  const blinkDetectedRef = useRef(false);
  const lastEARRef = useRef<number>(1.0);
  const scanStartTimeRef = useRef<number>(0);
  const facePositionHistoryRef = useRef<FacePosition[]>([]);
  // Frame-diff: store previous frame pixel data for comparison
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const frameDiffScoresRef = useRef<number[]>([]); // rolling avg pixel diffs

  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  onVerifiedRef.current = onVerified;
  onFailedRef.current = onFailed;
  onSkipRef.current = onSkip;

  const [status, setStatus] = useState<Status>('loading-models');
  const [errorMsg, setErrorMsg] = useState('');
  const [smoothedDist, setSmoothedDist] = useState<number | null>(null);
  const [blinkDetected, setBlinkDetected] = useState(false);
  // Show blink prompt immediately — don't wait
  const [showBlinkPrompt, setShowBlinkPrompt] = useState(true);

  const stopCamera = useCallback(() => {
    runningRef.current = false; // stops the recursive tick loop
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  // ── Frame-difference liveness (primary anti-spoofing) ────────────────────
  // Captures a downscaled snapshot of the face region each frame and computes
  // average pixel change vs the previous frame. A photo on a phone screen
  // shows near-zero change (very bright, static). A live face always has
  // micro-expressions, breathing, and micro-movements that change pixels.
  const computeFrameDiff = useCallback(
    (box: { x: number; y: number; width: number; height: number }): number | null => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      // Sample a 32x32 patch from the face bounding box for speed
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
          // Compare grayscale value (avoid color-cast differences)
          const curGray = 0.299 * current[i] + 0.587 * current[i + 1] + 0.114 * current[i + 2];
          const prevGray = 0.299 * prev[i] + 0.587 * prev[i + 1] + 0.114 * prev[i + 2];
          totalDiff += Math.abs(curGray - prevGray);
        }
        avgDiff = totalDiff / pixelCount;
      }

      // Store current frame as previous
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
    setShowBlinkPrompt(true);

    // Recursive async tick: next detection fires immediately after previous completes.
    // This is faster than setInterval which waits the full interval even when
    // the detection took longer than expected.
    const tick = async () => {
      if (!runningRef.current || !videoRef.current || !storedDescriptorsRef.current) return;
      try {
        setStatus('verifying');
        const detection = await getFaceDetection(videoRef.current);
        if (!runningRef.current) return; // stopped while awaiting

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
            if (scores.length > 8) scores.shift();
          }

          // ── Position motion ──────────────────────────────────────────────
          checkPositionMotion({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

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

            // ── Face match ───────────────────────────────────────────────
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
                onFailedRef.current('Maximum attempts reached. Switching to QR mode.');
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
      // Schedule next tick immediately after this one finishes
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
          .from('face_descriptors')
          .select(
            'descriptor, descriptor_straight, descriptor_left, descriptor_right, descriptor_up, descriptor_down'
          )
          .eq('student_id', studentId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setStatus('no-face-data');
          return;
        }

        // Build multi-angle descriptor array — prefer named columns, fall back to legacy
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
          // Legacy fallback: descriptor column is number[][] or number[]
          const raw = data.descriptor;
          if (Array.isArray(raw) && raw.length > 0) {
            storedDescriptorsRef.current = Array.isArray(raw[0])
              ? (raw as number[][])
              : [(raw as number[])];
          } else {
            setStatus('no-face-data');
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
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setStatus('camera-denied');
        } else {
          setStatus('error');
          setErrorMsg(msg);
        }
      }
    };

    init();
    return () => { cancelled = true; stopCamera(); };
  }, [studentId, startVerificationLoop, stopCamera]);

  // ── Derived UI ───────────────────────────────────────────────────────────────
  const isVerified = status === 'verified';
  const isFailed = status === 'failed' || status === 'liveness-failed' || status === 'max-attempts';
  const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
  const showVideo = !['loading-models', 'fetching-descriptor', 'camera-denied', 'error', 'verified', 'failed', 'liveness-failed', 'max-attempts', 'no-face-data'].includes(status);

  const confidence =
    smoothedDist !== null
      ? Math.max(0, Math.min(100, Math.round((1 - smoothedDist / 0.6) * 100)))
      : null;

  const barColor =
    confidence === null
      ? '#e5e7eb'
      : confidence >= 70
      ? '#16a34a'
      : confidence >= 40
      ? '#f59e0b'
      : '#ef4444';

  const livenessColor = blinkDetected ? '#16a34a' : '#f59e0b';
  const livenessText = blinkDetected
    ? '👁 Liveness: ✓ Confirmed'
    : '👁 Blink once to verify you\'re real';

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Face Verification</h2>
        <p className="text-sm text-gray-400 mt-1">Look at the camera to verify your identity</p>
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
        {/* Hidden canvas for frame-diff liveness — never shown to user */}
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
                className="text-white text-xs font-medium px-3 py-1 rounded-full"
                style={{
                  background: status === 'verifying' ? 'rgba(59,130,246,0.75)' : 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {status === 'verifying' ? 'Verifying…' : 'Hold still'}
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

      {/* Liveness indicator — shown while camera is active */}
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
              className="h-full rounded-full transition-all duration-300 ease-out"
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

      {/* QR fallback after 3 failed attempts */}
      {showVideo && failedAttempts >= 3 && (
        <button
          id="face-verification-use-qr-btn"
          onClick={() => onSkipRef.current()}
          className="text-xs text-blue-500 hover:text-blue-700 underline transition-colors"
        >
          Having trouble? Use QR Only
        </button>
      )}

      {/* Verified */}
      {isVerified && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-700">Verified ✓</p>
        </div>
      )}

      {/* Failed states */}
      {status === 'max-attempts' && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-600">Verification failed</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Maximum attempts reached — switching to QR mode.
          </p>
        </div>
      )}

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

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-600">Face not recognized</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Make sure you&apos;re in good lighting and looking directly at the camera.
          </p>
        </div>
      )}

      {/* Error states */}
      {status === 'camera-denied' && (
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <span className="text-2xl">📷</span>
          <p className="text-sm font-medium text-gray-700">Camera access required</p>
          <p className="text-xs text-gray-400">
            Camera access required for face verification. Enable permissions in your browser settings, then refresh.
          </p>
        </div>
      )}

      {status === 'no-face-data' && (
        <div className="flex flex-col items-center gap-2 text-center max-w-xs">
          <span className="text-2xl">🔍</span>
          <p className="text-sm font-medium text-gray-700">No face data found</p>
          <p className="text-xs text-gray-400">
            No face data found — please register first or use QR code attendance.
          </p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center max-w-xs">{errorMsg}</p>
      )}

      {/* Security badges */}
      <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
        {['🔒 5-Angle Scan', '👁 Liveness Check', '📍 Geofenced'].map((badge) => (
          <span
            key={badge}
            className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5"
          >
            {badge}
          </span>
        ))}
      </div>

      <button
        id="skip-face-verification-btn"
        onClick={() => onSkipRef.current()}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Skip verification
      </button>

      <style>{`
        @keyframes scanPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 0.4; }
        }
        @keyframes livenessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 0 4px rgba(245,158,11,0.15); }
        }
      `}</style>
    </div>
  );
}

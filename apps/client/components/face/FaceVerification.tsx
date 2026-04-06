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



const MAX_ATTEMPTS = 5;



export default function FaceVerification({
  studentId,
  onVerified,
  onFailed,
  onSkip,
}: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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


  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  // Sync latest callbacks without re-creating callbacks that close over them
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onFailedRef.current = onFailed;
    onSkipRef.current = onSkip;
  });

  const [status, setStatus] = useState<Status>('loading-models');
  const [errorMsg, setErrorMsg] = useState('');
  const [smoothedDist, setSmoothedDist] = useState<number | null>(null);
  const [blinkDetected, setBlinkDetected] = useState(false);
  // Show blink prompt immediately — don't wait
  const [showBlinkPrompt, setShowBlinkPrompt] = useState(true);

  const stopCamera = useCallback(() => {
    runningRef.current = false; // stops the recursive tick loop
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Frame-difference liveness (primary anti-spoofing) ────────────────────




  const startVerificationLoop = useCallback(() => {
    runningRef.current = true;
    setShowBlinkPrompt(true);

    // Fail if no blink is detected within 10 seconds
    setTimeout(() => {
      if (runningRef.current && !blinkDetectedRef.current) {
        runningRef.current = false;
        stopCamera();
        setStatus('liveness-failed');
        if (onFailedRef.current) {
          onFailedRef.current('Liveness check timed out. Please try again.');
        }
      }
    }, 10000);

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
          const { descriptor, landmarks } = detection;

          // ── Face match FIRST ───────────────────────────────────────────
          const { match } = isSamePerson(descriptor, storedDescriptorsRef.current);
          
          if (!match) {
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
              return; // skip liveness checks for a non-matching face
            }
          }

          // ── EMA distance smoothing ───────────────────────────────────────
          const rawDist = bestMatchDistance(descriptor, storedDescriptorsRef.current);
          smoothedDistRef.current = applyEMA(smoothedDistRef.current, rawDist);
          setSmoothedDist(smoothedDistRef.current);

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


          // ── Gate 1: Blink mandatory ──────────────────────────────────────
          if (!blinkDetectedRef.current) {
            setStatus('verifying');
          } else {

            // All clear!
            runningRef.current = false;
            stopCamera();
            setStatus('verified');
            setTimeout(() => onVerifiedRef.current(), 300);
            return;
          }
        }
      } catch {
        setStatus('scanning');
      }
      // Schedule next tick immediately after this one finishes
      if (runningRef.current) setTimeout(tick, 50);
    };

    tick();
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStatus('loading-models');

        const supabase = createClient();

        // Fire all independent async tasks in PARALLEL
        const fetchDbPromise = supabase
          .from('face_descriptors')
          .select(
            'descriptor, descriptor_straight, descriptor_left, descriptor_right, descriptor_up, descriptor_down'
          )
          .eq('student_id', studentId)
          .single();

        const loadModelsPromise = loadModels();

        const startCameraPromise = navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        // Await them all simultaneously to drastically reduce the black-screen wait time
        const [dbResult, _modelsLoaded, stream] = await Promise.all([
          fetchDbPromise,
          loadModelsPromise,
          startCameraPromise,
        ]);

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const { data, error } = dbResult;
        if (error || !data) {
          stream.getTracks().forEach((t) => t.stop());
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
              : [raw as number[]];
          } else {
            stream.getTracks().forEach((t) => t.stop());
            setStatus('no-face-data');
            return;
          }
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
          setErrorMsg(msg);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [studentId, startVerificationLoop, stopCamera]);

  // ── Derived UI ───────────────────────────────────────────────────────────────
  const isVerified = status === 'verified';
  // const isFailed = status === 'failed' || status === 'liveness-failed' || status === 'max-attempts';
  const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
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
    : "👁 Blink once to verify you're real";

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Face Verification</h2>
        <p className="text-sm text-gray-400 mt-1">Look at the camera to verify your identity</p>
      </div>

      {/* Camera / Loading Container */}
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden aspect-[4/3] shadow-inner" style={{ background: '#080810' }}>
        
        {/* Loading Overlay */}
        {!showVideo && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="animate-spin" style={{ width: '12px', height: '12px', border: '1.5px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.6)', borderRadius: '50%' }} />
              {status === 'loading-models'
                ? 'Initializing secure environment...'
                : status === 'fetching-descriptor'
                  ? 'Verifying identity access...'
                  : 'Starting camera stream...'}
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ display: showVideo ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />

        {showVideo && (
          <>
            {/* Oval face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative" style={{ width: '42%', paddingTop: '58%' }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 136" fill="none">
                  <ellipse
                    cx="50"
                    cy="68"
                    rx="48"
                    ry="66"
                    stroke={status === 'verifying' ? '#3b82f6' : '#ffffff'}
                    strokeWidth="3"
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))',
                      transition: 'stroke 0.2s ease',
                    }}
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
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
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
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
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
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
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
            Camera access required for face verification. Enable permissions in your browser
            settings, then refresh.
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

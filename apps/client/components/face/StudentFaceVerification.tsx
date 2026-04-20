'use client';
import { AlertTriangle, Camera, Search } from 'lucide-react';

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

interface StudentFaceVerificationProps {
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

// Orange theme — mirrors the student login/dashboard accent.
const ORANGE = 'rgba(251,146,60,0.95)';

export default function StudentFaceVerification({
  studentId,
  onVerified,
  onFailed,
  onSkip,
}: StudentFaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onFailedRef.current = onFailed;
    onSkipRef.current = onSkip;
  });

  const [status, setStatus] = useState<Status>('loading-models');
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startVerificationLoop = useCallback(() => {
    runningRef.current = true;

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

    const tick = async () => {
      if (!runningRef.current || !videoRef.current || !storedDescriptorsRef.current) {return;}
      try {
        const detection = await getFaceDetection(videoRef.current);
        if (!runningRef.current) {return;}

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
          const { descriptor, landmarks } = detection;

          // ── Face match FIRST ───────────────────────────────────────────
          if (!storedDescriptorsRef.current) {return;}
          const { match } = isSamePerson(descriptor, storedDescriptorsRef.current);

          if (!match) {
            failedAttemptsRef.current += 1;
            setFailedAttempts(failedAttemptsRef.current);
            if (failedAttemptsRef.current >= MAX_ATTEMPTS) {
              runningRef.current = false;
              stopCamera();
              setStatus('max-attempts');
              onFailedRef.current('Identity could not be verified. Switching to QR mode.');
              return;
            } else {
              setStatus('scanning');
              return; // skip liveness checks for a non-matching face
            }
          }

          // ── EMA distance smoothing ───────────────────────────────────────
          const rawDist = bestMatchDistance(descriptor, storedDescriptorsRef.current);
          smoothedDistRef.current = applyEMA(smoothedDistRef.current, rawDist);

          // ── Blink detection ──────────────────────────────────────────────
          const ear = calculateEAR(landmarks);
          if (!blinkDetectedRef.current) {
            if (lastEARRef.current >= EAR_BLINK_THRESHOLD && ear < EAR_BLINK_THRESHOLD) {
              blinkDetectedRef.current = true;
              setBlinkDetected(true);
            }
          }
          lastEARRef.current = ear;

          // ── Gate 1: Blink mandatory ──────────────────────────────────────
          if (!blinkDetectedRef.current) {
            setStatus('verifying'); // Waiting for blink
          } else {
            // All clear!
            runningRef.current = false;
            stopCamera();
            setStatus('verified');
            onVerifiedRef.current();
            return;
          }
        }
      } catch {
        setStatus('scanning');
      }
      if (runningRef.current) {setTimeout(tick, 50);}
    };

    tick();
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStatus('loading-models');

        const supabase = createClient();

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
        if (cancelled) {return;}
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setStatus('camera-denied');
        } else {
          setStatus('error');
          // eslint-disable-next-line no-console
          console.error(msg);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [studentId, startVerificationLoop, stopCamera]);

  // ── Derived UI ─────────────────────────────────────────────────────────────
  const isVerified = status === 'verified';
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '460px', background: '#04040a', overflow: 'hidden' }}>
      {/* Loading Overlay */}
      {!showVideo && isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080810',
          zIndex: 5,
        }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="animate-spin" style={{ width: '12px', height: '12px', border: '1.5px solid rgba(251,146,60,0.15)', borderTopColor: 'rgba(251,146,60,0.7)', borderRadius: '50%' }} />
            {status === 'loading-models'
              ? 'Initializing secure environment...'
              : status === 'fetching-descriptor'
                ? 'Verifying identity access...'
                : 'Starting camera stream...'}
          </div>
        </div>
      )}

      {/* No face data / error overlays */}
      {(status === 'no-face-data' || status === 'camera-denied' || status === 'error') && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#080810',
          zIndex: 6, padding: '24px', textAlign: 'center',
        }}>
          <span style={{ fontSize: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{status === 'camera-denied' ? <Camera size={26} strokeWidth={1.5} /> : status === 'no-face-data' ? <Search size={26} strokeWidth={1.5} /> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14} strokeWidth={2.5} /></span>}</span>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            {status === 'camera-denied' ? 'Camera access required' : status === 'no-face-data' ? 'No face data found' : 'Something went wrong'}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
            {status === 'camera-denied'
              ? 'Enable camera permissions in your browser settings, then try again.'
              : status === 'no-face-data'
                ? 'Register your face first, or use QR code attendance instead.'
                : 'Please try again or use QR code attendance.'}
          </p>
          <button
            onClick={() => onSkipRef.current()}
            style={{
              marginTop: '6px', fontSize: '12px', color: 'rgba(251,146,60,0.9)',
              background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.3)',
              borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
            }}
          >
            Use QR code instead
          </button>
        </div>
      )}

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
      {showVideo && (
        <div style={{ position: 'absolute', top: '24px', width: '100%', textAlign: 'center', zIndex: 10 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            Face attendance
          </h2>
        </div>
      )}

      {/* Floating status pill */}
      {showVideo && (
        <div style={{ position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, textAlign: 'center', pointerEvents: 'none' }}>
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
              backgroundColor: status === 'verifying' ? '#fbbf24' : isVerified ? '#4ade80' : status === 'failed' || status === 'max-attempts' ? '#f87171' : '#fb923c',
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
      )}

      {/* Scanning frame corner overlays (orange) */}
      {showVideo && !isVerified && (
        <>
          <div style={{ position: 'absolute', top: '16px', left: '16px', width: '24px', height: '24px', borderBottom: `3.5px solid ${ORANGE}`, borderRight: `3.5px solid ${ORANGE}`, borderRadius: '0 0 4px 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '24px', height: '24px', borderBottom: `3.5px solid ${ORANGE}`, borderLeft: `3.5px solid ${ORANGE}`, borderRadius: '0 0 0 4px', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '24px', height: '24px', borderTop: `3.5px solid ${ORANGE}`, borderRight: `3.5px solid ${ORANGE}`, borderRadius: '0 4px 0 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '24px', height: '24px', borderTop: `3.5px solid ${ORANGE}`, borderLeft: `3.5px solid ${ORANGE}`, borderRadius: '4px 0 0 0', animation: 'cornerBreathe 2s ease-in-out infinite' }} />
        </>
      )}

      {/* Bottom bar (instruction text & skip) */}
      {showVideo && (
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
                if (onSkipRef.current) {onSkipRef.current();}
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
              Having trouble? Use QR code
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulseDot {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
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

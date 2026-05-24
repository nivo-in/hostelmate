'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadModels, getFaceDescriptor, isSamePerson, bestMatchDistance } from '@/lib/faceRecognition';
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
  | 'error';

export default function FaceVerification({
  studentId,
  onVerified,
  onFailed,
  onSkip,
}: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stored as number[][] — one descriptor per registered angle
  const storedDescriptorsRef = useRef<number[][] | null>(null);
  const failedAttemptsRef = useRef(0);
  const bestDistRef = useRef<number>(Infinity); // track best distance seen for UI feedback

  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  onVerifiedRef.current = onVerified;
  onFailedRef.current = onFailed;
  onSkipRef.current = onSkip;

  const [status, setStatus] = useState<Status>('loading-models');
  const [errorMsg, setErrorMsg] = useState('');
  const [bestDist, setBestDist] = useState<number | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const startVerificationLoop = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !storedDescriptorsRef.current) return;
      try {
        setStatus('verifying');
        const descriptor = await getFaceDescriptor(videoRef.current);
        if (!descriptor) {
          setStatus('scanning');
          return;
        }

        const dist = bestMatchDistance(descriptor, storedDescriptorsRef.current);
        if (dist < bestDistRef.current) {
          bestDistRef.current = dist;
          setBestDist(Math.round(dist * 1000) / 1000);
        }

        const match = isSamePerson(descriptor, storedDescriptorsRef.current);
        if (match) {
          stopCamera();
          setStatus('verified');
          setTimeout(() => onVerifiedRef.current(), 1000);
        } else {
          failedAttemptsRef.current += 1;
          if (failedAttemptsRef.current >= 10) {
            stopCamera();
            setStatus('failed');
            onFailedRef.current('Face not recognized. Please use QR code attendance instead.');
          } else {
            setStatus('scanning');
          }
        }
      } catch {
        setStatus('scanning');
      }
    }, 800);
  }, [stopCamera]);

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
          .select('descriptor')
          .eq('student_id', studentId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          onSkipRef.current();
          return;
        }

        // descriptor is number[][] (multi-angle) — handle legacy number[] too
        const raw = data.descriptor;
        if (Array.isArray(raw) && raw.length > 0) {
          storedDescriptorsRef.current = Array.isArray(raw[0])
            ? (raw as number[][])           // new format: multi-angle
            : [(raw as number[])];          // legacy: wrap single descriptor
        } else {
          onSkipRef.current();
          return;
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
  }, [studentId, startVerificationLoop, stopCamera]);

  const isVerified = status === 'verified';
  const isFailed = status === 'failed';
  const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
  const showVideo = !['loading-models', 'fetching-descriptor', 'camera-denied', 'error', 'verified', 'failed'].includes(status);

  // Confidence bar: distance 0 = perfect, 0.42 = threshold, 0.6+ = no match
  const confidence = bestDist !== null ? Math.max(0, Math.min(100, Math.round((1 - bestDist / 0.6) * 100))) : null;

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Face Verification</h2>
        <p className="text-sm text-gray-400 mt-1">Look at the camera to verify your identity</p>
      </div>

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
          </>
        )}
      </div>

      {/* Confidence meter (shown during scanning) */}
      {showVideo && confidence !== null && (
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Match confidence</span>
            <span>{confidence}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${confidence}%`,
                background:
                  confidence >= 70 ? '#16a34a'
                  : confidence >= 40 ? '#f59e0b'
                  : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

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

      {isFailed && (
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

      {status === 'camera-denied' && (
        <p className="text-xs text-gray-500 text-center max-w-xs">
          Camera access denied. Enable permissions in browser settings, then refresh.
        </p>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center max-w-xs">{errorMsg}</p>
      )}

      {failedAttemptsRef.current > 0 && !isFailed && status === 'scanning' && (
        <p className="text-xs text-gray-400">
          Attempt {failedAttemptsRef.current}/10 — hold still and look directly at the camera
        </p>
      )}

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
      `}</style>
    </div>
  );
}

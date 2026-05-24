'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadModels, getFaceDescriptor, isSamePerson } from '@/lib/faceRecognition';
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
  const storedDescriptorRef = useRef<number[] | null>(null);
  const failedAttemptsRef = useRef(0);

  // Store callbacks in refs so they never cause useEffect/useCallback to re-run
  const onVerifiedRef = useRef(onVerified);
  const onFailedRef = useRef(onFailed);
  const onSkipRef = useRef(onSkip);
  onVerifiedRef.current = onVerified;
  onFailedRef.current = onFailed;
  onSkipRef.current = onSkip;

  const [status, setStatus] = useState<Status>('loading-models');
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []); // no deps — stable forever

  const startVerificationLoop = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !storedDescriptorRef.current) return;
      try {
        setStatus('verifying');
        const descriptor = await getFaceDescriptor(videoRef.current);
        if (!descriptor) {
          setStatus('scanning');
          return;
        }
        const match = await isSamePerson(descriptor, storedDescriptorRef.current);
        if (match) {
          stopCamera();
          setStatus('verified');
          setTimeout(() => onVerifiedRef.current(), 1000);
        } else {
          failedAttemptsRef.current += 1;
          if (failedAttemptsRef.current >= 5) {
            stopCamera();
            setStatus('failed');
            onFailedRef.current('Face not recognized. Please try again or use QR only.');
          } else {
            setStatus('scanning');
          }
        }
      } catch {
        setStatus('scanning');
      }
    }, 1000);
  }, [stopCamera]); // only stopCamera — which is also stable

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

        storedDescriptorRef.current = data.descriptor as number[];

        setStatus('requesting-camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
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
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
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
  }, [studentId, startVerificationLoop, stopCamera]); // callbacks are stable — no re-runs

  const statusText: Record<Status, string> = {
    'loading-models': 'Loading face recognition...',
    'requesting-camera': 'Requesting camera access...',
    'fetching-descriptor': 'Fetching your face data...',
    scanning: 'Scanning...',
    verifying: 'Verifying...',
    verified: 'Verified ✓',
    failed: 'Face not recognized',
    'camera-denied': 'Camera permission denied.',
    error: errorMsg || 'An error occurred.',
  };

  const isVerified = status === 'verified';
  const isFailed = status === 'failed';
  const isLoading = ['loading-models', 'requesting-camera', 'fetching-descriptor'].includes(status);
  const showVideo = !['loading-models', 'fetching-descriptor', 'camera-denied', 'error', 'verified', 'failed'].includes(status);

  const statusColor = isVerified
    ? '#16a34a'
    : isFailed || status === 'camera-denied' || status === 'error'
    ? '#dc2626'
    : '#6b7280';

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
          {statusText[status]}
        </div>
      )}

      <div className="relative w-full max-w-sm">
        <video
          ref={videoRef}
          muted
          playsInline
          className="rounded-xl border border-gray-200 w-full"
          style={{ display: showVideo ? 'block' : 'none' }}
        />
        {showVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-32 h-32 rounded-full border-4 border-gray-900 opacity-70"
              style={{ animation: 'scanPulse 1.5s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {isVerified && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}

      <p className="text-sm font-medium" style={{ color: statusColor }}>
        {statusText[status]}
      </p>

      {failedAttemptsRef.current > 0 && !isFailed && status === 'scanning' && (
        <p className="text-xs text-gray-400">
          Attempt {failedAttemptsRef.current}/5 — hold still and look directly at the camera
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

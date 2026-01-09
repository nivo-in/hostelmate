'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadModels, getFaceDescriptor, isSamePerson } from '@/lib/faceRecognition';
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
  | 'error';

export default function WardenFaceVerification({
  wardenId,
  onVerified,
  onFailed,
  onSkip,
}: WardenFaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storedDescriptorRef = useRef<number[] | null>(null);
  const failedAttemptsRef = useRef(0);

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
  }, []);

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
          setTimeout(onVerified, 1000);
        } else {
          failedAttemptsRef.current += 1;
          if (failedAttemptsRef.current >= 5) {
            stopCamera();
            setStatus('failed');
            onFailed('Face not recognized. Please try again.');
          } else {
            setStatus('scanning');
          }
        }
      } catch {
        setStatus('scanning');
      }
    }, 1000);
  }, [stopCamera, onVerified, onFailed]);

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
          .select('descriptor')
          .eq('warden_id', wardenId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          // No face registered for warden — skip
          onSkip();
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
  }, [wardenId, startVerificationLoop, stopCamera, onSkip]);

  const statusText: Record<Status, string> = {
    'loading-models': 'Loading face recognition...',
    'requesting-camera': 'Requesting camera access...',
    'fetching-descriptor': 'Loading your face data...',
    scanning: 'Look at the camera...',
    verifying: 'Verifying identity...',
    verified: 'Identity confirmed ✓',
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
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900">Warden Security Check</h2>
        <p className="text-sm text-gray-400 mt-1">Face verification required for warden access</p>
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
              className="w-36 h-36 rounded-full border-4 border-gray-900 opacity-70"
              style={{ animation: 'scanPulse 1.5s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {isVerified && (
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
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
        id="skip-warden-face-verification-btn"
        onClick={onSkip}
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

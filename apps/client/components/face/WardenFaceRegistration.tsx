'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadModels, getFaceDescriptor } from '@/lib/faceRecognition';
import { createClient } from '@/lib/supabase/client';

interface WardenFaceRegistrationProps {
  wardenId: string;
  onSuccess: () => void;
  onSkip: () => void;
}

type Status =
  | 'loading-models'
  | 'requesting-camera'
  | 'no-face'
  | 'face-detected'
  | 'processing'
  | 'registered'
  | 'camera-denied'
  | 'error';

export default function WardenFaceRegistration({
  wardenId,
  onSuccess,
  onSkip,
}: WardenFaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDescriptorRef = useRef<Float32Array | null>(null);

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

  const startDetectionLoop = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const descriptor = await getFaceDescriptor(videoRef.current);
        currentDescriptorRef.current = descriptor;
        setStatus(descriptor ? 'face-detected' : 'no-face');
      } catch {
        // Silently ignore transient detection errors
      }
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStatus('loading-models');
        await loadModels();
        if (cancelled) return;

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
        setStatus('no-face');
        startDetectionLoop();
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
  }, [startDetectionLoop, stopCamera]);

  const handleRegister = async () => {
    if (!currentDescriptorRef.current) return;
    setStatus('processing');
    stopCamera();

    try {
      const supabase = createClient();
      const { error } = await supabase.from('warden_face_descriptors').upsert(
        {
          warden_id: wardenId,
          descriptor: Array.from(currentDescriptorRef.current),
        },
        { onConflict: 'warden_id' }
      );
      if (error) throw error;
      setStatus('registered');
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save face data');
    }
  };

  const statusText: Record<Status, string> = {
    'loading-models': 'Loading face recognition...',
    'requesting-camera': 'Requesting camera access...',
    'no-face': 'No face detected — position yourself in frame',
    'face-detected': 'Face detected ✓',
    processing: 'Saving...',
    registered: 'Face registered successfully!',
    'camera-denied': 'Camera permission denied.',
    error: errorMsg || 'An error occurred.',
  };

  const faceDetected = status === 'face-detected';
  const isLoading = status === 'loading-models' || status === 'requesting-camera';
  const isProcessing = status === 'processing';
  const isRegistered = status === 'registered';
  const showVideo = !['loading-models', 'camera-denied', 'error'].includes(status);

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Register Your Face</h2>
        <p className="text-sm text-gray-400 mt-1">Used for warden login verification</p>
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
        {showVideo && !isLoading && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              border: `3px solid ${faceDetected ? '#16a34a' : '#dc2626'}`,
              transition: 'border-color 0.3s ease',
            }}
          />
        )}
      </div>

      {!isLoading && (
        <p
          className="text-sm font-medium"
          style={{
            color: isRegistered
              ? '#16a34a'
              : faceDetected
              ? '#16a34a'
              : status === 'camera-denied' || status === 'error'
              ? '#dc2626'
              : '#6b7280',
          }}
        >
          {statusText[status]}
        </p>
      )}

      {!isLoading && status !== 'camera-denied' && status !== 'error' && !isRegistered && (
        <button
          id="warden-register-face-btn"
          onClick={handleRegister}
          disabled={!faceDetected || isProcessing}
          className="bg-gray-900 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Saving...' : 'Save Face Data'}
        </button>
      )}

      {status === 'camera-denied' && (
        <p className="text-xs text-gray-500 text-center max-w-xs">
          Camera access was denied. Please enable camera permissions in your browser settings, then refresh.
        </p>
      )}

      <button
        id="skip-warden-face-registration-btn"
        onClick={onSkip}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

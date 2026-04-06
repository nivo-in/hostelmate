'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadModels,
  getFaceDetection,
} from '@/lib/faceRecognition';
import { createClient } from '@/lib/supabase/client';

type Role = 'student' | 'warden';

const CONFIG: Record<Role, { table: string; idCol: string; accent: string; rgb: string }> = {
  student: { table: 'face_descriptors', idCol: 'student_id', accent: '#fb923c', rgb: '251,146,60' },
  warden: { table: 'warden_face_descriptors', idCol: 'warden_id', accent: '#a78bfa', rgb: '167,139,250' },
};

type Status =
  | 'loading'
  | 'guiding'
  | 'no-face'
  | 'processing'
  | 'registered'
  | 'camera-denied'
  | 'error';

interface FaceEnrollmentProps {
  subjectId: string;
  role: Role;
  onSuccess: () => void;
  onCancel: () => void;
}

const RING = 150;
const TICKS = 48;

export default function FaceEnrollment({ subjectId, role, onSuccess, onCancel }: FaceEnrollmentProps) {
  const cfg = CONFIG[role];

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [filledTicks, setFilledTicks] = useState<Set<number>>(new Set());
  const [promptText, setPromptText] = useState('Position your face in the circle');
  const [errorMsg, setErrorMsg] = useState('');

  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCancelRef.current = onCancel;
  });

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

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleSave = async (descriptors: number[][]) => {
    setStatus('processing');
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        [cfg.idCol]: subjectId,
        descriptor: descriptors,
        descriptor_straight: descriptors[0] ?? null,
        descriptor_left: descriptors[1] ?? null,
        descriptor_right: descriptors[2] ?? null,
        descriptor_up: descriptors[3] ?? null,
        descriptor_down: descriptors[4] ?? null,
      };

      const { error } = await supabase.from(cfg.table).upsert(payload, { onConflict: cfg.idCol });
      if (error) throw error;
      
      setStatus('registered');
      setTimeout(() => onSuccessRef.current(), 1500);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg((err as Error).message || 'Failed to save face data');
    }
  };

  const startScanning = useCallback(async () => {
    try {
      setStatus('loading');
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('guiding');

      let tickProgress = 0;
      const descriptors: Float32Array[] = [];
      
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        const detection = await getFaceDetection(videoRef.current);
        
        if (!detection) {
          setStatus('no-face');
          setPromptText('Bring your face into view');
          return;
        }

        setStatus('guiding');
        setPromptText('Slowly turn your head in a circle');

        descriptors.push(detection.descriptor);
        
        tickProgress += 1;
        
        setFilledTicks((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < 3; i++) {
             const tickIdx = (tickProgress * 3 + i) % TICKS;
             next.add(tickIdx);
          }
          return next;
        });

        if (tickProgress > (TICKS / 3)) {
           clearInterval(intervalRef.current!);
           intervalRef.current = null;
           
           const descsArray = Array.from(descriptors);
           const finalDescs: number[][] = [];
           for (let i = 0; i < 5; i++) {
             const idx = Math.floor((i / 5) * descsArray.length);
             finalDescs.push(Array.from(descsArray[idx]));
           }
           
           setFilledTicks(new Set(Array.from({ length: TICKS }, (_, i) => i)));
           setPromptText('Scan complete');
           
           setTimeout(() => handleSave(finalDescs), 800);
        }
      }, 150);

    } catch (err: unknown) {
      if ((err as Error).name === 'NotAllowedError') setStatus('camera-denied');
      else {
        setStatus('error');
        setErrorMsg((err as Error).message);
      }
    }
  }, [cfg, subjectId]);

  useEffect(() => {
    startScanning();
    return stopCamera;
  }, [startScanning, stopCamera]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-6 py-8 select-none">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Set up Face ID</h2>
        <p className="text-sm text-gray-500 mt-2">{promptText}</p>
      </div>

      <div className="relative w-[300px] h-[300px] flex items-center justify-center">
        {status !== 'loading' && status !== 'camera-denied' && status !== 'error' && (
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute rounded-full object-cover"
            style={{ width: RING * 2 - 40, height: RING * 2 - 40, transform: 'scaleX(-1)' }}
          />
        )}

        {/* The Apple ID ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 300">
          {Array.from({ length: TICKS }).map((_, i) => {
            const angle = (i * 360) / TICKS - 90;
            const isFilled = filledTicks.has(i);
            return (
              <line
                key={i}
                x1="150"
                y1="20"
                x2="150"
                y2="35"
                stroke={isFilled ? cfg.accent : '#e5e7eb'}
                strokeWidth="4"
                strokeLinecap="round"
                transform={`rotate(${angle} 150 150)`}
                className="transition-colors duration-300"
              />
            );
          })}
        </svg>

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full" />
          </div>
        )}
      </div>

      {status === 'processing' && (
        <div className="text-center animate-pulse text-sm text-gray-500">
          Saving biometric data...
        </div>
      )}

      {status === 'registered' && (
        <div className="text-green-600 font-medium">
          Successfully enrolled!
        </div>
      )}

      {status === 'error' && (
        <div className="text-red-500 text-sm">
          {errorMsg}
        </div>
      )}

      <button
        onClick={() => onCancelRef.current()}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
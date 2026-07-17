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
const REQUIRED_TICKS = 42; // Finish when almost all ticks are filled

export default function FaceEnrollment({ subjectId, role, onSuccess, onCancel }: FaceEnrollmentProps) {
  const cfg = CONFIG[role];

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [filledTicks, setFilledTicks] = useState<Set<number>>(new Set());
  const [activeTicks, setActiveTicks] = useState<Set<number>>(new Set());
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
      if (error) {throw error;}
      
      setStatus('registered');
      setTimeout(() => onSuccessRef.current(), 1500);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg((err as Error).message || 'Failed to save face data');
    }
  };

  const getHeadAngleIndex = (landmarks: import('face-api.js').FaceLandmarks68) => {
    const pts = landmarks.positions;
    
    // Center of eyes
    const leftEyeX = (pts[36].x + pts[39].x) / 2;
    const leftEyeY = (pts[36].y + pts[39].y) / 2;
    const rightEyeX = (pts[42].x + pts[45].x) / 2;
    const rightEyeY = (pts[42].y + pts[45].y) / 2;
    
    const noseX = pts[30].x;
    const noseY = pts[30].y;
    
    const mouthY = (pts[51].y + pts[57].y) / 2;
    
    const leftEyeDist = noseX - leftEyeX;
    const rightEyeDist = rightEyeX - noseX;
    let yaw = (leftEyeDist - rightEyeDist) / ((leftEyeDist + rightEyeDist) || 1);

    const eyeLineY = (leftEyeY + rightEyeY) / 2;
    const noseToEye = noseY - eyeLineY;
    const mouthToNose = mouthY - noseY;
    let pitch = (noseToEye - mouthToNose) / ((noseToEye + mouthToNose) || 1);
    
    // INCREASED SENSITIVITY LOOKING DOWN: Multiply downward pitch by 1.8x
    if (pitch > 0) {
      pitch *= 1.8;
    } else {
      pitch *= 1.2;
    }
    yaw *= 1.5;

    const radius = Math.sqrt(yaw * yaw + pitch * pitch);
    if (radius < 0.12) {
       return -1; // Looking straight, not rotating
    }
    
    // Calculate angle (-yaw because video is mirrored horizontally)
    let angle = Math.atan2(pitch, -yaw) * 180 / Math.PI; 
    if (angle < 0) {angle += 360;}
    
    return Math.floor((angle / 360) * TICKS) % TICKS;
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

      const descriptors: Float32Array[] = [];
      const currentFilled = new Set<number>();
      
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current) {return;}
        const detection = await getFaceDetection(videoRef.current);
        
        if (!detection) {
          setStatus('no-face');
          setActiveTicks(new Set());
          return;
        }

        setStatus('guiding');
        setPromptText("Re-scan to confirm it's you, then update");

        descriptors.push(detection.descriptor);
        
        const centerTick = getHeadAngleIndex(detection.landmarks);
        
        if (centerTick === -1) {
          // Looking straight, no new lines glow
          setActiveTicks(new Set());
        } else {
          // GLOW 4 LINES AT A TIME
          const newActive = new Set<number>();
          for (let i = -1; i <= 2; i++) {
            const t = (centerTick + i + TICKS) % TICKS;
            newActive.add(t);
            currentFilled.add(t);
          }
          setActiveTicks(newActive);
          setFilledTicks(new Set(currentFilled));
        }

        if (currentFilled.size >= REQUIRED_TICKS) {
           clearInterval(intervalRef.current!);
           intervalRef.current = null;
           
           const descsArray = Array.from(descriptors);
           
           // Compute the mean descriptor from ALL captured frames —
           // this produces the most stable, robust canonical vector.
           const len = descsArray[0].length;
           const mean = new Array<number>(len).fill(0);
           for (const d of descsArray) {
             for (let j = 0; j < len; j++) {mean[j] += d[j];}
           }
           for (let j = 0; j < len; j++) {mean[j] /= descsArray.length;}
           
           // Also pick 4 evenly-spaced angle snapshots for multi-angle matching
           const finalDescs: number[][] = [mean]; // index 0 = mean (descriptor_straight)
           for (let i = 1; i <= 4; i++) {
             const idx = Math.floor((i / 4) * (descsArray.length - 1));
             finalDescs.push(Array.from(descsArray[idx]));
           }
           
           setFilledTicks(new Set(Array.from({ length: TICKS }, (_, i) => i)));
           setActiveTicks(new Set());
           setPromptText('Scan complete');
           
           setTimeout(() => handleSave(finalDescs), 800);
        }
      }, 150);

    } catch (err: unknown) {
      if ((err as Error).name === 'NotAllowedError') {setStatus('camera-denied');}
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
    <div 
      ref={containerRef} 
      className="relative flex flex-col items-center justify-center w-full min-h-[550px] select-none py-10 overflow-hidden" 
      style={{ background: '#0a0a0c', borderRadius: '16px' }}
    >
      {/* Background radial glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none opacity-[0.15]"
        style={{
          background: `radial-gradient(circle, ${cfg.accent} 0%, transparent 65%)`
        }}
      />

      <div className="text-center z-10 mb-10">
        <h2 className="text-[22px] font-semibold tracking-wide text-[#f4f4f5]">Update Face ID</h2>
        <p className="text-[14px] text-[#a1a1aa] mt-2 font-medium">{promptText}</p>
      </div>

      <div className="relative flex items-center justify-center mb-10" style={{ width: RING * 2, height: RING * 2 }}>
        {status !== 'loading' && status !== 'camera-denied' && status !== 'error' && (
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute rounded-full object-cover shadow-2xl"
            style={{ 
              width: RING * 2 - 60, 
              height: RING * 2 - 60, 
              transform: 'scaleX(-1)',
              background: '#18181b'
            }}
          />
        )}

        {/* The Apple ID ring */}
        <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 300 300" style={{ transform: 'rotate(-90deg)' }}>
          {Array.from({ length: TICKS }).map((_, i) => {
            const angle = (i * 360) / TICKS;
            const isFilled = filledTicks.has(i);
            const isActive = activeTicks.has(i);
            
            let strokeColor = 'rgba(255, 255, 255, 0.12)';
            let strokeWidth = "3";
            let lineLength = "21"; // y2 value
            
            if (isFilled) {
              strokeColor = cfg.accent;
              strokeWidth = "3.5";
              lineLength = "26";
            }
            if (isActive) {
              strokeColor = '#ffffff';
              strokeWidth = "4";
              lineLength = "28";
            }

            return (
              <line
                key={i}
                x1="150"
                y1="10"
                x2="150"
                y2={lineLength}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                transform={`rotate(${angle} 150 150)`}
                className="transition-all duration-300 ease-out"
                style={{
                  filter: isActive ? `drop-shadow(0 0 8px ${cfg.accent})` : 'none'
                }}
              />
            );
          })}
        </svg>

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
             <div className="animate-spin w-10 h-10 border-4 border-white/10 border-t-white rounded-full" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-5 z-10">
        <div className="px-5 py-2 rounded-full bg-black/50 border border-white/10 text-[#d4d4d8] text-[13px] font-medium backdrop-blur-md">
          {status === 'guiding' ? 'Rotate your head slowly' : 
           status === 'no-face' ? 'Bring your face into view' :
           status === 'processing' ? 'Saving biometric data...' : 
           'Position your face in the circle'}
        </div>

        {status === 'registered' && (
          <div className="text-green-400 text-sm font-medium tracking-wide">
            Successfully updated!
          </div>
        )}

        {status === 'error' && (
          <div className="text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <button
          onClick={() => onCancelRef.current()}
          className="mt-2 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white transition-colors text-[14px] font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
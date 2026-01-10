'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadModels, getFaceDescriptor, computeMeanDescriptor } from '@/lib/faceRecognition';
import { createClient } from '@/lib/supabase/client';

// ── Guided capture phases ─────────────────────────────────────────────────────
// Each phase has: a label, an icon (emoji/arrow), a hint, and how many
// frames to collect. We average within each phase then store all phase
// averages as number[][] — like Apple Face ID multi-angle enrolment.

const PHASES = [
  {
    id: 'center',
    label: 'Look straight',
    hint: 'Face the camera directly',
    icon: '●',
    arrow: null,
    frames: 6,
  },
  {
    id: 'left',
    label: 'Turn left',
    hint: 'Slowly rotate your head to the left',
    icon: '←',
    arrow: 'left',
    frames: 5,
  },
  {
    id: 'right',
    label: 'Turn right',
    hint: 'Slowly rotate your head to the right',
    icon: '→',
    arrow: 'right',
    frames: 5,
  },
  {
    id: 'up',
    label: 'Tilt up',
    hint: 'Tilt your chin up slightly',
    icon: '↑',
    arrow: 'up',
    frames: 4,
  },
  {
    id: 'down',
    label: 'Tilt down',
    hint: 'Tilt your chin down slightly',
    icon: '↓',
    arrow: 'down',
    frames: 4,
  },
] as const;

type PhaseId = (typeof PHASES)[number]['id'];

interface PhaseState {
  id: PhaseId;
  collected: number;
  required: number;
  done: boolean;
}

type Status =
  | 'loading-models'
  | 'requesting-camera'
  | 'guiding'      // actively collecting per-phase
  | 'no-face'      // face lost during a phase
  | 'processing'   // saving to DB
  | 'registered'
  | 'camera-denied'
  | 'error';

interface FaceRegistrationProps {
  studentId: string;
  onSuccess: () => void;
  onSkip: () => void;
}

export default function FaceRegistration({
  studentId,
  onSuccess,
  onSkip,
}: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-phase descriptor buffers
  const phaseBuffersRef = useRef<Map<PhaseId, Float32Array[]>>(new Map());
  // Final per-phase mean descriptors (one per angle)
  const collectedDescriptorsRef = useRef<number[][]>([]);

  const onSuccessRef = useRef(onSuccess);
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onSkipRef.current = onSkip;
  });

  const [status, setStatus] = useState<Status>('loading-models');
  const [errorMsg, setErrorMsg] = useState('');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phases, setPhases] = useState<PhaseState[]>(
    PHASES.map((p) => ({ id: p.id, collected: 0, required: p.frames, done: false }))
  );
  const [noFaceFrames, setNoFaceFrames] = useState(0);

  const currentPhaseIndexRef = useRef(0);
  const phasesRef = useRef(phases);
  useEffect(() => {
    phasesRef.current = phases;
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

  const handleSave = useCallback(async () => {
    stopCamera();
    setStatus('processing');
    try {
      const supabase = createClient();
      const descs = collectedDescriptorsRef.current;
      const { error } = await supabase.from('face_descriptors').upsert(
        {
          student_id: studentId,
          descriptor: descs,
          descriptor_straight: descs[0] ?? null,
          descriptor_left:     descs[1] ?? null,
          descriptor_right:    descs[2] ?? null,
          descriptor_up:       descs[3] ?? null,
          descriptor_down:     descs[4] ?? null,
        },
        { onConflict: 'student_id' }
      );
      if (error) throw error;
      setStatus('registered');
      setTimeout(() => onSuccessRef.current(), 1200);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save face data');
    }
  }, [studentId, stopCamera]);

  // Advance to next phase or finish
  const advancePhase = useCallback(() => {
    const nextIdx = currentPhaseIndexRef.current + 1;
    if (nextIdx >= PHASES.length) {
      // All phases done — stop loop and save
      clearInterval(intervalRef.current!);
      intervalRef.current = null;
      handleSave();
    } else {
      currentPhaseIndexRef.current = nextIdx;
      setPhaseIndex(nextIdx);
      phaseBuffersRef.current.set(PHASES[nextIdx].id, []);
    }
  }, [handleSave]);

  const startCaptureLoop = useCallback(() => {
    // Init buffers
    phaseBuffersRef.current = new Map(PHASES.map((p) => [p.id, []]));
    currentPhaseIndexRef.current = 0;

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      const currentPhase = PHASES[currentPhaseIndexRef.current];
      try {
        const descriptor = await getFaceDescriptor(videoRef.current);

        if (!descriptor) {
          setNoFaceFrames((n) => n + 1);
          setStatus((s) => (s !== 'no-face' ? 'no-face' : s));
          return;
        }

        setNoFaceFrames(0);
        setStatus('guiding');

        const buf = phaseBuffersRef.current.get(currentPhase.id) ?? [];
        buf.push(descriptor);
        phaseBuffersRef.current.set(currentPhase.id, buf);

        // Update UI counter for this phase
        setPhases((prev) =>
          prev.map((p) =>
            p.id === currentPhase.id
              ? { ...p, collected: Math.min(buf.length, p.required) }
              : p
          )
        );

        // Phase complete?
        if (buf.length >= currentPhase.frames) {
          const meanDesc = computeMeanDescriptor(buf);
          collectedDescriptorsRef.current = [
            ...collectedDescriptorsRef.current,
            meanDesc,
          ];
          // Mark done
          setPhases((prev) =>
            prev.map((p) => (p.id === currentPhase.id ? { ...p, done: true } : p))
          );
          advancePhase();
        }
      } catch {
        // transient error — ignore
      }
    }, 500);
  }, [advancePhase]);

  useEffect(() => {
    let cancelled = false;
    collectedDescriptorsRef.current = [];

    const init = async () => {
      try {
        setStatus('loading-models');
        await loadModels();
        if (cancelled) return;

        setStatus('requesting-camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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
        setStatus('guiding');
        startCaptureLoop();
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
  }, [startCaptureLoop, stopCamera]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const isLoading = status === 'loading-models' || status === 'requesting-camera';
  const showVideo = !['loading-models', 'camera-denied', 'error', 'registered', 'processing'].includes(status);
  const currentPhase = PHASES[phaseIndex];
  const currentPhaseState = phases[phaseIndex];
  const totalRequired = PHASES.reduce((s, p) => s + p.frames, 0);
  const totalCollected = phases.reduce((s, p) => s + Math.min(p.collected, p.required), 0);
  const overallProgress = Math.round((totalCollected / totalRequired) * 100);

  const arrowStyle = (arrow: string | null): React.CSSProperties => {
    if (!arrow) return {};
    const map: Record<string, React.CSSProperties> = {
      left:  { transform: 'translateX(-8px)' },
      right: { transform: 'translateX(8px)' },
      up:    { transform: 'translateY(-8px)' },
      down:  { transform: 'translateY(8px)' },
    };
    return map[arrow] ?? {};
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 select-none">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900">Set Up Face ID</h2>
        <p className="text-sm text-gray-400 mt-1">
          Follow the prompts to scan your face from multiple angles
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {status === 'loading-models' ? 'Loading face recognition...' : 'Starting camera...'}
        </div>
      )}

      {/* Camera + overlay */}
      {showVideo && (
        <div className="relative w-full max-w-sm">
          <video
            ref={videoRef}
            muted
            playsInline
            className="rounded-2xl w-full"
            style={{ transform: 'scaleX(-1)' /* mirror for selfie feel */ }}
          />

          {/* Oval face guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative"
              style={{
                width: '42%',
                paddingTop: '58%',
                ...arrowStyle(currentPhase?.arrow ?? null),
                transition: 'transform 0.4s ease',
              }}
            >
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 136"
                fill="none"
              >
                <ellipse
                  cx="50"
                  cy="68"
                  rx="48"
                  ry="66"
                  stroke={status === 'no-face' ? '#ef4444' : phases[phaseIndex]?.done ? '#16a34a' : '#ffffff'}
                  strokeWidth="3"
                  strokeDasharray={status === 'no-face' ? '8 4' : 'none'}
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))',
                    transition: 'stroke 0.3s ease',
                  }}
                />
              </svg>
            </div>
          </div>

          {/* Phase direction arrow */}
          {currentPhase?.arrow && status === 'guiding' && (
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <div
                className="bg-black/60 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5"
                style={{ backdropFilter: 'blur(4px)' }}
              >
                <span className="text-base">{currentPhase.icon}</span>
                {currentPhase.label}
              </div>
            </div>
          )}

          {/* No face warning */}
          {status === 'no-face' && noFaceFrames > 2 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-red-500/80 text-white text-xs px-3 py-1 rounded-full">
                Position your face in the oval
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase pills */}
      {(status === 'guiding' || status === 'no-face') && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {phases.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300"
              style={{
                background: p.done
                  ? '#dcfce7'
                  : i === phaseIndex
                  ? '#f0f9ff'
                  : '#f9fafb',
                color: p.done ? '#15803d' : i === phaseIndex ? '#0369a1' : '#9ca3af',
                border: `1.5px solid ${p.done ? '#86efac' : i === phaseIndex ? '#7dd3fc' : '#e5e7eb'}`,
              }}
            >
              {p.done ? (
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <polyline points="2 6 5 9 10 3" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <span>{PHASES[i].icon}</span>
              )}
              {PHASES[i].label}
            </div>
          ))}
        </div>
      )}

      {/* Overall progress bar */}
      {(status === 'guiding' || status === 'no-face') && (
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{currentPhase ? currentPhase.hint : ''}</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${overallProgress}%`,
                background: overallProgress === 100 ? '#16a34a' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
          {currentPhaseState && !currentPhaseState.done && (
            <p className="text-xs text-gray-400 mt-1 text-center">
              {currentPhaseState.collected}/{currentPhaseState.required} frames captured for this angle
            </p>
          )}
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm text-gray-500">Saving your face data...</p>
        </div>
      )}

      {/* Success */}
      {status === 'registered' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-700">Face ID registered!</p>
        </div>
      )}

      {/* Camera denied */}
      {status === 'camera-denied' && (
        <p className="text-xs text-gray-500 text-center max-w-xs py-4">
          Camera access was denied. Enable camera permissions in your browser settings, then refresh.
        </p>
      )}

      {/* Error */}
      {status === 'error' && (
        <p className="text-xs text-red-500 text-center max-w-xs py-4">{errorMsg}</p>
      )}

      {/* Skip */}
      {status !== 'registered' && status !== 'processing' && (
        <button
          id="skip-face-registration-btn"
          onClick={() => onSkipRef.current()}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

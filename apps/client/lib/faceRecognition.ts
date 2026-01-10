'use client';

// All face-api.js imports must be dynamic because it requires browser APIs
// (canvas, HTMLVideoElement, etc.) that do not exist in Node/SSR context.

let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  const faceapi = await import('face-api.js');
  const MODEL_URL = '/models';

  await Promise.all([
    // SsdMobilenetv1 is significantly more accurate than TinyFaceDetector
    // and handles varied angles / lighting much better
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

export async function getFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<Float32Array | null> {
  const faceapi = await import('face-api.js');

  const detections = await faceapi
    .detectAllFaces(
      videoElement,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length !== 1) {
    return null;
  }

  return detections[0].descriptor;
}

/**
 * Get face descriptor AND landmarks in a single pass (more efficient for liveness).
 * Returns null if no single face is detected.
 */
export async function getFaceDetection(videoElement: HTMLVideoElement): Promise<{
  descriptor: Float32Array;
  landmarks: import('face-api.js').FaceLandmarks68;
  box: { x: number; y: number; width: number; height: number };
} | null> {
  const faceapi = await import('face-api.js');

  const detections = await faceapi
    .detectAllFaces(
      videoElement,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length !== 1) return null;

  const det = detections[0];
  return {
    descriptor: det.descriptor,
    landmarks: det.landmarks,
    box: {
      x: det.detection.box.x,
      y: det.detection.box.y,
      width: det.detection.box.width,
      height: det.detection.box.height,
    },
  };
}

export function euclideanDistance(a: Float32Array, b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compare a live descriptor against ALL stored multi-angle descriptors.
 * Returns the MINIMUM distance found (best match across all angles).
 */
export function bestMatchDistance(
  liveDescriptor: Float32Array,
  storedDescriptors: number[][]
): number {
  if (storedDescriptors.length === 0) return Infinity;
  let minDist = Infinity;
  for (const stored of storedDescriptors) {
    const dist = euclideanDistance(liveDescriptor, stored);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Compare live descriptor against all stored angle descriptors.
 * Uses threshold 0.45 (tighter than default 0.6 to reduce false positives).
 * confidence: 0–100, distance: raw euclidean distance (minimum across angles).
 */
export function isSamePerson(
  liveDescriptor: Float32Array,
  storedDescriptors: number[][]
): { match: boolean; confidence: number; distance: number } {
  const distance = bestMatchDistance(liveDescriptor, storedDescriptors);
  const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / 0.6) * 100)));
  const match = distance < 0.52;
  return { match, confidence, distance };
}

/**
 * Compute the mean (average) of a set of descriptors from the SAME angle.
 * Used per-phase in registration to get a stable descriptor for that angle.
 */
export function computeMeanDescriptor(descriptors: Float32Array[]): number[] {
  if (descriptors.length === 0) throw new Error('No descriptors provided');
  const len = descriptors[0].length;
  const mean = new Array<number>(len).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) {
      mean[i] += d[i];
    }
  }
  for (let i = 0; i < len; i++) {
    mean[i] /= descriptors.length;
  }
  return mean;
}

// ── Liveness Detection ────────────────────────────────────────────────────────

/**
 * Calculate Eye Aspect Ratio (EAR) from 68-point face landmarks.
 *
 * Left eye:  landmarks 36–41
 * Right eye: landmarks 42–47
 *
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * EAR < 0.25 → eye closed (blink)
 *
 * We average both eyes for a single value.
 */
export function calculateEAR(
  landmarks: import('face-api.js').FaceLandmarks68
): number {
  const pts = landmarks.positions;

  const eyeEAR = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number },
    p5: { x: number; y: number },
    p6: { x: number; y: number }
  ): number => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
  };

  // Left eye: 36, 37, 38, 39, 40, 41
  const leftEAR = eyeEAR(
    pts[36], pts[37], pts[38], pts[39], pts[40], pts[41]
  );
  // Right eye: 42, 43, 44, 45, 46, 47
  const rightEAR = eyeEAR(
    pts[42], pts[43], pts[44], pts[45], pts[46], pts[47]
  );

  return (leftEAR + rightEAR) / 2;
}

/** Threshold below which both eyes are considered closed (blink) */
export const EAR_BLINK_THRESHOLD = 0.25;

/**
 * EMA smoothing helper.
 * alpha = weight for new value (0.3 = smooth, higher = more reactive).
 * Usage: smoothed = applyEMA(smoothed, newValue)
 */
export function applyEMA(current: number, newValue: number, alpha = 0.3): number {
  return alpha * newValue + (1 - alpha) * current;
}

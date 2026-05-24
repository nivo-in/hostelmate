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
 * This is the key to robust face recognition — we registered from 5 angles,
 * so at least one should be a close match even if lighting/pose varies.
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
 * Returns true if the live face matches any of the stored angle descriptors.
 * Threshold of 0.42 is strict but correct for faceRecognitionNet.
 * (0.6 was the old loose threshold that caused false accepts)
 */
export function isSamePerson(
  liveDescriptor: Float32Array,
  storedDescriptors: number[][],
  threshold = 0.42
): boolean {
  return bestMatchDistance(liveDescriptor, storedDescriptors) < threshold;
}

/**
 * Compute the mean (average) of a set of descriptors from the SAME angle.
 * Used per-phase in registration to get a stable descriptor for that angle.
 */
export function computeMeanDescriptor(descriptors: Float32Array[]): number[] {
  if (descriptors.length === 0) throw new Error('No descriptors provided');
  const len = descriptors[0].length;
  const mean = new Array(len).fill(0);
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

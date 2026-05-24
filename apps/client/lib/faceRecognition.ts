'use client';

// All face-api.js imports must be dynamic because it requires browser APIs
// (canvas, HTMLVideoElement, etc.) that do not exist in Node/SSR context.

let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  const faceapi = await import('face-api.js');
  const MODEL_URL = '/models';

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
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
    .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length !== 1) {
    // Return null when no face or multiple faces detected
    return null;
  }

  return detections[0].descriptor;
}

export async function compareFaces(
  descriptor1: Float32Array,
  descriptor2: number[]
): Promise<number> {
  const faceapi = await import('face-api.js');
  const d2 = new Float32Array(descriptor2);
  return faceapi.euclideanDistance(descriptor1, d2);
}

export async function isSamePerson(
  descriptor1: Float32Array,
  descriptor2: number[],
  threshold = 0.6
): Promise<boolean> {
  const distance = await compareFaces(descriptor1, descriptor2);
  return distance < threshold;
}

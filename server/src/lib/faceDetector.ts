import path from 'node:path';
import sharp from 'sharp';

import { validationConfig } from '../config/validation.config';
import { MAX_INPUT_PIXELS } from './metrics';
import type { DetectedFace, FaceDetector } from './validateFile';
import logger from '../utils/logger';

/* eslint-disable @typescript-eslint/no-var-requires */

// ---------------------------------------------------------------------------
// The ONLY file that imports tfjs / face-api. Everything else takes a FaceDetector
// function, so the whole validation suite runs against a fake with no model load.
//
// Model: SSD MobileNetV1 (5.4 MB) + the 68-point landmark net (348 KB), both
// VENDORED under server/models/face-api — no download at boot, no network in CI.
//
// Not `tiny_face_detector`: it is faster, but on the calibration corpus it missed
// real frontal faces (every miss was a person wearing glasses), and dropping its
// threshold far enough to recover them immediately started hallucinating a second
// face — which, given rule 6 rejects multiple faces, would reject good photos.
// ---------------------------------------------------------------------------

// Neither package ships types usable from a CJS require, so the surface WE use is
// declared here. Keep it minimal: a wider shim is a bigger lie when it drifts.
interface Tensor3D {
  dispose(): void;
}

interface FaceApiNet {
  loadFromDisk(modelPath: string): Promise<void>;
}

interface FaceApiPoint {
  x: number;
  y: number;
}

interface FaceApiResult {
  detection: {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  };
  landmarks: { positions: FaceApiPoint[] };
}

interface LandmarkTask {
  withFaceLandmarks(): Promise<FaceApiResult[]>;
}

interface FaceApiModule {
  nets: { ssdMobilenetv1: FaceApiNet; faceLandmark68Net: FaceApiNet };
  SsdMobilenetv1Options: new (opts: { minConfidence: number }) => object;
  detectAllFaces(input: Tensor3D, options: object): LandmarkTask;
}

interface TfModule {
  tensor3d(data: Uint8Array, shape: [number, number, number]): Tensor3D;
  getBackend(): string;
}

// The CommonJS node bundle. The ESM entry reaches for browser globals and dies.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const faceapi = require('@vladmandic/face-api/dist/face-api.node.js') as FaceApiModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tf = require('@tensorflow/tfjs-node') as TfModule;

const MODEL_PATH = process.env['FACE_MODELS'] ?? path.join(process.cwd(), 'models/face-api');

let loadPromise: Promise<void> | null = null;

/**
 * Single-flight model load: concurrent callers share ONE load.
 *
 * The `.catch` that nulls the promise is not decoration. Without it, a cached
 * REJECTED promise is returned forever — one transient failure during the first
 * load and face detection is dead for the entire process lifetime, with a single
 * log line as the only symptom.
 */
const ensureReady = async (): Promise<void> => {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    logger.info('face-api models loaded', { path: MODEL_PATH, backend: tf.getBackend() });
  })().catch((err: unknown) => {
    loadPromise = null; // let the next caller retry
    throw err;
  });
  return loadPromise;
};

/**
 * Decode with SHARP, not `tf.node.decodeImage`.
 *
 * tfjs' decoder only handles JPEG/PNG/GIF/BMP. sharp handles everything we accept
 * (and HEIC has already been transcoded upstream). `.rotate()` bakes EXIF
 * orientation into the pixels so a portrait photo is not analysed sideways;
 * `.removeAlpha()` guarantees exactly 3 channels, which is what the tensor shape
 * below claims.
 */
const toTensor = async (buf: Buffer): Promise<Tensor3D> => {
  const { data, info } = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
};

export const detectFaces: FaceDetector = async (buf: Buffer): Promise<DetectedFace[]> => {
  await ensureReady();

  const tensor = await toTensor(buf);
  try {
    const results = await faceapi
      .detectAllFaces(
        tensor,
        // The RECALL floor — deliberately below faceScoreMin, so a weak/small face
        // is still SEEN and can be reported as FACE_TOO_SMALL rather than NO_FACE.
        new faceapi.SsdMobilenetv1Options({ minConfidence: validationConfig.faceDetectMin }),
      )
      .withFaceLandmarks();

    return results.map((r): DetectedFace => ({
      box: {
        x: r.detection.box.x,
        y: r.detection.box.y,
        width: r.detection.box.width,
        height: r.detection.box.height,
      },
      score: r.detection.score,
      landmarks: r.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    }));
  } finally {
    // tfjs holds NATIVE memory outside the JS heap — the GC will not reclaim this.
    tensor.dispose();
  }
};

/** Warm the model at boot so the first upload does not pay the load. */
export const warmFaceDetector = (): Promise<void> => ensureReady();

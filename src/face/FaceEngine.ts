import * as faceapi from 'face-api.js';
import type { FaceDetection, CameraSettings } from '@/types';
import { getSetting } from '@/stores/settingsStore';
import { fetchWithTimeout, NetworkError } from '@/utils/network';

type DetectionCallback = (detections: FaceDetection[]) => void;
type ErrorCallback = (error: Error) => void;

const FACE_API_MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

const FACE_API_TIMEOUT = 30000;
const FACE_API_RETRY_DELAY = 2000;

export class FaceEngine {
  private isInitialized = false;
  private isRunning = false;
  private animationFrame: number | null = null;
  private video: HTMLVideoElement | null = null;
  private onDetectionCallbacks: Set<DetectionCallback> = new Set();
  private onErrorCallbacks: Set<ErrorCallback> = new Set();
  private settings: ReturnType<typeof getSetting>;
  private detectionInterval = 100;
  private lastDetectionTime = 0;
  private canvas: HTMLCanvasElement | null = null;
  private displaySize: { width: number; height: number } = { width: 640, height: 480 };
  private initializationPromise: Promise<void> | null = null;
  private initializationError: Error | null = null;
  private modelsLoaded = false;

  constructor() {
    this.settings = getSetting('face');
  }

  async initialize(modelsPath: string = '/models'): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.doInitialize(modelsPath);
    try {
      await this.initializationPromise;
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error(String(error));
      this.initializationPromise = null;
      throw this.initializationError;
    }
  }

  private async doInitialize(modelsPath: string): Promise<void> {
    const startTime = performance.now();
    console.log('[FACE] Initializing face-api.js models...');

    const modelConfigs = [
      { net: faceapi.nets.tinyFaceDetector, name: 'TinyFaceDetector' },
      { net: faceapi.nets.faceLandmark68Net, name: 'FaceLandmark68' },
      { net: faceapi.nets.faceRecognitionNet, name: 'FaceRecognition' },
      { net: faceapi.nets.faceExpressionNet, name: 'FaceExpression' },
    ];

    const loadResults = await Promise.allSettled(
      modelConfigs.map(({ net, name }) => this.loadModelWithTimeout(net, modelsPath, name))
    );

    const failed: Array<{ name: string; reason: unknown }> = [];
    loadResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed.push({ name: modelConfigs[i].name, reason: r.reason });
      }
    });

    if (failed.length > 0) {
      const errors = failed.map(f => `${f.name}: ${f.reason}`).join('; ');
      console.error('[FACE] Some models failed to load:', errors);
      
      if (failed.length === modelConfigs.length) {
        throw new NetworkError(
          `All face models failed to load: ${errors}`,
          'ALL_MODELS_FAILED'
        );
      }
      
      console.warn('[FACE] Continuing with partially loaded models');
    }

    this.isInitialized = true;
    this.modelsLoaded = true;
    console.log(`[FACE] Face models initialized in ${(performance.now() - startTime).toFixed(0)}ms (${modelConfigs.length - failed.length}/${modelConfigs.length} loaded)`);
  }

  private async loadModelWithTimeout(
    net: any,
    modelsPath: string,
    modelName: string
  ): Promise<void> {
    const loadStartTime = performance.now();
    
    try {
      await net.loadFromUri(modelsPath);
      console.log(`[FACE] ${modelName} loaded from local in ${(performance.now() - loadStartTime).toFixed(0)}ms`);
      return;
    } catch (localError) {
      console.warn(`[FACE] ${modelName} not found locally, trying CDN:`, localError);
    }

    try {
      await this.loadModelFromCdn(net, modelName);
      console.log(`[FACE] ${modelName} loaded from CDN in ${(performance.now() - loadStartTime).toFixed(0)}ms`);
    } catch (cdnError) {
      throw new NetworkError(
        `${modelName} failed to load from both local and CDN: ${cdnError instanceof Error ? cdnError.message : 'unknown'}`,
        'MODEL_LOAD_FAILED',
        undefined,
        cdnError instanceof Error ? cdnError : undefined
      );
    }
  }

  private async loadModelFromCdn(net: any, modelName: string): Promise<void> {
    const cdnBase = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new NetworkError(`${modelName} CDN load timeout`, 'TIMEOUT'));
      }, FACE_API_TIMEOUT);

      net.loadFromUri(cdnBase).then(() => {
        clearTimeout(timeoutId);
        resolve();
      }).catch((error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async initializeWithFallback(modelsPath: string = '/models'): Promise<boolean> {
    try {
      await this.initialize(modelsPath);
      return true;
    } catch (error) {
      console.warn('[FACE] Primary initialization failed:', error);
      this.initializationError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  isInitializationFailed(): boolean {
    return this.initializationError !== null;
  }

  getInitializationError(): Error | null {
    return this.initializationError;
  }

  areModelsLoaded(): boolean {
    return this.modelsLoaded;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Face engine not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      await this.stop();
    }

    this.video = video;
    this.isRunning = true;
    
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';

    this.startDetectionLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.video = null;
    this.canvas = null;
  }

  private startDetectionLoop(): void {
    const loop = async () => {
      if (!this.isRunning || !this.video) return;

      const now = Date.now();
      if (now - this.lastDetectionTime >= this.detectionInterval) {
        this.lastDetectionTime = now;
        await this.detect();
      }

      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
  }

  private async detect(): Promise<void> {
    if (!this.video || !this.isInitialized) return;

    try {
      const settings = getSetting('face');
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: settings.threshold,
      });

      const detections = await faceapi
        .detectAllFaces(this.video, options)
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions();

      const results: FaceDetection[] = detections.map(d => {
        const box = d.detection.box;
        const landmarks = d.landmarks.positions.map(p => ({
          x: p.x,
          y: p.y,
          z: 0,
        }));
        
        return {
          box: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          landmarks,
          embedding: new Float32Array(d.descriptor),
          confidence: d.detection.score,
        };
      });

      if (results.length > 0) {
        this.notifyDetection(results.slice(0, settings.maxFaces));
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  }

  async detectSingle(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<FaceDetection | null> {
    if (!this.isInitialized) return null;

    try {
      const settings = getSetting('face');
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: settings.threshold,
      });

      const detection = await faceapi
        .detectSingleFace(image, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) return null;

      const box = detection.detection.box;
      const landmarks = detection.landmarks.positions.map(p => ({
        x: p.x,
        y: p.y,
        z: 0,
      }));

      return {
        box: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        landmarks,
        embedding: new Float32Array(detection.descriptor),
        confidence: detection.detection.score,
      };
    } catch (error) {
      console.error('Single face detection error:', error);
      return null;
    }
  }

  async enrollFace(video: HTMLVideoElement, sampleCount: number = 10): Promise<{ images: string[]; embedding: Float32Array } | null> {
    const images: string[] = [];
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < sampleCount; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const detection = await this.detectSingle(video);
      if (detection && detection.confidence > 0.7) {
        embeddings.push(detection.embedding);
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          images.push(canvas.toDataURL('image/jpeg', 0.8));
        }
      }
    }

    if (embeddings.length < 3) {
      return null;
    }

    const avgEmbedding = this.averageEmbeddings(embeddings);
    return { images, embedding: avgEmbedding };
  }

  private averageEmbeddings(embeddings: Float32Array[]): Float32Array {
    const dim = embeddings[0].length;
    const avg = new Float32Array(dim);
    
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        avg[i] += emb[i];
      }
    }
    
    for (let i = 0; i < dim; i++) {
      avg[i] /= embeddings.length;
    }
    
    const norm = Math.sqrt(avg.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < dim; i++) {
      avg[i] /= norm;
    }
    
    return avg;
  }

  computeSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  onDetection(callback: DetectionCallback): () => void {
    this.onDetectionCallbacks.add(callback);
    return () => this.onDetectionCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  private notifyDetection(detections: FaceDetection[]): void {
    this.onDetectionCallbacks.forEach(cb => {
      try {
        cb(detections);
      } catch (error) {
        console.error('Detection callback error:', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.onErrorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        console.error('Error callback error:', e);
      }
    });
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  setDetectionInterval(interval: number): void {
    this.detectionInterval = Math.max(50, interval);
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async drawDetections(canvas: HTMLCanvasElement, detections: FaceDetection[]): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const detection of detections) {
      const { box, landmarks, confidence } = detection;
      
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = '14px Arial';
      ctx.fillText(`Face: ${(confidence * 100).toFixed(1)}%`, box.x, box.y - 5);
      
      ctx.fillStyle = '#ff0000';
      for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}

export const faceEngine = new FaceEngine();
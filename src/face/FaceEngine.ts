import * as faceapi from 'face-api.js';
import type { FaceDetection, CameraSettings } from '@/types';
import { getSetting } from '@/stores/settingsStore';

type DetectionCallback = (detections: FaceDetection[]) => void;
type ErrorCallback = (error: Error) => void;

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

  constructor() {
    this.settings = getSetting('face');
  }

  async initialize(modelsPath: string = '/models'): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelsPath),
        faceapi.nets.faceExpressionNet.loadFromUri(modelsPath),
      ]);

      this.isInitialized = true;
      console.log('Face recognition models loaded');
    } catch (error) {
      console.error('Failed to load face models:', error);
      this.notifyError(error as Error);
      throw error;
    }
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
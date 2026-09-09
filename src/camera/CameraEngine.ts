import type { CameraDevice, CameraSettings } from '@/types';
import { getSetting } from '@/stores/settingsStore';

type CameraCallback = (video: HTMLVideoElement) => void;
type ErrorCallback = (error: Error) => void;

export class CameraEngine {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private animationFrame: number | null = null;
  private onFrameCallbacks: Set<CameraCallback> = new Set();
  private onErrorCallbacks: Set<ErrorCallback> = new Set();
  private isRunning = false;
  private settings: CameraSettings;
  private facingMode: 'user' | 'environment' = 'user';

  constructor() {
    this.settings = getSetting('camera');
    this.facingMode = this.settings.facingMode;
  }

  async getDevices(): Promise<CameraDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: 'videoinput' as const,
        }));
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }

  async start(deviceId?: string): Promise<HTMLVideoElement> {
    if (this.isRunning) {
      await this.stop();
    }

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('autoplay', 'true');
    this.video.setAttribute('muted', 'true');
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.objectFit = 'cover';

    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: this.settings.width },
        height: { ideal: this.settings.height },
        frameRate: { ideal: this.settings.frameRate },
        facingMode: this.facingMode,
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not created'));
        
        this.video.onloadedmetadata = () => {
          this.video?.play().then(resolve).catch(reject);
        };
        this.video.onerror = () => reject(new Error('Video load failed'));
      });

      this.isRunning = true;
      this.startFrameLoop();
      
      return this.video;
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private startFrameLoop(): void {
    const loop = () => {
      if (!this.isRunning || !this.video) return;
      
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.notifyFrame(this.video);
      }
      
      this.animationFrame = requestAnimationFrame(loop);
    };
    
    this.animationFrame = requestAnimationFrame(loop);
  }

  onFrame(callback: CameraCallback): () => void {
    this.onFrameCallbacks.add(callback);
    return () => this.onFrameCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  private notifyFrame(video: HTMLVideoElement): void {
    this.onFrameCallbacks.forEach(cb => {
      try {
        cb(video);
      } catch (error) {
        console.error('Frame callback error:', error);
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

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getSettings(): CameraSettings {
    return { ...this.settings };
  }

  updateSettings(settings: Partial<CameraSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  setFacingMode(mode: 'user' | 'environment'): void {
    this.facingMode = mode;
    this.settings.facingMode = mode;
  }

  async switchCamera(deviceId: string): Promise<void> {
    await this.start(deviceId);
  }

  takePhoto(): string | null {
    if (!this.video || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (this.settings.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(this.video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  getVideoDimensions(): { width: number; height: number } | null {
    if (!this.video) return null;
    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight,
    };
  }

  isActive(): boolean {
    return this.isRunning && this.stream !== null;
  }
}

export const cameraEngine = new CameraEngine();
import type { CameraDevice, CameraSettings } from '@/types';
import { cameraManager, CameraError, CameraErrorCode } from '@/camera/CameraManager';
import { getSetting } from '@/stores/settingsStore';
import { startupLogger } from '@/utils/startupLogger';

type CameraCallback = (video: HTMLVideoElement) => void;
type ErrorCallback = (error: Error) => void;

export class CameraEngine {
  private video: HTMLVideoElement | null = null;
  private onFrameCallbacks: Set<CameraCallback> = new Set();
  private onErrorCallbacks: Set<ErrorCallback> = new Set();
  private isRunning = false;
  private settings: CameraSettings;
  private facingMode: 'user' | 'environment' = 'user';
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeFrame: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;
  private initializationPromise: Promise<HTMLVideoElement> | null = null;

  constructor() {
    this.settings = getSetting('camera');
    this.facingMode = this.settings.facingMode;
    
    // Subscribe to CameraManager state
    this.unsubscribeState = cameraManager.onStateChange((state, diagnostics) => {
      startupLogger.debug('CAMERA_ENGINE', `CameraManager state: ${state}`, { 
        frameReceived: diagnostics.frameReceived,
        error: diagnostics.error 
      });
    });
    
    this.unsubscribeFrame = cameraManager.onFrame((video) => {
      this.notifyFrame(video);
    });
    
    this.unsubscribeError = cameraManager.onError((error) => {
      this.notifyError(error);
    });
  }

  async getDevices(): Promise<CameraDevice[]> {
    try {
      const devices = await cameraManager.getDevices();
      return devices;
    } catch (error) {
      startupLogger.error('CAMERA_ENGINE', 'Failed to enumerate devices', error);
      return [];
    }
  }

  async start(deviceId?: string): Promise<HTMLVideoElement> {
    if (this.isRunning && cameraManager.isRunning()) {
      this.video = cameraManager.getVideoElement();
      return this.video!;
    }

    try {
      // Initialize or re-initialize camera
      this.video = await cameraManager.initialize(deviceId);
      
      // Start the camera stream
      await cameraManager.start();
      
      this.isRunning = true;
      startupLogger.info('CAMERA_ENGINE', 'Camera started via CameraManager');
      
      return this.video!;
    } catch (error) {
      if (error instanceof CameraError) {
        startupLogger.error('CAMERA_ENGINE', `Camera error: ${error.code}`, error.message);
      } else {
        startupLogger.error('CAMERA_ENGINE', 'Failed to start camera', error);
      }
      this.notifyError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    if (this.unsubscribeFrame) {
      this.unsubscribeFrame();
      this.unsubscribeFrame = null;
    }
    if (this.unsubscribeError) {
      this.unsubscribeError();
      this.unsubscribeError = null;
    }
    
    await cameraManager.stop();
    this.video = null;
    startupLogger.info('CAMERA_ENGINE', 'Camera stopped');
  }

  async switchCamera(deviceId: string): Promise<void> {
    try {
      this.video = await cameraManager.switchCamera(deviceId);
      startupLogger.info('CAMERA_ENGINE', `Switched camera to ${deviceId}`);
    } catch (error) {
      startupLogger.error('CAMERA_ENGINE', 'Failed to switch camera', error);
      throw error;
    }
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video || cameraManager.getVideoElement();
  }

  getStream(): MediaStream | null {
    return cameraManager.getStream();
  }

  getSettings(): CameraSettings {
    const caps = cameraManager.getCapabilities();
    return {
      ...this.settings,
      width: caps.width,
      height: caps.height,
      frameRate: caps.frameRate,
      facingMode: caps.facingMode,
    };
  }

  updateSettings(settings: Partial<CameraSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  setFacingMode(mode: 'user' | 'environment'): void {
    this.facingMode = mode;
    this.settings.facingMode = mode;
    // Note: facingMode change requires re-initialization
  }

  takePhoto(): string | null {
    return cameraManager.takePhoto();
  }

  getVideoDimensions(): { width: number; height: number } | null {
    return cameraManager.getVideoDimensions();
  }

  isActive(): boolean {
    return this.isRunning && cameraManager.isRunning();
  }

  isReady(): boolean {
    return cameraManager.isReady();
  }

  getState() {
    return cameraManager.getState();
  }

  getDiagnostics() {
    return cameraManager.getDiagnostics();
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
}

export const cameraEngine = new CameraEngine();
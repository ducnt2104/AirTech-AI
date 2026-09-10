import { cameraEngine } from '@/camera/CameraEngine';
import { getSetting } from '@/stores/settingsStore';
import { startupLogger } from '@/utils/startupLogger';

export type CameraState = 
  | 'idle' 
  | 'detecting' 
  | 'initializing' 
  | 'testing' 
  | 'ready' 
  | 'running' 
  | 'reconnecting' 
  | 'error' 
  | 'stopped';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput';
}

export interface CameraCapabilities {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export interface CameraDiagnostics {
  timestamp: number;
  state: CameraState;
  devices: CameraDeviceInfo[];
  selectedDevice: CameraDeviceInfo | null;
  capabilities: CameraCapabilities | null;
  backend: string;
  frameReceived: boolean;
  frameWidth: number;
  frameHeight: number;
  frameTimestamp: number;
  error: string | null;
  retryCount: number;
  initializationTime: number;
}

type StateListener = (state: CameraState, diagnostics: CameraDiagnostics) => void;
type FrameListener = (video: HTMLVideoElement) => void;
type ErrorListener = (error: CameraError) => void;

export class CameraError extends Error {
  constructor(
    message: string,
    public readonly code: CameraErrorCode,
    public readonly originalError?: Error,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

export type CameraErrorCode = 
  | 'NO_DEVICES'
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'INITIALIZATION_TIMEOUT'
  | 'FRAME_TIMEOUT'
  | 'DEVICE_BUSY'
  | 'UNSUPPORTED_RESOLUTION'
  | 'STREAM_ENDED'
  | 'UNKNOWN';

const DEFAULT_CAPABILITIES: CameraCapabilities = {
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'user',
};

const FALLBACK_RESOLUTIONS: CameraCapabilities[] = [
  { width: 1280, height: 720, frameRate: 30, facingMode: 'user' },
  { width: 1024, height: 576, frameRate: 30, facingMode: 'user' },
  { width: 800, height: 600, frameRate: 30, facingMode: 'user' },
  { width: 640, height: 480, frameRate: 30, facingMode: 'user' },
  { width: 640, height: 480, frameRate: 15, facingMode: 'user' },
];

const INIT_TIMEOUT = 10000;
const FRAME_VERIFY_TIMEOUT = 5000;
const MAX_RETRIES = 3;

export class CameraManager {
  private static instance: CameraManager | null = null;
  
  private state: CameraState = 'idle';
  private diagnostics: CameraDiagnostics = this.createInitialDiagnostics();
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private selectedDeviceId: string | null = null;
  private currentCapabilities: CameraCapabilities = DEFAULT_CAPABILITIES;
  private retryCount = 0;
  private initStartTime = 0;
  private frameVerifyTimer: ReturnType<typeof setTimeout> | null = null;
  private initTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private frameCheckInterval: ReturnType<typeof setInterval> | null = null;
  
  private stateListeners: Set<StateListener> = new Set();
  private frameListeners: Set<FrameListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  
  private frameReceived = false;
  private lastFrameTime = 0;
  private frameCount = 0;

  static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  private createInitialDiagnostics(): CameraDiagnostics {
    return {
      timestamp: Date.now(),
      state: 'idle',
      devices: [],
      selectedDevice: null,
      capabilities: null,
      backend: 'MediaDevices API',
      frameReceived: false,
      frameWidth: 0,
      frameHeight: 0,
      frameTimestamp: 0,
      error: null,
      retryCount: 0,
      initializationTime: 0,
    };
  }

  private updateDiagnostics(partial: Partial<CameraDiagnostics>): void {
    this.diagnostics = {
      ...this.diagnostics,
      ...partial,
      timestamp: Date.now(),
    };
  }

  private setState(state: CameraState): void {
    this.state = state;
    this.updateDiagnostics({ state });
    this.notifyStateListeners();
    startupLogger.info('CAMERA', `State changed: ${state}`, this.diagnostics);
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(this.state, this.diagnostics);
      } catch (e) {
        console.error('State listener error:', e);
      }
    });
  }

  private notifyFrameListeners(): void {
    if (this.video && this.frameReceived) {
      this.frameListeners.forEach(listener => {
        try {
          listener(this.video!);
        } catch (e) {
          console.error('Frame listener error:', e);
        }
      });
    }
  }

  private notifyError(error: CameraError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error listener error:', e);
      }
    });
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state, this.diagnostics);
    return () => this.stateListeners.delete(listener);
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  getState(): CameraState {
    return this.state;
  }

  getDiagnostics(): CameraDiagnostics {
    return { ...this.diagnostics };
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  isReady(): boolean {
    return this.state === 'ready' || this.state === 'running';
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  async detectDevices(): Promise<CameraDeviceInfo[]> {
    this.setState('detecting');
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: 'videoinput' as const,
        }));

      this.updateDiagnostics({ devices: videoDevices });
      startupLogger.info('CAMERA', `Detected ${videoDevices.length} camera(s)`, { devices: videoDevices });
      
      return videoDevices;
    } catch (error) {
      const camError = new CameraError(
        'Failed to enumerate camera devices',
        'NO_DEVICES',
        error instanceof Error ? error : undefined
      );
      this.handleError(camError);
      throw camError;
    }
  }

  async initialize(deviceId?: string): Promise<HTMLVideoElement> {
    if (this.state === 'initializing' || this.state === 'testing') {
      throw new CameraError('Camera already initializing', 'UNKNOWN');
    }

    this.initStartTime = performance.now();
    this.retryCount = 0;
    this.frameReceived = false;
    this.frameCount = 0;
    this.lastFrameTime = 0;

    const devices = await this.detectDevices();
    
    if (devices.length === 0) {
      const error = new CameraError(
        'No camera devices found. Please connect a webcam.',
        'NO_DEVICES'
      );
      this.handleError(error);
      throw error;
    }

    // Select device: use provided, saved, or first available
    const settings = getSetting('camera');
    const savedDeviceId = settings.deviceId;
    this.selectedDeviceId = deviceId || savedDeviceId || devices[0].deviceId;
    
    const selectedDevice = devices.find(d => d.deviceId === this.selectedDeviceId) || devices[0];
    this.updateDiagnostics({ selectedDevice });
    
    startupLogger.info('CAMERA', `Selected camera: ${selectedDevice.label} (${selectedDevice.deviceId})`);

    return this.initializeWithRetry(this.selectedDeviceId);
  }

  private async initializeWithRetry(deviceId: string): Promise<HTMLVideoElement> {
    const capabilities = this.currentCapabilities;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      this.retryCount = attempt;
      this.updateDiagnostics({ retryCount: attempt });
      
      try {
        startupLogger.info('CAMERA', `Initialization attempt ${attempt + 1}/${MAX_RETRIES + 1}`, { 
          deviceId, 
          capabilities 
        });
        
        this.setState('initializing');
        
        const video = await this.tryInitialize(deviceId, capabilities);
        
        // Verify frame
        this.setState('testing');
        await this.verifyFrame(video);
        
        this.setState('ready');
        this.updateDiagnostics({ 
          initializationTime: performance.now() - this.initStartTime,
          error: null 
        });
        
        startupLogger.info('CAMERA', `Camera ready in ${this.diagnostics.initializationTime}ms`);
        return video;
        
      } catch (error) {
        startupLogger.warn('CAMERA', `Attempt ${attempt + 1} failed`, { error: error instanceof Error ? error.message : error });
        
        if (attempt < MAX_RETRIES) {
          this.setState('reconnecting');
          
          // Try fallback resolution on next attempt
          if (attempt < FALLBACK_RESOLUTIONS.length - 1) {
            this.currentCapabilities = FALLBACK_RESOLUTIONS[attempt + 1];
            startupLogger.info('CAMERA', 'Trying fallback resolution', this.currentCapabilities);
          }
          
          await this.cleanup();
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        
        // All retries exhausted
        const camError = error instanceof CameraError 
          ? error 
          : new CameraError(
              `Camera initialization failed after ${MAX_RETRIES + 1} attempts: ${error instanceof Error ? error.message : 'unknown'}`,
              'INITIALIZATION_TIMEOUT',
              error instanceof Error ? error : undefined,
              false
            );
        
        this.handleError(camError);
        throw camError;
      }
    }

    throw new CameraError('Unexpected initialization failure', 'UNKNOWN');
  }

  private async tryInitialize(deviceId: string, capabilities: CameraCapabilities): Promise<HTMLVideoElement> {
    return new Promise(async (resolve, reject) => {
      // Setup init timeout
      this.initTimeoutTimer = setTimeout(() => {
        reject(new CameraError(
          `Camera initialization timeout after ${INIT_TIMEOUT}ms`,
          'INITIALIZATION_TIMEOUT'
        ));
      }, INIT_TIMEOUT);

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: capabilities.width, min: 320, max: 1920 },
            height: { ideal: capabilities.height, min: 240, max: 1080 },
            frameRate: { ideal: capabilities.frameRate, min: 10, max: 60 },
            facingMode: capabilities.facingMode,
          },
          audio: false,
        };

        startupLogger.info('CAMERA', 'Requesting camera access', constraints);
        
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Create video element
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', 'true');
        this.video.setAttribute('autoplay', 'true');
        this.video.setAttribute('muted', 'true');
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.objectFit = 'cover';
        
        this.video.srcObject = this.stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolveVideo, rejectVideo) => {
          if (!this.video) return rejectVideo(new Error('Video element not created'));
          
          const cleanup = () => {
            this.video!.onloadedmetadata = null;
            this.video!.onerror = null;
          };
          
          this.video.onloadedmetadata = () => {
            cleanup();
            this.video!.play()
              .then(resolveVideo)
              .catch(rejectVideo);
          };
          
          this.video.onerror = () => {
            cleanup();
            rejectVideo(new Error('Video element error'));
          };
        });

        // Get actual capabilities from stream
        const track = this.stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        this.currentCapabilities = {
          width: settings.width || capabilities.width,
          height: settings.height || capabilities.height,
          frameRate: settings.frameRate || capabilities.frameRate,
          facingMode: (settings.facingMode as 'user' | 'environment') || capabilities.facingMode,
        };
        
        this.updateDiagnostics({ 
          capabilities: this.currentCapabilities,
          selectedDevice: this.diagnostics.devices.find(d => d.deviceId === deviceId) || null
        });

        clearTimeout(this.initTimeoutTimer!);
        this.initTimeoutTimer = null;
        
        startupLogger.info('CAMERA', 'Camera stream acquired', this.currentCapabilities);
        resolve(this.video!);
        
      } catch (error) {
        clearTimeout(this.initTimeoutTimer!);
        this.initTimeoutTimer = null;
        
        if (error instanceof CameraError) {
          reject(error);
        } else if (error instanceof DOMException) {
          let code: CameraErrorCode = 'UNKNOWN';
          let recoverable = true;
          
          switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
              code = 'PERMISSION_DENIED';
              recoverable = false;
              break;
            case 'NotFoundError':
            case 'DevicesNotFoundError':
              code = 'DEVICE_NOT_FOUND';
              break;
            case 'NotReadableError':
            case 'TrackStartError':
              code = 'DEVICE_BUSY';
              break;
            case 'OverconstrainedError':
              code = 'UNSUPPORTED_RESOLUTION';
              break;
          }
          
          reject(new CameraError(
            this.getUserFriendlyErrorMessage(code, error.message),
            code,
            error,
            recoverable
          ));
        } else {
          reject(new CameraError(
            `Camera initialization failed: ${error instanceof Error ? error.message : 'unknown'}`,
            'UNKNOWN',
            error instanceof Error ? error : undefined
          ));
        }
      }
    });
  }

  private async verifyFrame(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      this.frameVerifyTimer = setTimeout(() => {
        if (!this.frameReceived) {
          this.stopFrameCheck();
          reject(new CameraError(
            `No frame received within ${FRAME_VERIFY_TIMEOUT}ms`,
            'FRAME_TIMEOUT'
          ));
        }
      }, FRAME_VERIFY_TIMEOUT);

      this.frameCheckInterval = setInterval(() => {
        if (video.readyState >= video.HAVE_ENOUGH_DATA && 
            video.videoWidth > 0 && 
            video.videoHeight > 0) {
          
          this.frameReceived = true;
          this.frameCount++;
          this.lastFrameTime = Date.now();
          
          this.updateDiagnostics({
            frameReceived: true,
            frameWidth: video.videoWidth,
            frameHeight: video.videoHeight,
            frameTimestamp: this.lastFrameTime,
          });
          
          this.stopFrameCheck();
          this.startFrameLoop();
          resolve();
        }
      }, 100);
    });
  }

  private startFrameLoop(): void {
    const loop = () => {
      if (this.state !== 'ready' && this.state !== 'running' || !this.video) {
        return;
      }
      
      if (this.video.readyState >= this.video.HAVE_ENOUGH_DATA) {
        this.frameCount++;
        this.lastFrameTime = Date.now();
        this.frameReceived = true;
        
        this.updateDiagnostics({
          frameReceived: true,
          frameWidth: this.video.videoWidth,
          frameHeight: this.video.videoHeight,
          frameTimestamp: this.lastFrameTime,
        });
        
        this.notifyFrameListeners();
      }
      
      requestAnimationFrame(loop);
    };
    
    requestAnimationFrame(loop);
  }

  private stopFrameCheck(): void {
    if (this.frameVerifyTimer) {
      clearTimeout(this.frameVerifyTimer);
      this.frameVerifyTimer = null;
    }
    if (this.frameCheckInterval) {
      clearInterval(this.frameCheckInterval);
      this.frameCheckInterval = null;
    }
  }

  async start(): Promise<HTMLVideoElement> {
    if (!this.video || !this.stream) {
      throw new CameraError('Camera not initialized', 'UNKNOWN');
    }
    
    if (this.state === 'running') {
      return this.video;
    }
    
    this.setState('running');
    startupLogger.info('CAMERA', 'Camera started');
    return this.video;
  }

  async stop(): Promise<void> {
    this.setState('stopped');
    await this.cleanup();
    startupLogger.info('CAMERA', 'Camera stopped');
  }

  private async cleanup(): Promise<void> {
    this.stopFrameCheck();
    
    if (this.initTimeoutTimer) {
      clearTimeout(this.initTimeoutTimer);
      this.initTimeoutTimer = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        startupLogger.debug('CAMERA', `Stopped track: ${track.kind}`);
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    
    this.frameReceived = false;
    this.frameCount = 0;
    this.lastFrameTime = 0;
  }

  async switchCamera(deviceId: string): Promise<HTMLVideoElement> {
    startupLogger.info('CAMERA', `Switching camera to: ${deviceId}`);
    
    const wasRunning = this.state === 'running';
    await this.cleanup();
    
    return this.initialize(deviceId).then(video => {
      if (wasRunning) {
        return this.start();
      }
      return video;
    });
  }

  async getDevices(): Promise<CameraDeviceInfo[]> {
    return this.detectDevices();
  }

  getSelectedDeviceId(): string | null {
    return this.selectedDeviceId;
  }

  getCapabilities(): CameraCapabilities {
    return { ...this.currentCapabilities };
  }

  takePhoto(): string | null {
    if (!this.video || this.video.readyState < this.video.HAVE_ENOUGH_DATA) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const settings = getSetting('camera');
    if (settings.mirror) {
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

  private getUserFriendlyErrorMessage(code: CameraErrorCode, originalMessage: string): string {
    switch (code) {
      case 'PERMISSION_DENIED':
        return 'Không có quyền truy cập camera. Vui lòng kiểm tra cài đặt quyền Camera của Windows (Settings > Privacy > Camera).';
      case 'DEVICE_NOT_FOUND':
        return 'Không tìm thấy camera. Vui lòng kiểm tra kết nối webcam.';
      case 'DEVICE_BUSY':
        return 'Camera đang được ứng dụng khác sử dụng (Zoom, Teams, Discord, trình duyệt...). Vui lòng đóng ứng dụng khác và thử lại.';
      case 'UNSUPPORTED_RESOLUTION':
        return 'Camera không hỗ trợ độ phân giải yêu cầu. Đang thử độ phân giải thấp hơn...';
      case 'INITIALIZATION_TIMEOUT':
        return 'Khởi tạo camera quá lâu. Vui lòng thử lại.';
      case 'FRAME_TIMEOUT':
        return 'Camera không gửi được hình ảnh. Vui lòng kiểm tra kết nối và thử lại.';
      case 'NO_DEVICES':
        return 'Không phát hiện camera nào. Vui lòng kết nối webcam.';
      default:
        return `Lỗi camera: ${originalMessage}`;
    }
  }

  private handleError(error: CameraError): void {
    this.setState('error');
    this.updateDiagnostics({ 
      error: error.message,
      initializationTime: performance.now() - this.initStartTime,
    });
    this.notifyError(error);
    startupLogger.error('CAMERA', error.message, { code: error.code, recoverable: error.recoverable });
  }

  // Diagnostic methods
  runDiagnostics(): CameraDiagnostics {
    return this.getDiagnostics();
  }

  exportDiagnostics(): string {
    return JSON.stringify(this.getDiagnostics(), null, 2);
  }

  // For testing - force error state
  simulateError(code: CameraErrorCode): void {
    const error = new CameraError('Simulated error', code);
    this.handleError(error);
  }
}

export const cameraManager = CameraManager.getInstance();
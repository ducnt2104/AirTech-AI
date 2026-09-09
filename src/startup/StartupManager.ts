import type { Teacher } from '@/types';

export type StartupPhase = 
  | 'idle' 
  | 'environment' 
  | 'database' 
  | 'settings' 
  | 'teachers' 
  | 'face_models' 
  | 'hand_models' 
  | 'gesture_engine' 
  | 'complete' 
  | 'degraded';

export type StartupStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'fallback' 
  | 'timeout';

export interface StartupStep {
  id: string;
  name: string;
  phase: StartupPhase;
  status: StartupStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
  fallback?: string;
  critical: boolean;
  timeout: number;
}

export interface StartupResult {
  success: boolean;
  mode: 'full' | 'degraded' | 'offline';
  steps: StartupStep[];
  totalDuration: number;
  errors: string[];
  warnings: string[];
}

type StepExecutor = () => Promise<void>;
type FallbackExecutor = () => Promise<void>;

interface StepConfig {
  id: string;
  name: string;
  phase: StartupPhase;
  executor: StepExecutor;
  fallback?: FallbackExecutor;
  critical: boolean;
  timeout: number;
  dependencies?: string[];
}

export class StartupManager {
  private steps: Map<string, StepConfig> = new Map();
  private stepStatus: Map<string, StartupStep> = new Map();
  private startTime = 0;
  private onProgressCallback?: (step: StartupStep, overallProgress: number) => void;
  private onCompleteCallback?: (result: StartupResult) => void;
  private onPhaseChangeCallback?: (phase: StartupPhase) => void;
  private aborted = false;
  private parallelGroups: string[][] = [];

  constructor() {
    this.defineSteps();
    this.defineParallelGroups();
  }

  private defineSteps(): void {
    this.addStep({
      id: 'env_check',
      name: 'Kiểm tra môi trường',
      phase: 'environment',
      executor: this.checkEnvironment.bind(this),
      critical: true,
      timeout: 5000,
    });

    this.addStep({
      id: 'database_init',
      name: 'Khởi tạo cơ sở dữ liệu',
      phase: 'database',
      executor: this.initDatabase.bind(this),
      fallback: this.initDatabaseFallback.bind(this),
      critical: true,
      timeout: 15000,
      dependencies: ['env_check'],
    });

    this.addStep({
      id: 'settings_load',
      name: 'Tải cài đặt',
      phase: 'settings',
      executor: this.loadSettings.bind(this),
      fallback: this.loadSettingsFallback.bind(this),
      critical: false,
      timeout: 8000,
      dependencies: ['database_init'],
    });

    this.addStep({
      id: 'teachers_load',
      name: 'Tải danh sách giáo viên',
      phase: 'teachers',
      executor: this.loadTeachers.bind(this),
      fallback: this.loadTeachersFallback.bind(this),
      critical: false,
      timeout: 5000,
      dependencies: ['database_init'],
    });

    this.addStep({
      id: 'face_models_load',
      name: 'Tải mô hình nhận diện khuôn mặt',
      phase: 'face_models',
      executor: this.loadFaceModels.bind(this),
      fallback: this.loadFaceModelsFallback.bind(this),
      critical: false,
      timeout: 30000,
      dependencies: ['env_check'],
    });

    this.addStep({
      id: 'hand_models_load',
      name: 'Tải mô hình theo dõi tay',
      phase: 'hand_models',
      executor: this.loadHandModels.bind(this),
      fallback: this.loadHandModelsFallback.bind(this),
      critical: false,
      timeout: 30000,
      dependencies: ['env_check'],
    });

    this.addStep({
      id: 'gesture_engine_start',
      name: 'Khởi động engine cử chỉ',
      phase: 'gesture_engine',
      executor: this.startGestureEngine.bind(this),
      fallback: this.startGestureEngineFallback.bind(this),
      critical: false,
      timeout: 5000,
      dependencies: ['hand_models_load'],
    });
  }

  private defineParallelGroups(): void {
    this.parallelGroups = [
      ['env_check'],
      ['database_init'],
      ['settings_load', 'teachers_load'],
      ['face_models_load', 'hand_models_load'],
      ['gesture_engine_start'],
    ];
  }

  private addStep(config: StepConfig): void {
    this.steps.set(config.id, config);
    this.stepStatus.set(config.id, {
      id: config.id,
      name: config.name,
      phase: config.phase,
      status: 'pending',
      startTime: 0,
      critical: config.critical,
      timeout: config.timeout,
    });
  }

  onProgress(callback: (step: StartupStep, overallProgress: number) => void): void {
    this.onProgressCallback = callback;
  }

  onComplete(callback: (result: StartupResult) => void): void {
    this.onCompleteCallback = callback;
  }

  onPhaseChange(callback: (phase: StartupPhase) => void): void {
    this.onPhaseChangeCallback = callback;
  }

  abort(): void {
    this.aborted = true;
  }

  async execute(): Promise<StartupResult> {
    this.startTime = performance.now();
    this.log('STARTUP', 'Starting AIRTECH AI initialization...');
    
    const completedSteps = new Set<string>();
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const group of this.parallelGroups) {
      if (this.aborted) break;

      const groupPromises = group.map(stepId => 
        this.executeStep(stepId, completedSteps)
      );

      await Promise.allSettled(groupPromises);

      for (const stepId of group) {
        const step = this.stepStatus.get(stepId)!;
        completedSteps.add(stepId);

        if (step.status === 'failed' && step.critical) {
          errors.push(`${step.name}: ${step.error}`);
          this.log('ERROR', `Critical step failed: ${step.name} - ${step.error}`);
        } else if (step.status === 'fallback') {
          warnings.push(`${step.name}: ${step.fallback}`);
          this.log('WARN', `Fallback used for: ${step.name} - ${step.fallback}`);
        } else if (step.status === 'timeout') {
          warnings.push(`${step.name}: Timeout (${step.timeout}ms)`);
          this.log('WARN', `Timeout for: ${step.name}`);
        }
      }
    }

    const totalDuration = performance.now() - this.startTime;
    const criticalFailed = Array.from(this.stepStatus.values())
      .some(s => s.critical && (s.status === 'failed' || s.status === 'timeout'));

    const mode = criticalFailed ? 'offline' : warnings.length > 0 ? 'degraded' : 'full';

    const result: StartupResult = {
      success: !criticalFailed,
      mode,
      steps: Array.from(this.stepStatus.values()),
      totalDuration,
      errors,
      warnings,
    };

    this.log('STARTUP', `Initialization ${result.success ? 'completed' : 'failed'} in ${totalDuration.toFixed(0)}ms (mode: ${mode})`);
    
    this.onCompleteCallback?.(result);
    return result;
  }

  private async executeStep(stepId: string, completedSteps: Set<string>): Promise<void> {
    const config = this.steps.get(stepId);
    const status = this.stepStatus.get(stepId);
    if (!config || !status) return;

    if (this.aborted) {
      status.status = 'failed';
      status.error = 'Aborted';
      return;
    }

    for (const dep of config.dependencies || []) {
      if (!completedSteps.has(dep)) {
        const depStatus = this.stepStatus.get(dep);
        if (depStatus && (depStatus.status === 'failed' || depStatus.status === 'timeout')) {
          if (config.critical) {
            status.status = 'failed';
            status.error = `Dependency failed: ${dep}`;
            this.log('ERROR', `Step ${config.name} skipped due to failed dependency: ${dep}`);
            return;
          }
        }
      }
    }

    status.status = 'running';
    status.startTime = performance.now();
    this.updatePhase(config.phase);
    this.notifyProgress(status);

    this.log('STEP', `Starting: ${config.name}`);

    try {
      await this.withTimeout(config.executor(), config.timeout, config.name);
      status.status = 'completed';
      status.endTime = performance.now();
      status.duration = status.endTime - status.startTime;
      this.log('STEP', `Completed: ${config.name} (${status.duration.toFixed(0)}ms)`);
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Step failed: ${config.name} - ${status.error}`);

      if (config.fallback) {
        try {
          this.log('FALLBACK', `Executing fallback for: ${config.name}`);
          await this.withTimeout(config.fallback(), 5000, `${config.name} fallback`);
          status.status = 'fallback';
          status.fallback = 'Fallback executed successfully';
          status.endTime = performance.now();
          status.duration = status.endTime! - status.startTime;
          this.log('FALLBACK', `Fallback completed: ${config.name}`);
        } catch (fallbackError) {
          status.status = 'failed';
          status.error = `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
          this.log('ERROR', `Fallback failed: ${config.name} - ${status.error}`);
        }
      } else {
        status.status = 'failed';
      }
    }

    this.notifyProgress(status);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private updatePhase(phase: StartupPhase): void {
    this.onPhaseChangeCallback?.(phase);
  }

  private notifyProgress(step: StartupStep): void {
    const totalSteps = this.stepStatus.size;
    const completedSteps = Array.from(this.stepStatus.values())
      .filter(s => s.status === 'completed' || s.status === 'fallback').length;
    const overallProgress = Math.round((completedSteps / totalSteps) * 100);
    this.onProgressCallback?.(step, overallProgress);
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  // Step Implementations
  private async checkEnvironment(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Not running in browser environment');
    }
    if (!window.indexedDB) {
      throw new Error('IndexedDB not supported');
    }
    if (!navigator.mediaDevices) {
      throw new Error('MediaDevices API not supported');
    }
  }

  private async initDatabase(): Promise<void> {
    const { initDatabase } = await import('@/database');
    await initDatabase();
  }

  private async initDatabaseFallback(): Promise<void> {
    this.log('FALLBACK', 'Database initialization failed, using in-memory database');
  }

  private async loadSettings(): Promise<void> {
    const { useSettingsStore } = await import('@/stores/settingsStore');
    await useSettingsStore.getState().loadSettings();
  }

  private async loadSettingsFallback(): Promise<void> {
    const { useSettingsStore } = await import('@/stores/settingsStore');
    useSettingsStore.getState().resetToDefaults();
  }

  private async loadTeachers(): Promise<void> {
    const { useTeacherStore } = await import('@/stores/teacherStore');
    await useTeacherStore.getState().loadTeachers();
  }

  private async loadTeachersFallback(): Promise<void> {
    this.log('FALLBACK', 'Teachers load failed, continuing with empty list');
  }

  private async loadFaceModels(): Promise<void> {
    const { faceEngine } = await import('@/face/FaceEngine');
    const modelsPath = this.getModelsPath();
    await faceEngine.initialize(modelsPath);
  }

  private async loadFaceModelsFallback(): Promise<void> {
    this.log('FALLBACK', 'Face models not available, face recognition disabled');
    const { useSettingsStore } = await import('@/stores/settingsStore');
    useSettingsStore.getState().updateSection('face', { enabled: false });
  }

  private async loadHandModels(): Promise<void> {
    const { handEngine } = await import('@/hand/HandEngine');
    await handEngine.initialize();
  }

  private async loadHandModelsFallback(): Promise<void> {
    this.log('FALLBACK', 'Hand models not available, gesture recognition disabled');
    const { useSettingsStore } = await import('@/stores/settingsStore');
    useSettingsStore.getState().updateSection('gesture', { enabled: false });
  }

  private async startGestureEngine(): Promise<void> {
    const { gestureEngine } = await import('@/gesture/GestureEngine');
    gestureEngine.start();
  }

  private async startGestureEngineFallback(): Promise<void> {
    this.log('FALLBACK', 'Gesture engine not started');
  }

  private getModelsPath(): string {
    if (typeof window !== 'undefined') {
      const base = window.location.origin + window.location.pathname;
      return base.replace(/\/[^/]*$/, '/models');
    }
    return '/models';
  }

  getStatus(): StartupStep[] {
    return Array.from(this.stepStatus.values());
  }

  getStepStatus(stepId: string): StartupStep | undefined {
    return this.stepStatus.get(stepId);
  }
}

export const startupManager = new StartupManager();
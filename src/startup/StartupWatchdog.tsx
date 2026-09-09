import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { startupLogger } from '@/utils/startupLogger';

export interface WatchdogConfig {
  maxStartupTime: number;
  checkInterval: number;
  onTimeout?: () => void;
  onWarning?: (elapsed: number) => void;
  warningThreshold: number;
}

export type AppMode = 'full' | 'degraded' | 'offline';

export interface DegradedModeInfo {
  mode: AppMode;
  reason: string;
  disabledFeatures: string[];
  availableFeatures: string[];
  canRetry: boolean;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  maxStartupTime: 60000,
  checkInterval: 1000,
  warningThreshold: 30000,
};

class StartupWatchdog {
  private config: WatchdogConfig;
  private startTime = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private warningFired = false;
  private timeoutFired = false;
  private callbacks: Set<(info: DegradedModeInfo) => void> = new Set();
  private currentMode: AppMode = 'full';
  private disabledFeatures: string[] = [];

  constructor(config: Partial<WatchdogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    this.startTime = Date.now();
    this.warningFired = false;
    this.timeoutFired = false;

    this.timerId = setInterval(() => {
      this.check();
    }, this.config.checkInterval);

    startupLogger.info('WATCHDOG', `Watchdog started (max: ${this.config.maxStartupTime}ms)`);
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    startupLogger.info('WATCHDOG', 'Watchdog stopped');
  }

  private check(): void {
    const elapsed = Date.now() - this.startTime;

    if (!this.warningFired && elapsed >= this.config.warningThreshold) {
      this.warningFired = true;
      startupLogger.warn('WATCHDOG', `Startup warning: ${elapsed}ms elapsed (threshold: ${this.config.warningThreshold}ms)`);
      this.config.onWarning?.(elapsed);
    }

    if (!this.timeoutFired && elapsed >= this.config.maxStartupTime) {
      this.timeoutFired = true;
      startupLogger.error('WATCHDOG', `Startup timeout: ${elapsed}ms (max: ${this.config.maxStartupTime}ms)`);
      this.enterDegradedMode('Startup timeout - switching to offline mode');
      this.config.onTimeout?.();
    }
  }

  enterDegradedMode(reason: string, disabledFeatures: string[] = []): void {
    this.currentMode = 'degraded';
    this.disabledFeatures = disabledFeatures;
    this.notifyModeChange(reason);
  }

  enterOfflineMode(reason: string, disabledFeatures: string[] = []): void {
    this.currentMode = 'offline';
    this.disabledFeatures = disabledFeatures;
    this.notifyModeChange(reason);
  }

  recover(): void {
    this.currentMode = 'full';
    this.disabledFeatures = [];
    this.notifyModeChange('Recovered to full mode');
  }

  private notifyModeChange(reason: string): void {
    const info: DegradedModeInfo = {
      mode: this.currentMode,
      reason,
      disabledFeatures: this.disabledFeatures,
      availableFeatures: this.getAvailableFeatures(),
      canRetry: this.currentMode !== 'full',
    };

    this.callbacks.forEach(cb => cb(info));
    startupLogger.info('WATCHDOG', `Mode changed: ${this.currentMode} - ${reason}`);
  }

  private getAvailableFeatures(): string[] {
    const allFeatures = [
      'dashboard',
      'whiteboard',
      'lessons',
      'browser',
      'presentation',
      'teaching',
      'settings',
      'teacher_profile',
      'face_recognition',
      'gesture_control',
      'camera',
      'database',
      'settings_persistence',
    ];

    if (this.currentMode === 'offline') {
      return allFeatures.filter(f => ![
        'face_recognition',
        'gesture_control',
        'camera',
        'browser',
      ].includes(f));
    }

    if (this.currentMode === 'degraded') {
      return allFeatures.filter(f => !this.disabledFeatures.includes(f));
    }

    return allFeatures;
  }

  getCurrentMode(): AppMode {
    return this.currentMode;
  }

  getDisabledFeatures(): string[] {
    return this.disabledFeatures;
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  subscribe(callback: (info: DegradedModeInfo) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
}

export const startupWatchdog = new StartupWatchdog();

export function useStartupWatchdog(config?: Partial<WatchdogConfig>) {
  const [modeInfo, setModeInfo] = useState<DegradedModeInfo>({
    mode: 'full',
    reason: '',
    disabledFeatures: [],
    availableFeatures: [],
    canRetry: false,
  });
  const { setError } = useAppStore();

  useEffect(() => {
    const watchdog = new StartupWatchdog(config);
    
    const unsubscribe = watchdog.subscribe((info) => {
      setModeInfo(info);
      
      if (info.mode === 'offline') {
        setError(`Chế độ Offline: ${info.reason}`);
      } else if (info.mode === 'degraded') {
        setError(`Chế độ Hạn chế: ${info.reason}`);
      }
    });

    watchdog.start();

    return () => {
      unsubscribe();
      watchdog.stop();
    };
  }, [config, setError]);

  const retry = useCallback(() => {
    // This would trigger a re-initialization
    window.location.reload();
  }, []);

  return { modeInfo, retry };
}

export function useDegradedMode() {
  const { modeInfo } = useStartupWatchdog();
  return modeInfo;
}
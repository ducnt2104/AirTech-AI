import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, GeneralSettings, CameraSettings, FaceSettings, GestureSettings, DrawingSettings, AISettings, BrowserSettings, StorageSettings, PrivacySettings, PerformanceSettings, AppearanceSettings, ShortcutSettings } from '@/types';

const defaultGeneral: GeneralSettings = {
  language: 'vi',
  autoStartCamera: true,
  autoLoadLastSession: true,
  confirmBeforeExit: true,
  checkUpdates: true,
};

const defaultCamera: CameraSettings = {
  deviceId: '',
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'user',
  mirror: true,
};

const defaultFace: FaceSettings = {
  enabled: true,
  threshold: 0.6,
  maxFaces: 1,
  model: 'short',
  autoEnroll: false,
};

const defaultGesture: GestureSettings = {
  enabled: true,
  sensitivity: 0.7,
  cooldown: 500,
  customMappings: {
    DRAW: '',
    POINTER: '',
    ERASE: '',
    SELECT: '',
    UNDO: '',
    REDO: '',
    NEXT_PAGE: '',
    PREVIOUS_PAGE: '',
    OPEN_MENU: '',
    CONFIRM: '',
    CANCEL: '',
    TOOL_SWITCH: '',
    ZOOM_IN: '',
    ZOOM_OUT: '',
    PAN: '',
    NONE: '',
  },
  debounceMs: 300,
};

const defaultDrawing: DrawingSettings = {
  smoothing: 0.3,
  interpolation: true,
  pressureSensitivity: true,
  autoShapeRecognition: false,
  shapeThreshold: 0.8,
  defaultColor: '#000000',
  defaultWidth: 3,
};

const defaultAI: AISettings = {
  provider: 'local',
  localModelsPath: '',
  enableShapeRecognition: true,
  enableOCR: false,
  enableHandwritingRecognition: false,
};

const defaultBrowser: BrowserSettings = {
  homepage: 'https://www.google.com',
  enableJavaScript: true,
  enablePlugins: false,
  userAgent: '',
  allowedDomains: [],
  blockedDomains: [],
};

const defaultStorage: StorageSettings = {
  dataPath: '',
  maxStorageGB: 5,
  autoBackup: true,
  backupIntervalHours: 24,
  backupPath: '',
  compressBackups: true,
};

const defaultPrivacy: PrivacySettings = {
  localProcessingOnly: true,
  noTelemetry: true,
  deleteFaceDataOnUnregister: true,
  cameraIndicator: true,
  requirePermissionForOnlineAI: true,
};

const defaultPerformance: PerformanceSettings = {
  mode: 'balanced',
  maxFPS: 30,
  inferenceThreads: 4,
  useGPU: true,
  modelPrecision: 'fp16',
};

const defaultAppearance: AppearanceSettings = {
  theme: 'system',
  primaryColor: '#2563eb',
  fontSize: 'medium',
  reducedMotion: false,
  highContrast: false,
  toolbarPosition: 'floating',
};

const defaultShortcuts: ShortcutSettings = {
  shortcuts: {
    'undo': 'Ctrl+Z',
    'redo': 'Ctrl+Y',
    'clear': 'Ctrl+Shift+X',
    'nextSlide': 'ArrowRight',
    'prevSlide': 'ArrowLeft',
    'presentationMode': 'F5',
    'exitPresentation': 'Escape',
    'toggleToolbar': 'T',
    'toggleFullscreen': 'F11',
    'openSettings': 'Ctrl+,',
    'newBoard': 'Ctrl+N',
    'saveBoard': 'Ctrl+S',
  },
};

const defaultSettings: AppSettings = {
  general: defaultGeneral,
  camera: defaultCamera,
  face: defaultFace,
  gesture: defaultGesture,
  drawing: defaultDrawing,
  ai: defaultAI,
  browser: defaultBrowser,
  storage: defaultStorage,
  privacy: defaultPrivacy,
  performance: defaultPerformance,
  appearance: defaultAppearance,
  shortcuts: defaultShortcuts,
};

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateSection: (section: keyof AppSettings, partial: Partial<AppSettings[keyof AppSettings]>) => void;
  resetToDefaults: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoaded: false,

      loadSettings: async () => {
        try {
          const { SettingsRepository } = await import('@/database');
          const stored = SettingsRepository.getAll();
          
          const merged = { ...defaultSettings };
          for (const [key, value] of Object.entries(stored)) {
            if (key in merged && typeof merged[key as keyof AppSettings] === 'object') {
              (merged as any)[key] = { ...(merged as any)[key], ...value };
            }
          }
          
          set({ settings: merged, isLoaded: true });
        } catch (error) {
          console.error('Failed to load settings:', error);
          set({ settings: defaultSettings, isLoaded: true });
        }
      },

      updateSettings: (partial) => {
        const current = get().settings;
        const merged = deepMerge(current, partial);
        set({ settings: merged });
        
        try {
          const { SettingsRepository } = require('@/database');
          for (const [key, value] of Object.entries(merged)) {
            SettingsRepository.set(key, value);
          }
        } catch (error) {
          console.error('Failed to save settings:', error);
        }
      },

      updateSection: (section, partial) => {
        const current = get().settings;
        const sectionKey = section as keyof AppSettings;
        const merged = {
          ...current,
          [sectionKey]: deepMerge(current[sectionKey], partial),
        };
        set({ settings: merged });
        
        try {
          const { SettingsRepository } = require('@/database');
          SettingsRepository.set(section, merged[sectionKey]);
        } catch (error) {
          console.error('Failed to save settings section:', error);
        }
      },

      resetToDefaults: () => {
        set({ settings: defaultSettings });
        try {
          const { SettingsRepository } = require('@/database');
          for (const [key, value] of Object.entries(defaultSettings)) {
            SettingsRepository.set(key, value);
          }
        } catch (error) {
          console.error('Failed to reset settings:', error);
        }
      },

      exportSettings: () => {
        return JSON.stringify(get().settings, null, 2);
      },

      importSettings: (json) => {
        try {
          const imported = JSON.parse(json);
          const merged = deepMerge(defaultSettings, imported);
          set({ settings: merged });
          
          const { SettingsRepository } = require('@/database');
          for (const [key, value] of Object.entries(merged)) {
            SettingsRepository.set(key, value);
          }
          return true;
        } catch (error) {
          console.error('Failed to import settings:', error);
          return false;
        }
      },
    }),
    {
      name: 'airtech-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as any)[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== undefined) {
      (result as any)[key] = sourceValue;
    }
  }
  
  return result;
}

export function getSettings(): AppSettings {
  return useSettingsStore.getState().settings;
}

export function getSetting<K extends keyof AppSettings>(section: K): AppSettings[K] {
  return useSettingsStore.getState().settings[section];
}
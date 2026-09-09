export interface Teacher {
  id: string;
  name: string;
  code: string;
  subject: string;
  faceEmbedding?: Float32Array;
  faceImages?: string[];
  preferences: TeacherPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherPreferences {
  cameraId: string;
  cameraResolution: { width: number; height: number };
  gestureSensitivity: number;
  faceRecognitionThreshold: number;
  drawingSmoothing: number;
  theme: 'light' | 'dark' | 'system';
  language: 'vi' | 'en';
  performanceMode: 'battery' | 'balanced' | 'high';
  privacyMode: boolean;
  autoSaveInterval: number;
  showCursor: boolean;
  cursorSize: number;
}

export interface Lesson {
  id: string;
  teacherId: string;
  title: string;
  subject: string;
  description?: string;
  slides: Slide[];
  boards: Board[];
  assets: Asset[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Slide {
  id: string;
  lessonId: string;
  page: number;
  title?: string;
  content: SlideContent;
  background?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlideContent {
  type: 'whiteboard' | 'image' | 'pdf' | 'web' | 'presentation';
  data: any;
}

export interface Board {
  id: string;
  lessonId: string;
  page: number;
  strokes: Stroke[];
  annotations: Annotation[];
  viewport: Viewport;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stroke {
  id: string;
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
  timestamp: number;
  pressure?: number[];
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

export interface Annotation {
  id: string;
  type: 'text' | 'arrow' | 'circle' | 'rectangle' | 'highlight' | 'freehand';
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
  style: AnnotationStyle;
  timestamp: number;
}

export interface AnnotationStyle {
  color: string;
  fontSize?: number;
  fontFamily?: string;
  strokeWidth?: number;
  fillColor?: string;
  opacity?: number;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface Asset {
  id: string;
  lessonId: string;
  type: 'image' | 'pdf' | 'video' | 'document' | 'audio';
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  teacherId: string;
  lessonId?: string;
  boardId?: string;
  startedAt: Date;
  endedAt?: Date;
  state: SessionState;
  actions: SessionAction[];
  metadata: Record<string, any>;
}

export interface SessionAction {
  id: string;
  sessionId: string;
  type: 'draw' | 'erase' | 'undo' | 'redo' | 'navigate' | 'tool_change' | 'gesture' | 'annotation';
  data: any;
  timestamp: Date;
}

export interface SessionState {
  currentSlide: number;
  currentTool: DrawingTool;
  currentColor: string;
  currentWidth: number;
  viewport: Viewport;
  isDrawing: boolean;
  isPresenting: boolean;
}

export type DrawingTool = 
  | 'pen' 
  | 'highlighter' 
  | 'eraser' 
  | 'pointer' 
  | 'arrow' 
  | 'line' 
  | 'rectangle' 
  | 'circle' 
  | 'text' 
  | 'select';

export type GestureType = 
  | 'DRAW' 
  | 'POINTER' 
  | 'ERASE' 
  | 'SELECT' 
  | 'UNDO' 
  | 'REDO' 
  | 'NEXT_PAGE' 
  | 'PREVIOUS_PAGE' 
  | 'OPEN_MENU' 
  | 'CONFIRM' 
  | 'CANCEL' 
  | 'TOOL_SWITCH' 
  | 'ZOOM_IN' 
  | 'ZOOM_OUT' 
  | 'PAN' 
  | 'NONE';

export interface GestureEvent {
  type: GestureType;
  confidence: number;
  handLandmarks?: HandLandmarks;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface HandLandmarks {
  landmarks: Point3D[];
  handedness: 'Left' | 'Right';
  confidence: number;
  boundingBox: BoundingBox;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetection {
  box: BoundingBox;
  landmarks: Point3D[];
  embedding: Float32Array;
  confidence: number;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput';
}

export interface CameraSettings {
  deviceId: string;
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
  mirror: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  camera: CameraSettings;
  face: FaceSettings;
  gesture: GestureSettings;
  drawing: DrawingSettings;
  ai: AISettings;
  browser: BrowserSettings;
  storage: StorageSettings;
  privacy: PrivacySettings;
  performance: PerformanceSettings;
  appearance: AppearanceSettings;
  shortcuts: ShortcutSettings;
}

export interface GeneralSettings {
  language: 'vi' | 'en';
  autoStartCamera: boolean;
  autoLoadLastSession: boolean;
  confirmBeforeExit: boolean;
  checkUpdates: boolean;
}

export interface FaceSettings {
  enabled: boolean;
  threshold: number;
  maxFaces: number;
  model: 'tiny' | 'short' | 'full';
  autoEnroll: boolean;
}

export interface GestureSettings {
  enabled: boolean;
  sensitivity: number;
  cooldown: number;
  customMappings: Record<GestureType, string>;
  debounceMs: number;
}

export interface DrawingSettings {
  smoothing: number;
  interpolation: boolean;
  pressureSensitivity: boolean;
  autoShapeRecognition: boolean;
  shapeThreshold: number;
  defaultColor: string;
  defaultWidth: number;
}

export interface AISettings {
  provider: 'local' | 'online' | 'hybrid';
  onlineApiKey?: string;
  onlineEndpoint?: string;
  localModelsPath: string;
  enableShapeRecognition: boolean;
  enableOCR: boolean;
  enableHandwritingRecognition: boolean;
}

export interface BrowserSettings {
  homepage: string;
  enableJavaScript: boolean;
  enablePlugins: boolean;
  userAgent: string;
  allowedDomains: string[];
  blockedDomains: string[];
}

export interface StorageSettings {
  dataPath: string;
  maxStorageGB: number;
  autoBackup: boolean;
  backupIntervalHours: number;
  backupPath: string;
  compressBackups: boolean;
}

export interface PrivacySettings {
  localProcessingOnly: boolean;
  noTelemetry: boolean;
  deleteFaceDataOnUnregister: boolean;
  cameraIndicator: boolean;
  requirePermissionForOnlineAI: boolean;
}

export interface PerformanceSettings {
  mode: 'battery' | 'balanced' | 'high';
  maxFPS: number;
  inferenceThreads: number;
  useGPU: boolean;
  modelPrecision: 'fp32' | 'fp16' | 'int8';
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  highContrast: boolean;
  toolbarPosition: 'top' | 'bottom' | 'left' | 'right' | 'floating';
}

export interface ShortcutSettings {
  shortcuts: Record<string, string>;
}

export interface DiagnosticInfo {
  camera: ComponentStatus;
  faceAI: ComponentStatus;
  handAI: ComponentStatus;
  gesture: ComponentStatus;
  database: ComponentStatus;
  storage: ComponentStatus;
  browser: ComponentStatus;
  gpu: ComponentStatus;
  fps: FPSInfo;
  memory: MemoryInfo;
}

export interface ComponentStatus {
  status: 'ok' | 'warning' | 'error' | 'unknown';
  message: string;
  details?: Record<string, any>;
}

export interface FPSInfo {
  camera: number;
  inference: number;
  ui: number;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}

export interface BackupInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  includes: ('database' | 'files' | 'models' | 'settings')[];
}

export interface ExportFormat {
  type: 'png' | 'jpg' | 'pdf' | 'airtech' | 'zip';
  options?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  message: string;
  data?: any;
}

export type AppMode = 'dashboard' | 'whiteboard' | 'lesson' | 'browser' | 'presentation' | 'settings' | 'teacher-profile' | 'teaching';

export interface WindowState {
  mode: AppMode;
  isFullscreen: boolean;
  isMaximized: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface CoordinateMapping {
  cameraToScreen: (x: number, y: number) => { x: number; y: number };
  screenToCanvas: (x: number, y: number) => { x: number; y: number };
  canvasToScreen: (x: number, y: number) => { x: number; y: number };
}

export interface AIProvider {
  name: string;
  type: 'local' | 'online';
  analyzeDrawing(strokes: Stroke[]): Promise<ShapeRecognitionResult>;
  recognizeShape(stroke: Stroke): Promise<ShapeRecognitionResult>;
  recognizeText(imageData: ImageData): Promise<OCRResult>;
  analyzeImage(imageData: ImageData): Promise<ImageAnalysisResult>;
}

export interface ShapeRecognitionResult {
  recognized: boolean;
  shape: 'line' | 'circle' | 'rectangle' | 'triangle' | 'arrow' | 'unknown';
  confidence: number;
  normalizedPoints?: Point[];
  originalPoints: Point[];
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes: BoundingBox[];
}

export interface ImageAnalysisResult {
  objects: DetectedObject[];
  scene: string;
  confidence: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  box: BoundingBox;
}
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AppMode, Teacher, Lesson, Board, Session, SessionState, GestureEvent, HandLandmarks, FaceDetection, DiagnosticInfo } from '@/types';

interface AppState {
  mode: AppMode;
  isFullscreen: boolean;
  isLoading: boolean;
  error: string | null;
  
  currentTeacher: Teacher | null;
  currentLesson: Lesson | null;
  currentBoard: Board | null;
  currentSession: Session | null;
  
  sessionState: SessionState;
  
  cameraActive: boolean;
  faceDetected: FaceDetection | null;
  handLandmarks: HandLandmarks | null;
  lastGesture: GestureEvent | null;
  
  diagnostics: DiagnosticInfo | null;
  
  setMode: (mode: AppMode) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  setCurrentTeacher: (teacher: Teacher | null) => void;
  setCurrentLesson: (lesson: Lesson | null) => void;
  setCurrentBoard: (board: Board | null) => void;
  setCurrentSession: (session: Session | null) => void;
  
  updateSessionState: (partial: Partial<SessionState>) => void;
  addSessionAction: (action: any) => void;
  
  setCameraActive: (active: boolean) => void;
  setFaceDetected: (face: FaceDetection | null) => void;
  setHandLandmarks: (landmarks: HandLandmarks | null) => void;
  setLastGesture: (gesture: GestureEvent | null) => void;
  
  setDiagnostics: (diagnostics: DiagnosticInfo | null) => void;
  
  clearSession: () => void;
  reset: () => void;
  
  setCurrentSlide: (slide: number) => void;
  setAppMode: (mode: AppMode) => void;
}

const initialSessionState: SessionState = {
  currentSlide: 0,
  currentTool: 'pen',
  currentColor: '#000000',
  currentWidth: 3,
  viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
  isDrawing: false,
  isPresenting: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      mode: 'dashboard',
      isFullscreen: false,
      isLoading: false,
      error: null,
      
      currentTeacher: null,
      currentLesson: null,
      currentBoard: null,
      currentSession: null,
      
      sessionState: initialSessionState,
      
      cameraActive: false,
      faceDetected: null,
      handLandmarks: null,
      lastGesture: null,
      
      diagnostics: null,
      
      setMode: (mode) => set({ mode }),
      setFullscreen: (isFullscreen) => set({ isFullscreen }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      setCurrentTeacher: (teacher) => set({ currentTeacher: teacher }),
      setCurrentLesson: (lesson) => set({ currentLesson: lesson }),
      setCurrentBoard: (board) => set({ currentBoard: board }),
      setCurrentSession: (session) => set({ currentSession: session }),
      
      updateSessionState: (partial) => set((state) => ({
        sessionState: { ...state.sessionState, ...partial }
      })),
      
      addSessionAction: (action) => set((state) => {
        if (!state.currentSession) return state;
        return {
          currentSession: {
            ...state.currentSession,
            actions: [...state.currentSession.actions, action]
          }
        };
      }),
      
      setCameraActive: (cameraActive) => set({ cameraActive }),
      setFaceDetected: (faceDetected) => set({ faceDetected }),
      setHandLandmarks: (handLandmarks) => set({ handLandmarks }),
      setLastGesture: (lastGesture) => set({ lastGesture }),
      
      setDiagnostics: (diagnostics) => set({ diagnostics }),
      
      clearSession: () => set({
        currentLesson: null,
        currentBoard: null,
        currentSession: null,
        sessionState: initialSessionState,
      }),
      
      reset: () => set({
        mode: 'dashboard',
        isFullscreen: false,
        isLoading: false,
        error: null,
        currentTeacher: null,
        currentLesson: null,
        currentBoard: null,
        currentSession: null,
        sessionState: initialSessionState,
        cameraActive: false,
        faceDetected: null,
        handLandmarks: null,
        lastGesture: null,
      }),
      
      setCurrentSlide: (slide) => set((state) => ({
        sessionState: { ...state.sessionState, currentSlide: slide }
      })),
      
      setAppMode: (mode) => set({ mode }),
    }),
    { name: 'airtech-app-store' }
  )
);
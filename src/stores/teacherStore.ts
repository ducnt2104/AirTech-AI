import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Teacher, TeacherPreferences } from '@/types';
import { TeacherRepository } from '@/database';

export { TeacherRepository } from '@/database';

const defaultPreferences: TeacherPreferences = {
  cameraId: '',
  cameraResolution: { width: 1280, height: 720 },
  gestureSensitivity: 0.7,
  faceRecognitionThreshold: 0.6,
  drawingSmoothing: 0.3,
  theme: 'system',
  language: 'vi',
  performanceMode: 'balanced',
  privacyMode: true,
  autoSaveInterval: 30000,
  showCursor: true,
  cursorSize: 12,
};

interface TeacherState {
  teachers: Teacher[];
  currentTeacher: Teacher | null;
  isLoading: boolean;
  error: string | null;
  
  loadTeachers: () => Promise<void>;
  createTeacher: (data: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt' | 'preferences'> & { preferences?: Partial<TeacherPreferences> }) => Promise<Teacher>;
  updateTeacher: (id: string, data: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  setCurrentTeacher: (teacher: Teacher | null) => void;
  getTeacherByFaceEmbedding: (embedding: Float32Array, threshold?: number) => Teacher | null;
  enrollFace: (teacherId: string, faceImages: string[], embedding: Float32Array) => Promise<void>;
  clearError: () => void;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  teachers: [],
  currentTeacher: null,
  isLoading: false,
  error: null,
  
  loadTeachers: async () => {
    set({ isLoading: true, error: null });
    try {
      const teachers = TeacherRepository.getAll();
      set({ teachers, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load teachers', isLoading: false });
      console.error('Load teachers error:', error);
    }
  },
  
  createTeacher: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const now = new Date();
      const teacher: Teacher = {
        id: uuidv4(),
        ...data,
        preferences: { ...defaultPreferences, ...data.preferences },
        createdAt: now,
        updatedAt: now,
      };
      
      TeacherRepository.create(teacher);
      
      set((state) => ({
        teachers: [teacher, ...state.teachers],
        isLoading: false,
      }));
      
      return teacher;
    } catch (error) {
      set({ error: 'Failed to create teacher', isLoading: false });
      throw error;
    }
  },
  
  updateTeacher: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const teacher = get().teachers.find(t => t.id === id);
      if (!teacher) throw new Error('Teacher not found');
      
      const updated: Teacher = {
        ...teacher,
        ...data,
        updatedAt: new Date(),
      };
      
      TeacherRepository.update(updated);
      
      set((state) => ({
        teachers: state.teachers.map(t => t.id === id ? updated : t),
        currentTeacher: state.currentTeacher?.id === id ? updated : state.currentTeacher,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to update teacher', isLoading: false });
      throw error;
    }
  },
  
  deleteTeacher: async (id) => {
    set({ isLoading: true, error: null });
    try {
      TeacherRepository.delete(id);
      
      set((state) => ({
        teachers: state.teachers.filter(t => t.id !== id),
        currentTeacher: state.currentTeacher?.id === id ? null : state.currentTeacher,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to delete teacher', isLoading: false });
      throw error;
    }
  },
  
  setCurrentTeacher: (teacher) => set({ currentTeacher: teacher }),
  
  getTeacherByFaceEmbedding: (embedding, threshold = 0.6) => {
    const teachers = get().teachers.filter(t => t.faceEmbedding);
    
    let bestMatch: Teacher | null = null;
    let bestScore = threshold;
    
    for (const teacher of teachers) {
      if (!teacher.faceEmbedding) continue;
      
      const similarity = cosineSimilarity(embedding, teacher.faceEmbedding);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = teacher;
      }
    }
    
    return bestMatch;
  },
  
  enrollFace: async (teacherId, faceImages, embedding) => {
    set({ isLoading: true, error: null });
    try {
      const teacher = get().teachers.find(t => t.id === teacherId);
      if (!teacher) throw new Error('Teacher not found');
      
      const updated: Teacher = {
        ...teacher,
        faceImages,
        faceEmbedding: embedding,
        updatedAt: new Date(),
      };
      
      TeacherRepository.update(updated);
      
      set((state) => ({
        teachers: state.teachers.map(t => t.id === teacherId ? updated : t),
        currentTeacher: state.currentTeacher?.id === teacherId ? updated : state.currentTeacher,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to enroll face', isLoading: false });
      throw error;
    }
  },
  
  clearError: () => set({ error: null }),
}));

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
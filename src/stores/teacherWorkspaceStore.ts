import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiagnosticInfo } from '@/types';

interface TeacherWorkspaceState {
  diagnostics: DiagnosticInfo | null;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  openDiagnostics: () => void;
  closeDiagnostics: () => void;
  setDiagnosticInfo: (info: DiagnosticInfo) => void;
}

export const useTeacherWorkspace = create<TeacherWorkspaceState>()(
  persist(
    (set) => ({
      diagnostics: null,
      isPrivacyMode: false,
      togglePrivacyMode: () => set(state => ({ isPrivacyMode: !state.isPrivacyMode })),
      openDiagnostics: () => set({ diagnostics: null }),
      closeDiagnostics: () => set({ diagnostics: null }),
      setDiagnosticInfo: (info: DiagnosticInfo) => set({ diagnostics: info }),
    }),
    {
      name: 'airtech-teacher-workspace',
    }
  )
);
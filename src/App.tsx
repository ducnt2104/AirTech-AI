import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { startupManager, type StartupResult, type StartupStep } from '@/startup/StartupManager';
import Dashboard from '@/pages/Dashboard';
import Whiteboard from '@/pages/Whiteboard';
import Lesson from '@/pages/Lesson';
import Browser from '@/pages/Browser';
import Presentation from '@/pages/Presentation';
import Settings from '@/pages/Settings';
import TeacherProfile from '@/pages/TeacherProfile';
import Teaching from '@/pages/Teaching';
import FirstRunSetup from '@/pages/FirstRunSetup';
import Login from '@/pages/Login';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DegradedModeIndicator, StartupPerformanceBadge } from '@/components/DegradedModeIndicator';

interface StartupState {
  isComplete: boolean;
  result: StartupResult | null;
  currentStep: StartupStep | null;
  progress: number;
}

function AppRoutes() {
  const { mode, isLoading, currentTeacher, setMode, setLoading } = useAppStore();
  const { isLoaded: settingsLoaded, loadSettings } = useSettingsStore();
  const { teachers, loadTeachers } = useTeacherStore();
  const [startupState, setStartupState] = useState<StartupState>({
    isComplete: false,
    result: null,
    currentStep: null,
    progress: 0,
  });
  const [uiReady, setUiReady] = useState(false);

  useEffect(() => {
    setUiReady(true);
  }, []);

  useEffect(() => {
    if (!uiReady) return;

    let mounted = true;

    async function initializeApp() {
      try {
        startupManager.onProgress((step, overallProgress) => {
          if (!mounted) return;
          setStartupState(prev => ({
            ...prev,
            currentStep: step,
            progress: overallProgress,
          }));
        });

        startupManager.onPhaseChange((phase) => {
          if (!mounted) return;
          console.log(`[STARTUP] Phase: ${phase}`);
        });

        startupManager.onComplete((result) => {
          if (!mounted) return;
          
          setStartupState(prev => ({
            ...prev,
            isComplete: true,
            result,
          }));

          if (result.mode === 'offline') {
            useAppStore.getState().setError('Chạy ở chế độ offline - một số tính năng có thể bị hạn chế');
          } else if (result.mode === 'degraded') {
            useAppStore.getState().setError(`Chạy ở chế độ hạn chế: ${result.warnings.join(', ')}`);
          }

          setLoading(false);
          console.log(`[STARTUP] Completed in ${result.totalDuration.toFixed(0)}ms (mode: ${result.mode})`);
          
          if (result.totalDuration > 60000) {
            console.warn(`[STARTUP] WARNING: Startup took ${(result.totalDuration / 1000).toFixed(1)}s (target: <60s)`);
          }
        });

        const result = await startupManager.execute();
        
        if (mounted && result.success) {
          await loadSettings();
          await loadTeachers();
        }
      } catch (error) {
        if (!mounted) return;
        console.error('[STARTUP] Fatal error:', error);
        setLoading(false);
        useAppStore.getState().setError('Lỗi khởi động nghiêm trọng');
      }
    }

    initializeApp();

    return () => {
      mounted = false;
    };
  }, [uiReady, loadSettings, loadTeachers]);

  if (!uiReady) {
    return <LoadingScreen />;
  }

  if (!startupState.isComplete) {
    return (
      <LoadingScreen 
        progress={startupState.progress}
        currentStep={startupState.currentStep?.name}
      />
    );
  }

  const needsSetup = teachers.length === 0;
  const needsLogin = teachers.length > 0 && !currentTeacher;

  return (
    <ErrorBoundary>
      <DegradedModeIndicator />
      <StartupPerformanceBadge />
      <Routes>
        {needsSetup ? (
          <Route path="/*" element={<FirstRunSetup />} />
        ) : needsLogin ? (
          <Route path="/*" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/whiteboard" element={<Whiteboard />} />
            <Route path="/lesson/:lessonId" element={<Lesson />} />
            <Route path="/browser" element={<Browser />} />
            <Route path="/presentation/:lessonId?" element={<Presentation />} />
            <Route path="/teaching/:lessonId?" element={<Teaching />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/teacher/:teacherId" element={<TeacherProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  const { mode, isFullscreen } = useAppStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (settings.appearance.theme === 'dark' || 
        (settings.appearance.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.appearance.theme]);

  return (
    <div className={`min-h-screen ${isFullscreen ? 'fixed inset-0' : ''} transition-colors duration-200`}>
      <AppRoutes />
    </div>
  );
}
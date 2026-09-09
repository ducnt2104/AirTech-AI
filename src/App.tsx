import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { initDatabase } from '@/database';
import { seedDemoData } from '@/database/seed';
import { faceEngine } from '@/face/FaceEngine';
import { handEngine } from '@/hand/HandEngine';
import { gestureEngine } from '@/gesture/GestureEngine';
import Dashboard from '@/pages/Dashboard';
import Whiteboard from '@/pages/Whiteboard';
import Lesson from '@/pages/Lesson';
import Browser from '@/pages/Browser';
import Presentation from '@/pages/Presentation';
import Settings from '@/pages/Settings';
import TeacherProfile from '@/pages/TeacherProfile';
import Teaching from '@/pages/Teaching';
import FirstRunSetup from '@/pages/FirstRunSetup';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';

function AppRoutes() {
  const { mode, isLoading, currentTeacher, setMode } = useAppStore();
  const { isLoaded: settingsLoaded, loadSettings } = useSettingsStore();
  const { teachers, loadTeachers } = useTeacherStore();

  useEffect(() => {
    async function initialize() {
      try {
        await initDatabase();
        seedDemoData();
        await loadSettings();
        await loadTeachers();
        
        await faceEngine.initialize('/models');
        await handEngine.initialize();
        
        gestureEngine.start();
        
        console.log('AIRTECH AI initialized successfully');
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        useAppStore.getState().setLoading(false);
      }
    }
    
    initialize();
  }, [loadSettings, loadTeachers]);

  if (isLoading || !settingsLoaded) {
    return <LoadingScreen />;
  }

  const needsSetup = teachers.length === 0;

  return (
    <ErrorBoundary>
      <Routes>
        {needsSetup ? (
          <Route path="/*" element={<FirstRunSetup />} />
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
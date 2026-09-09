import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  SquarePen, 
  Globe, 
  User, 
  Settings, 
  Plus, 
  Clock, 
  Sparkles,
  Camera,
  Brain,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LessonRepository, SessionRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DiagnosticsModal } from '@/components/DiagnosticsModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTeacher, setMode, setCurrentLesson, setCurrentBoard, clearSession } = useAppStore();
  const { teachers, loadTeachers } = useTeacherStore();
  const { settings } = useSettingsStore();
  const [recentLessons, setRecentLessons] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    loadRecentData();
    checkCameraAndFace();
  }, [currentTeacher]);

  const loadRecentData = async () => {
    if (!currentTeacher) return;
    
    try {
      const lessons = LessonRepository.getRecent(currentTeacher.id, 5);
      setRecentLessons(lessons);
      
      const session = SessionRepository.getActiveByTeacher(currentTeacher.id);
      if (session) {
        setActiveSession(session);
      }
    } catch (error) {
      console.error('Failed to load recent data:', error);
    }
  };

  const checkCameraAndFace = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      setCameraReady(hasCamera);
      setFaceReady(hasCamera);
    } catch {
      setCameraReady(false);
      setFaceReady(false);
    }
  };

  const handleContinueSession = () => {
    if (activeSession && activeSession.lessonId) {
      navigate(`/teaching/${activeSession.lessonId}`);
    }
  };

  const handleNewWhiteboard = () => {
    clearSession();
    navigate('/whiteboard');
  };

  const handleOpenLesson = (lesson: any) => {
    setCurrentLesson(lesson);
    navigate(`/lesson/${lesson.id}`);
  };

  const handleTeachingMode = (lessonId?: string) => {
    navigate(`/teaching/${lessonId || ''}`);
  };

  if (!currentTeacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md p-8 animate-fade-in">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AIRTECH AI</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Hệ thống dạy học thông minh tương tác không chạm</p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/teacher/new')} 
                variant="primary" 
                size="lg" 
                className="w-full"
              >
                <User className="w-5 h-5" />
                Đăng ký giáo viên mới
              </Button>
              
              <Button 
                onClick={() => navigate('/settings')} 
                variant="outline" 
                className="w-full"
              >
                <Settings className="w-5 h-5" />
                Cài đặt
              </Button>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className={cameraReady ? 'text-green-600' : 'text-red-600'}>
                {cameraReady ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </span>
              <span>Camera</span>
              <span className={faceReady ? 'text-green-600' : 'text-red-600'}>
                {faceReady ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </span>
              <span>Nhận diện khuôn mặt</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AIRTECH AI</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentTeacher.name} ({currentTeacher.code})
                </span>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => setShowDiagnostics(true)} title="Kiểm tra hệ thống (Diagnostics)">
                <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </Button>

              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Cài đặt">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Xin chào, <span className="text-primary-600 dark:text-primary-400">{currentTeacher.name}</span> 👋
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Môn: {currentTeacher.subject} • Sẵn sàng cho buổi dạy học mới
          </p>
        </div>

        {activeSession && (
          <Card className="mb-8 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 animate-slide-up">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Phiên học chưa hoàn tất</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Bạn có phiên dạy học đang mở từ {new Date(activeSession.startedAt).toLocaleTimeString('vi-VN')}
                  </p>
                </div>
              </div>
              <Button onClick={handleContinueSession} variant="primary">
                <ArrowRight className="w-4 h-4" />
                Tiếp tục dạy học
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ActionCard
            icon={<SquarePen className="w-6 h-6" />}
            title="Bảng trắng"
            description="Vẽ tự do, ghi chú, minh họa"
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            onClick={handleNewWhiteboard}
          />
          <ActionCard
            icon={<BookOpen className="w-6 h-6" />}
            title="Bài học của tôi"
            description="Quản lý và mở bài học đã lưu"
            iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            onClick={() => navigate('/lesson/new')}
          />
          <ActionCard
            icon={<Globe className="w-6 h-6" />}
            title="Trình duyệt web"
            description="Mở trang web, vẽ chú thích lên web"
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            onClick={() => navigate('/browser')}
          />
          <ActionCard
            icon={<Brain className="w-6 h-6" />}
            title="Chế độ dạy học"
            description="Tương tác bằng cử chỉ không chạm"
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            onClick={() => handleTeachingMode()}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bài học gần đây</h2>
          {recentLessons.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/lesson/all')}>
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {recentLessons.length === 0 ? (
          <Card className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Chưa có bài học nào</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Tạo bài học đầu tiên của bạn ngay hôm nay</p>
            <Button onClick={() => navigate('/lesson/new')} variant="primary">
              <Plus className="w-4 h-4" />
              Tạo bài học mới
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} onClick={() => handleOpenLesson(lesson)} />
            ))}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thông tin hệ thống</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <StatItem label="Giáo viên" value={teachers.length} icon={<User className="w-5 h-5" />} />
            <StatItem label="Bài học" value={recentLessons.length} icon={<BookOpen className="w-5 h-5" />} />
            <StatItem label="Camera" value={cameraReady ? 'Sẵn sàng' : 'Không có'} icon={<Camera className="w-5 h-5" />} />
            <StatItem label="AI Model" value={faceReady ? 'Đã tải' : 'Chưa tải'} icon={<Brain className="w-5 h-5" />} />
          </div>
        </div>
      </main>

      <DiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />
    </div>
  );
}

function ActionCard({ icon, title, description, iconColor, onClick }: any) {
  return (
    <Card className="card-hover p-6 cursor-pointer flex flex-col" onClick={onClick}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mt-4">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-1">{description}</p>
    </Card>
  );
}

function LessonCard({ lesson, onClick }: any) {
  return (
    <Card className="card-hover p-4 cursor-pointer" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">{lesson.title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{lesson.subject}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Cập nhật: {new Date(lesson.updatedAt).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>
    </Card>
  );
}

function StatItem({ label, value, icon }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {icon}
      </div>
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}
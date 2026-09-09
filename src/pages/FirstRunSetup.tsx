import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Eye, User, Settings, Hand, Palette,
  CheckCircle, Loader2, ArrowRight, ArrowLeft, RefreshCw,
  Minus, Square, Circle, Type,
  Shield, HardDrive, Cpu, Globe,
  Sparkles, BookOpen, ChevronRight, Plus
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LessonRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import type { Teacher } from '@/types';

export default function FirstRunSetup() {
  const navigate = useNavigate();
  const { currentTeacher, setCurrentTeacher, setCurrentLesson, setCurrentBoard, setMode } = useAppStore();
  const { teachers, createTeacher, loadTeachers } = useTeacherStore();
  const { settings, updateSection, loadSettings } = useSettingsStore();
  const [step, setStep] = useState(1);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [showCameraError, setShowCameraError] = useState(false);
  const [teacherData, setTeacherData] = useState({
    name: '',
    code: '',
    subject: '',
  });
  const [faceSampleCount, setFaceSampleCount] = useState(5);
  const [enrollmentCount, setEnrollmentCount] = useState(5);

  useEffect(() => {
    loadSettings();
    loadTeachers();
  }, [loadSettings, loadTeachers]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        setCameraReady(hasCamera);
      })
      .catch(() => setCameraReady(false));
  }, []);

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleStep1 = () => {
    if (!teacherData.name.trim() || !teacherData.code.trim() || !teacherData.subject.trim()) {
      return;
    }
    const now = new Date();
    const teacher: Teacher = {
      id: crypto.randomUUID(),
      name: teacherData.name.trim(),
      code: teacherData.code.trim(),
      subject: teacherData.subject.trim(),
      preferences: {
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
      },
      faceEmbedding: undefined,
      faceImages: [],
      createdAt: now,
      updatedAt: now,
    };

    createTeacher(teacher);
    setCurrentTeacher(teacher);
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!cameraReady) {
      setShowCameraError(true);
      return;
    }
    setStep(3);
  };

  const handleStep3 = () => {
    setFaceReady(true);
    setStep(4);
  };

  const handleStep4 = () => {
    setStep(5);
  };

  const handleStep5 = () => {
    if (!currentTeacher) return;
    const now = new Date();
    const demoLesson: any = {
      id: crypto.randomUUID(),
      teacherId: currentTeacher.id,
      title: 'Hàm số bậc hai',
      subject: 'Toán 10',
      description: 'Bài học về hàm số bậc hai',
      slides: [],
      boards: [{
        id: crypto.randomUUID(),
        lessonId: '',
        page: 1,
        strokes: [],
        annotations: [],
        viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
        createdAt: now,
        updatedAt: now,
      }],
      assets: [],
      createdAt: now,
      updatedAt: now,
    };

    demoLesson.boards[0].lessonId = demoLesson.id;
    LessonRepository.create(demoLesson);
    setCurrentLesson(demoLesson);
    if (demoLesson.boards.length > 0) {
      setCurrentBoard(demoLesson.boards[0]);
    }
    setStep(6);
  };

  const handleFinish = () => {
    navigate('/');
  };

  if (step >= 6) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
        <Card className="w-full max-w-md p-8 text-center animate-fade-in text-white">
          <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Setup Hoàn thành ✓</h1>
          <p className="text-gray-200 mb-6">
            Chào mừng bạn đến với AIRTECH AI!
          </p>
          
          <div className="text-center space-y-4">
            <p className="text-lg">
              <strong>{currentTeacher?.name}</strong> đã được đăng ký thành công.
            </p>
            <p className="text-sm text-gray-300">
              Bạn có thể bắt đầu tạo bài học đầu tiên của bạn ngay hôm nay.
            </p>
          </div>
          
          <Button onClick={handleFinish} variant="primary" size="lg" className="w-full">
            <ArrowRight className="w-5 h-5 mr-2" />
            Bắt đầu dạy học
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              <Sparkles className="w-6 h-6" />
              Chào mừng đến AIRTECH AI
            </h1>
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={step === 1}>
              <Minus className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Hãy theo dõi các bước dưới đây để thiết lập ứng dụng.
          </p>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 1: Thông tin giáo viên</h2>
              
              <Input
                label="Họ và tên *"
                value={teacherData.name}
                onChange={(e) => setTeacherData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Nguyễn Văn A"
              />
              
              <Input
                label="Mã giáo viên *"
                value={teacherData.code}
                onChange={(e) => setTeacherData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Ví dụ: GV001"
              />
              
              <Input
                label="Môn học *"
                value={teacherData.subject}
                onChange={(e) => setTeacherData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Ví dụ: Toán 10"
              />
              
              <Button onClick={handleStep1} variant="primary" className="w-full">
                <Loader2 className="w-4 h-4 mr-2" />
                Tiếp tục
              </Button>
            </div>
          )}

          {step === 2 && cameraReady && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 2: Camera</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Cho phép ứng dụng truy cập camera để nhận diện khuôn mặt.
              </p>
              
              <Button variant="primary" onClick={() => handleStep3()} className="w-full">
                <Eye className="w-5 h-5 mr-2" />
                Bắt đầu kiểm tra camera
              </Button>
              
              {showCameraError && (
                <Card className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Không tìm thấy camera. Vui lòng kiểm tra cài đặt camera của máy tính.
                  </p>
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    Thử lại
                  </Button>
                </Card>
              )}
            </div>
          )}

          {step === 2 && !cameraReady && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 2: Camera</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Đang kiểm tra camera...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nếu không có camera, bạn có thể tiếp tục ở chế độ thủ công.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 3: Nhận diện khuôn mặt</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Hãy đứng trước camera và chụp mẫu khuôn mặt (5 mẫu khuyến nghị).
              </p>
              
              <Input
                label="Số mẫu (1-10)"
                value={String(enrollmentCount)}
                onChange={(e) => setEnrollmentCount(parseInt(e.target.value) || 5)}
                type="number"
                min={1}
                max={10}
              />
              
              <Button variant="primary" onClick={() => { handleStep4(); setFaceReady(true); }} className="w-full mt-3">
                <Loader2 className="w-4 h-4 mr-2" />
                Bắt đầu chụp mẫu
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 4: Cài đặt</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Tùy chỉnh cài đặt ban đầu cho ứng dụng.
              </p>
              
              <Button variant="secondary" onClick={handleStep5} className="w-full">
                <ChevronRight className="w-4 h-4 mr-2" />
                Tiếp tục đến bài học mẫu
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bước 5: Bài học mẫu</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Bài học mẫu đã được tạo sẵn cho bạn.
              </p>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">Bài học:</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Hàm số bậc hai - Toán 10</p>
              </div>
              
              <Button variant="primary" onClick={handleFinish} className="w-full mt-4">
                <CheckCircle className="w-4 h-4 mr-2" />
                Hoàn tất và bắt đầu
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, User, Settings, UserPlus, ScanFace,
  CheckCircle, AlertCircle, Loader2, Sparkles,
  ArrowRight, Eye, EyeOff, Shield, HardDrive,
  Cpu, Globe, BookOpen, Plus, Home,
  Video, VideoOff, WifiOff, RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { faceEngine } from '@/face/FaceEngine';
import { cameraManager, CameraState, CameraError } from '@/camera/CameraManager';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import type { Teacher } from '@/types';

export default function Login() {
  const navigate = useNavigate();
  const { teachers, loadTeachers, createTeacher, getTeacherByFaceEmbedding } = useTeacherStore();
  const { settings, loadSettings } = useSettingsStore();
  const { setCurrentTeacher, setMode } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'faceid' | 'register' | 'settings'>('faceid');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [cameraDevices, setCameraDevices] = useState<Array<{deviceId: string; label: string}>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<{ teacher: Teacher; confidence: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: '',
    code: '',
    subject: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerStep, setRegisterStep] = useState<'form' | 'face'>('form');
  const [faceImages, setFaceImages] = useState<string[]>([]);
  const [faceEmbedding, setFaceEmbedding] = useState<Float32Array | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const faceDetectionUnsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadSettings();
    loadTeachers();
    initializeCamera();
  }, [loadSettings, loadTeachers]);

  useEffect(() => {
    if (activeTab === 'faceid' && cameraState === 'running' && !isScanning) {
      startFaceDetection();
    }
    return () => {
      if (faceDetectionUnsubscribe.current) {
        faceDetectionUnsubscribe.current();
        faceDetectionUnsubscribe.current = null;
      }
    };
  }, [activeTab, cameraState, isScanning]);

  const initializeCamera = async () => {
    setCameraState('detecting');
    setCameraError(null);
    
    try {
      const devices = await cameraManager.detectDevices();
      setCameraDevices(devices);
      
      if (devices.length === 0) {
        const error = new CameraError('Không phát hiện camera nào. Vui lòng kết nối webcam.', 'NO_DEVICES');
        setCameraError(error);
        setCameraState('error');
        return;
      }
      
      // Select saved device or first available
      const savedDeviceId = settings.camera.deviceId;
      const deviceId = savedDeviceId && devices.find(d => d.deviceId === savedDeviceId) 
        ? savedDeviceId 
        : devices[0].deviceId;
      
      setSelectedDeviceId(deviceId);
      
      // Initialize camera
      await cameraManager.initialize(deviceId);
      await cameraManager.start();
      
      setCameraState('running');
      
      // Update video ref
      const video = cameraManager.getVideoElement();
      if (video) {
        setVideoRef(video);
      }
      
    } catch (error) {
      if (error instanceof CameraError) {
        setCameraError(error);
        setCameraState('error');
      } else {
        const camError = new CameraError(
          `Lỗi khởi tạo camera: ${error instanceof Error ? error.message : 'unknown'}`,
          'UNKNOWN',
          error instanceof Error ? error : undefined
        );
        setCameraError(camError);
        setCameraState('error');
      }
    }
  };

  const handleCameraRetry = useCallback(async () => {
    setCameraError(null);
    await initializeCamera();
  }, []);

  const handleDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setCameraError(null);
    setCameraState('idle');
    try {
      await cameraManager.switchCamera(deviceId);
      const video = cameraManager.getVideoElement();
      if (video) setVideoRef(video);
      setCameraState('running');
    } catch (error) {
      if (error instanceof CameraError) {
        setCameraError(error);
        setCameraState('error');
      }
    }
  }, []);

  const startFaceDetection = async () => {
    if (!videoRef) return;
    
    try {
      await faceEngine.start(videoRef);
      
      faceDetectionUnsubscribe.current = faceEngine.onDetection((detections) => {
        if (!isScanning || detections.length === 0) return;
        
        const detection = detections[0];
        if (detection.confidence > 0.7) {
          if (detection.embedding && teachers.length > 0) {
            const matchedTeacher = getTeacherByFaceEmbedding(detection.embedding, 0.6);
            if (matchedTeacher) {
              setIsScanning(false);
              setScanResult({ teacher: matchedTeacher, confidence: detection.confidence });
              handleFaceLogin(matchedTeacher);
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Face detection start error:', error);
    }
  };

  const handleFaceLogin = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    setMode('dashboard');
    navigate('/');
  };

  const handleScanFace = async () => {
    if (!videoRef) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setScanError(null);
    setScanResult(null);
    
    try {
      const result = await faceEngine.enrollFace(videoRef, 5);
      
      if (result) {
        const matchedTeacher = getTeacherByFaceEmbedding(result.embedding, 0.6);
        if (matchedTeacher) {
          setScanResult({ teacher: matchedTeacher, confidence: 0.9 });
          setTimeout(() => handleFaceLogin(matchedTeacher), 1500);
        } else {
          setScanError('Không tìm thấy giáo viên khớp với khuôn mặt này. Vui lòng đăng ký tài khoản mới.');
          setIsScanning(false);
        }
      } else {
        setScanError('Không thể quét khuôn mặt. Vui lòng thử lại với ánh sáng tốt hơn.');
        setIsScanning(false);
      }
    } catch (error) {
      setScanError('Lỗi khi quét khuôn mặt');
      setIsScanning(false);
    }
  };

  const handleRegisterSubmit = async () => {
    if (!registerData.name.trim() || !registerData.code.trim() || !registerData.subject.trim()) {
      return;
    }
    
    setIsRegistering(true);
    try {
      const now = new Date();
      const teacher: Teacher = {
        id: crypto.randomUUID(),
        name: registerData.name.trim(),
        code: registerData.code.trim(),
        subject: registerData.subject.trim(),
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

      const createdTeacher = await createTeacher(teacher);
      setCurrentTeacher(createdTeacher);
      
      if (faceEmbedding && faceImages.length > 0) {
        const { enrollFace: enrollFaceFn } = useTeacherStore.getState();
        await enrollFaceFn(createdTeacher.id, faceImages, faceEmbedding);
      }
      
      setShowRegisterModal(false);
      setMode('dashboard');
      navigate('/');
    } catch (error) {
      console.error('Register error:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFaceEnroll = async () => {
    if (!videoRef) return;
    
    setIsRegistering(true);
    try {
      const result = await faceEngine.enrollFace(videoRef, 8);
      if (result) {
        setFaceImages(result.images);
        setFaceEmbedding(result.embedding);
        setRegisterStep('form');
      } else {
        setScanError('Không thể đăng ký khuôn mặt. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Face enroll error:', error);
      setScanError('Lỗi khi đăng ký khuôn mặt');
    } finally {
      setIsRegistering(false);
    }
  };

  const openRegisterModal = () => {
    setRegisterStep('form');
    setRegisterData({ name: '', code: '', subject: '' });
    setFaceImages([]);
    setFaceEmbedding(null);
    setShowRegisterModal(true);
  };

  const getCameraStatusText = (state: CameraState): string => {
    switch (state) {
      case 'idle': return 'Sẵn sàng khởi động';
      case 'detecting': return 'Đang tìm kiếm camera...';
      case 'initializing': return 'Đang khởi tạo camera...';
      case 'testing': return 'Đang kiểm tra hình ảnh...';
      case 'ready': return 'Camera sẵn sàng';
      case 'running': return 'Đang hoạt động';
      case 'reconnecting': return 'Đang kết nối lại...';
      case 'error': return 'Lỗi camera';
      case 'stopped': return 'Đã dừng';
      default: return 'Không xác định';
    }
  };

  const getCameraStatusIcon = (state: CameraState) => {
    switch (state) {
      case 'running':
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'initializing':
      case 'testing':
      case 'detecting':
      case 'reconnecting':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      default:
        return <Video className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AIRTECH AI</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Hệ thống dạy học thông minh tương tác không chạm</p>
        </div>

        {/* Camera Status Bar */}
        <div className="mb-6 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                {getCameraStatusIcon(cameraState)}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Camera: {getCameraStatusText(cameraState)}</p>
                {cameraError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{cameraError.message}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cameraDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  disabled={cameraState === 'initializing' || cameraState === 'testing'}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {cameraDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
              {cameraError && cameraError.recoverable && (
                <Button variant="outline" size="sm" onClick={handleCameraRetry}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Thử lại
                </Button>
              )}
              {cameraState === 'error' && !cameraError?.recoverable && (
                <Button variant="outline" size="sm" onClick={() => setShowDiagnostics(true)}>
                  <WifiOff className="w-4 h-4 mr-1" />
                  Chẩn đoán
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-2 shadow-xl border border-gray-200/50 dark:border-gray-700/50 mb-6">
          <div className="flex gap-2" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'faceid'}
              onClick={() => setActiveTab('faceid')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                activeTab === 'faceid' 
                  ? 'bg-primary-600 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <ScanFace className="w-5 h-5" />
              Đăng nhập Face ID
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'register'}
              onClick={openRegisterModal}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                activeTab === 'register' 
                  ? 'bg-primary-600 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <UserPlus className="w-5 h-5" />
              Đăng ký mới
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => navigate('/settings')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                activeTab === 'settings' 
                  ? 'bg-primary-600 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Settings className="w-5 h-5" />
              Cài đặt
            </button>
          </div>
        </div>

        {/* Face ID Login Tab */}
        {activeTab === 'faceid' && (
          <Card className="overflow-hidden shadow-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="relative aspect-video bg-black">
              <video
                ref={setVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              
              {cameraState === 'idle' || cameraState === 'detecting' || cameraState === 'initializing' || cameraState === 'testing' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 flex-col gap-4">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                  <p className="text-lg text-white">{getCameraStatusText(cameraState)}</p>
                  <p className="text-sm text-white/70">Vui lòng đợi...</p>
                </div>
              ) : cameraState === 'error' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 flex-col gap-4 p-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-lg text-white text-center max-w-md">{cameraError?.message || 'Lỗi camera không xác định'}</p>
                  <div className="flex gap-3">
                    {cameraError?.recoverable && (
                      <Button variant="primary" onClick={handleCameraRetry}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Thử lại
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setShowDiagnostics(true)}>
                      <WifiOff className="w-4 h-4 mr-2" />
                      Chẩn đoán chi tiết
                    </Button>
                  </div>
                </div>
              ) : null}
              
              {/* Scan Progress Overlay */}
              {isScanning && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                  <div className="relative mb-6">
                    <div className="w-32 h-32 rounded-full border-4 border-primary-500/30" />
                    <div className={`absolute inset-0 w-32 h-32 rounded-full border-4 border-primary-500 border-t-transparent animate-spin`} 
                         style={{ transform: `rotate(${scanProgress * 3.6}deg)` }} />
                    <div className="absolute inset-4 flex items-center justify-center">
                      <ScanFace className="w-16 h-16 text-primary-400" />
                    </div>
                  </div>
                  <p className="text-lg font-medium">Đang quét khuôn mặt... {scanProgress}%</p>
                  <p className="text-sm opacity-75 mt-1">Hãy nhìn thẳng vào camera</p>
                </div>
              )}

              {/* Scan Result */}
              {scanResult && (
                <div className="absolute inset-0 bg-green-600/90 flex flex-col items-center justify-center text-white animate-fade-in">
                  <CheckCircle className="w-20 h-20 mb-4" />
                  <p className="text-2xl font-bold">Xin chào, {scanResult.teacher.name}!</p>
                  <p className="text-lg opacity-90">{scanResult.teacher.subject} • {scanResult.teacher.code}</p>
                  <p className="text-sm opacity-75 mt-2">Độ tin cậy: {(scanResult.confidence * 100).toFixed(0)}%</p>
                </div>
              )}

              {/* Scan Error */}
              {scanError && (
                <div className="absolute bottom-4 left-4 right-4">
                  <Card className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">{scanError}</p>
                    </div>
                  </Card>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-4">
                <Button 
                  variant="primary" 
                  size="lg" 
                  onClick={handleScanFace} 
                  disabled={isScanning || cameraState !== 'running'}
                  className="w-48"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang quét...
                    </>
                  ) : (
                    <>
                      <ScanFace className="w-5 h-5" />
                      Quét Face ID
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Features Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <FeatureCard icon={<Shield className="w-6 h-6" />} title="Offline-First" desc="Hoàn toàn hoạt động offline, dữ liệu lưu local" />
          <FeatureCard icon={<Cpu className="w-6 h-6" />} title="AI Local" desc="Nhận diện khuôn mặt & cử chỉ chạy trên thiết bị" />
          <FeatureCard icon={<BookOpen className="w-6 h-6" />} title="Dạy học thông minh" desc="Bảng trắng, trình chiếu, trình duyệt tích hợp" />
        </div>

        {/* Register Modal */}
        <Modal 
          isOpen={showRegisterModal} 
          onClose={() => setShowRegisterModal(false)}
          title="Đăng ký tài khoản giáo viên"
          size="lg"
        >
          {registerStep === 'form' ? (
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Điền thông tin và đăng ký khuôn mặt để sử dụng Face ID
              </p>
              
              <Input
                label="Họ và tên *"
                value={registerData.name}
                onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Nguyễn Văn A"
                disabled={isRegistering}
              />
              
              <Input
                label="Mã giáo viên *"
                value={registerData.code}
                onChange={(e) => setRegisterData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Ví dụ: GV001"
                disabled={isRegistering}
              />
              
              <Input
                label="Môn học *"
                value={registerData.subject}
                onChange={(e) => setRegisterData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Ví dụ: Toán 10"
                disabled={isRegistering}
              />
              
              <Button 
                variant="primary" 
                className="w-full" 
                onClick={() => setRegisterStep('face')}
                disabled={isRegistering}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Tiếp tục: Đăng ký Face ID
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={setVideoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                
                {cameraState !== 'running' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 flex-col gap-3">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <p className="text-white">Đang khởi tạo camera...</p>
                    <p className="text-sm text-white/70">{getCameraStatusText(cameraState)}</p>
                  </div>
                )}
                
                {isRegistering && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-400 mb-4" />
                    <p className="text-lg">Đang đăng ký khuôn mặt...</p>
                    <p className="text-sm opacity-75">Hãy quay đầu nhẹ theo các hướng</p>
                  </div>
                )}
              </div>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                Hãy nhìn vào camera và quay đầu nhẹ để đăng ký khuôn mặt (8 mẫu)
              </p>
              
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => setRegisterStep('form')}
                  disabled={isRegistering}
                >
                  <ArrowRight className="w-4 h-4 mr-1 rotate-180" />
                  Quay lại
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1" 
                  onClick={handleFaceEnroll}
                  disabled={isRegistering || cameraState !== 'running'}
                  loading={isRegistering}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Bắt đầu quét
                </Button>
              </div>
              
              {faceEmbedding && (
                <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Đã đăng ký khuôn mặt thành công ({faceImages.length} mẫu)</span>
                  </div>
                </Card>
              )}
              
              <Button 
                variant="primary" 
                className="w-full" 
                onClick={handleRegisterSubmit}
                disabled={isRegistering || !faceEmbedding}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Hoàn tất đăng ký
                  </>
                )}
              </Button>
            </div>
          )}
        </Modal>

        {/* Diagnostics Modal */}
        <Modal 
          isOpen={showDiagnostics} 
          onClose={() => setShowDiagnostics(false)}
          title="Chẩn đoán Camera"
          size="lg"
        >
          <div className="space-y-4 font-mono text-sm">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="font-medium mb-2">Camera Diagnostics</p>
              <pre className="whitespace-pre-wrap">{cameraManager.exportDiagnostics()}</pre>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(cameraManager.exportDiagnostics())}>
                Sao chép log
              </Button>
              <Button variant="primary" onClick={handleCameraRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử khởi động lại
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-4 text-center hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 mx-auto rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
    </Card>
  );
}
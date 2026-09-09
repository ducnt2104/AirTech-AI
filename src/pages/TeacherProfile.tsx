import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, User, BookOpen,
  CheckCircle, Settings, Trash2, Loader2,
  Plus, X
} from 'lucide-react';
import { useTeacherStore } from '@/stores/teacherStore';
import { LessonRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTeacherWorkspace } from '@/stores/teacherWorkspaceStore';

export default function TeacherProfilePage() {
  const navigate = useNavigate();
  const { teacherId } = useParams<{ teacherId: string }>();
  const { currentTeacher, setCurrentTeacher, teachers, deleteTeacher } = useTeacherStore();
  const { togglePrivacyMode } = useTeacherWorkspace();

  useEffect(() => {
    if (teacherId && currentTeacher?.id !== teacherId) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) setCurrentTeacher(teacher);
    }
  }, [teacherId, currentTeacher?.id, teachers, setCurrentTeacher]);

  const teacher = currentTeacher;
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [enrollmentCount, setEnrollmentCount] = useState<number>(5);

  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center animate-fade-in">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Giáo viên không tìm thấy</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Giáo viên không tồn tại hoặc chưa được chọn.</p>
          <Button onClick={() => navigate('/')} variant="primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay về Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Load lessons for this teacher
  useEffect(() => {
    if (teacher) {
      LessonRepository.getByTeacher(teacher.id);
    }
  }, [teacher]);

  const handleFaceEnrollment = () => {
    console.log(`Starting face enrollment with ${enrollmentCount} samples for ${teacher.name}`);
    setShowFaceEnrollment(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
              {teacher.name.charAt(0)}
            </span>
            {teacher.name}
          </h1>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto" role="navigation" aria-label="Teacher profile sections">
          <ul className="space-y-1" role="list">
            <li>
              <Button variant="ghost" size="full" onClick={() => navigate(`/teacher/${teacher.id}/workspace`)}>
                <Eye className="w-5 h-5 mr-3" />
                <span>Workspace</span>
              </Button>
            </li>
            <li>
              <Button variant="ghost" size="full" onClick={() => navigate(`/teacher/${teacher.id}/lessons`)}>
                <BookOpen className="w-5 h-5 mr-3" />
                <span>Bài học</span>
              </Button>
            </li>
            <li>
              <Button variant="ghost" size="full" onClick={() => navigate(`/teacher/${teacher.id}/settings`)}>
                <Settings className="w-5 h-5 mr-3" />
                <span>Cài đặt</span>
              </Button>
            </li>
          </ul>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setShowFaceEnrollment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Đăng ký khuôn mặt mới
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setShowDeleteConfirmation(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Xóa giáo viên
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 animate-fade-in flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Hồ sơ giáo viên
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Giáo viên: {teacher.name} ({teacher.code})
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Về Dashboard
            </Button>
          </div>

          <Card className="p-6" variant="outlined">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Môn dạy</p>
                <p className="font-medium text-gray-900 dark:text-white">{teacher.subject || 'Chưa xác định'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ngày tạo</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('vi-VN') : 'Chưa có'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Thông tin nhận diện</h3>
              
              {teacher.faceEmbedding ? (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Đã đăng ký nhận diện khuôn mặt ({teacher.faceImages?.length || 1} mẫu)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <span className="text-sm text-yellow-800 dark:text-yellow-300">
                    Chưa đăng ký khuôn mặt. Bấm &ldquo;Đăng ký khuôn mặt mới&rdquo; để kích hoạt nhận diện AI tự động.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                {teacher.preferences && (
                  <>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ngôn ngữ</p>
                      <p className="font-medium">{teacher.preferences.language === 'vi' ? 'Tiếng Việt' : 'English'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Chế độ hiệu năng</p>
                      <p className="font-medium">{teacher.preferences.performanceMode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Độ phân giải camera</p>
                      <p className="font-medium">{teacher.preferences.cameraResolution.width}x{teacher.preferences.cameraResolution.height}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Chế độ riêng tư</p>
                      <p className="font-medium">{teacher.preferences.privacyMode ? 'Đang bật' : 'Tắt'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {showFaceEnrollment && (
            <Modal isOpen={showFaceEnrollment} onClose={() => setShowFaceEnrollment(false)} title="Đăng ký nhận diện khuôn mặt">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Đặt camera trước mặt và chụp mẫu khuôn mặt cho giáo viên {teacher.name}.
                </p>
                
                <div className="space-y-3">
                  <Input
                    label="Số lượng mẫu khuôn mặt (1-10)"
                    value={String(enrollmentCount)}
                    onChange={(e) => setEnrollmentCount(parseInt(e.target.value) || 5)}
                    type="number"
                    min={1}
                    max={10}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setShowFaceEnrollment(false)}>
                      Hủy
                    </Button>
                    <Button variant="primary" onClick={handleFaceEnrollment}>
                      <Loader2 className="w-4 h-4 mr-2" />
                      Bắt đầu chụp & Huấn luyện
                    </Button>
                  </div>
                </div>
              </div>
            </Modal>
          )}

          {showDeleteConfirmation && (
            <Modal isOpen={showDeleteConfirmation} onClose={() => setShowDeleteConfirmation(false)} title="Xóa giáo viên">
              <div className="space-y-4 text-red-600">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Bạn có chắc chắn muốn xóa giáo viên {teacher.name} ({teacher.code}) không? Hành động này sẽ xóa dữ liệu hồ sơ.
                </p>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowDeleteConfirmation(false)}>
                    Hủy
                  </Button>
                  <Button variant="danger" onClick={() => {
                    deleteTeacher(teacher.id);
                    setShowDeleteConfirmation(false);
                    navigate('/');
                  }}>
                    <X className="w-4 h-4 mr-2" />
                    Xóa vĩnh viễn
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </main>
    </div>
  );
}

export function useTeacherActions() {
  const { togglePrivacyMode } = useTeacherWorkspace();
  return {
    togglePrivacyMode
  };
}
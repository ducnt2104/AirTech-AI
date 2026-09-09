import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Search, Filter, MoreVertical,
  Edit, Trash2, Copy, FileText, Clock, BookOpen,
  ChevronRight, Grid, List
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { LessonRepository, TeacherRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import type { Lesson } from '@/types';

export default function LessonPage() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { currentTeacher, setCurrentLesson, setCurrentBoard, clearSession } = useAppStore();
  const { teachers } = useTeacherStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLessonData, setNewLessonData] = useState({ title: '', subject: '', description: '' });

  useEffect(() => {
    if (currentTeacher) {
      loadLessons();
    }
  }, [currentTeacher]);

  useEffect(() => {
    if (lessonId && lessonId !== 'new') {
      const lesson = LessonRepository.getById(lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        if (lesson.boards.length > 0) {
          setCurrentBoard(lesson.boards[0]);
        }
        navigate('/whiteboard');
      }
    }
  }, [lessonId, currentTeacher, navigate, setCurrentLesson, setCurrentBoard]);

  const loadLessons = () => {
    if (!currentTeacher) return;
    const data = LessonRepository.getByTeacher(currentTeacher.id);
    setLessons(data);
  };

  const filteredLessons = lessons
    .filter(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(l => !filterSubject || l.subject === filterSubject);

  const subjects = [...new Set(lessons.map(l => l.subject))];

  const handleCreateLesson = () => {
    if (!currentTeacher || !newLessonData.title.trim()) return;
    
    const now = new Date();
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      teacherId: currentTeacher.id,
      title: newLessonData.title.trim(),
      subject: newLessonData.subject || currentTeacher.subject,
      description: newLessonData.description.trim(),
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
    
    lesson.boards[0].lessonId = lesson.id;
    LessonRepository.create(lesson);
    
    setLessons(prev => [lesson, ...prev]);
    setShowCreateModal(false);
    setNewLessonData({ title: '', subject: '', description: '' });
    
    navigate(`/lesson/${lesson.id}`);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setNewLessonData({ title: lesson.title, subject: lesson.subject, description: lesson.description || '' });
    setShowCreateModal(true);
  };

  const handleUpdateLesson = () => {
    if (!selectedLesson || !newLessonData.title.trim()) return;
    
    const updated: Lesson = {
      ...selectedLesson,
      title: newLessonData.title.trim(),
      subject: newLessonData.subject || currentTeacher?.subject || '',
      description: newLessonData.description.trim(),
      updatedAt: new Date(),
    };
    
    LessonRepository.update(updated);
    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? updated : l));
    setShowCreateModal(false);
    setSelectedLesson(null);
    setNewLessonData({ title: '', subject: '', description: '' });
  };

  const handleDeleteLesson = (id: string) => {
    if (!confirm('Xóa bài học này? Hành động không thể hoàn tác.')) return;
    LessonRepository.delete(id);
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  const handleDuplicateLesson = (lesson: Lesson) => {
    if (!currentTeacher) return;
    
    const now = new Date();
    const duplicated: Lesson = {
      ...lesson,
      id: crypto.randomUUID(),
      title: `${lesson.title} (Bản sao)`,
      createdAt: now,
      updatedAt: now,
      boards: lesson.boards.map(b => ({
        ...b,
        id: crypto.randomUUID(),
        lessonId: '',
        createdAt: now,
        updatedAt: now,
      })),
    };
    
    duplicated.boards.forEach(b => b.lessonId = duplicated.id);
    LessonRepository.create(duplicated);
    setLessons(prev => [duplicated, ...prev]);
  };

  const handleOpenWhiteboard = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    if (lesson.boards.length > 0) {
      setCurrentBoard(lesson.boards[0]);
    }
    navigate('/whiteboard');
  };

  const handleTeachingMode = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    if (lesson.boards.length > 0) {
      setCurrentBoard(lesson.boards[0]);
    }
    navigate('/teaching');
  };

  if (!currentTeacher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Chưa đăng nhập</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Vui lòng đăng nhập hoặc đăng ký giáo viên</p>
          <Button onClick={() => navigate('/teacher/new')} variant="primary">
            Đăng ký giáo viên
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-gray-900 dark:text-white">Bài học của tôi</h1>
        </div>
        <Button onClick={() => { setSelectedLesson(null); setNewLessonData({ title: '', subject: currentTeacher.subject, description: '' }); setShowCreateModal(true); }} variant="primary">
          <Plus className="w-4 h-4" />
          Tạo bài học mới
        </Button>
      </header>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Tìm kiếm bài học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="input py-1.5 text-sm"
              >
                <option value="">Tất cả môn học</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
<div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
               </div>
            </div>
          </div>

          {filteredLessons.length === 0 ? (
            <Card className="py-16 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery || filterSubject ? 'Không tìm thấy bài học' : 'Chưa có bài học nào'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery || filterSubject 
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'
                  : 'Tạo bài học đầu tiên của bạn ngay hôm nay'}
              </p>
              <Button onClick={() => { setNewLessonData({ title: '', subject: currentTeacher.subject, description: '' }); setShowCreateModal(true); }} variant="primary">
                <Plus className="w-4 h-4" />
                {searchQuery || filterSubject ? 'Tạo bài học mới' : 'Bắt đầu tạo bài học'}
              </Button>
            </Card>
          ) : (
            viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredLessons.map(lesson => (
                  <LessonCardGrid 
                    key={lesson.id} 
                    lesson={lesson} 
                    onOpen={() => handleOpenWhiteboard(lesson)}
                    onTeach={() => handleTeachingMode(lesson)}
                    onEdit={() => handleEditLesson(lesson)}
                    onDuplicate={() => handleDuplicateLesson(lesson)}
                    onDelete={() => handleDeleteLesson(lesson.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLessons.map(lesson => (
                  <LessonCardList
                    key={lesson.id}
                    lesson={lesson}
                    onOpen={() => handleOpenWhiteboard(lesson)}
                    onTeach={() => handleTeachingMode(lesson)}
                    onEdit={() => handleEditLesson(lesson)}
                    onDuplicate={() => handleDuplicateLesson(lesson)}
                    onDelete={() => handleDeleteLesson(lesson.id)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {showCreateModal && (
        <Modal onClose={() => { setShowCreateModal(false); setSelectedLesson(null); }}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{selectedLesson ? 'Chỉnh sửa bài học' : 'Tạo bài học mới'}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề *</label>
              <Input
                value={newLessonData.title}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nhập tiêu đề bài học"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Môn học</label>
              <Input
                value={newLessonData.subject}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Nhập môn học"
                list="subjects"
              />
              <datalist id="subjects">
                {subjects.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mô tả</label>
              <textarea
                value={newLessonData.description}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="input resize-none"
                placeholder="Mô tả ngắn gọn về bài học (tùy chọn)"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => { setShowCreateModal(false); setSelectedLesson(null); }}>
                Hủy
              </Button>
              <Button variant="primary" onClick={selectedLesson ? handleUpdateLesson : handleCreateLesson}>
                {selectedLesson ? 'Cập nhật' : 'Tạo bài học'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LessonCardGrid({ lesson, onOpen, onTeach, onEdit, onDuplicate, onDelete }: any) {
  return (
    <Card className="card-hover relative overflow-hidden" onClick={onOpen}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu items={[
          { label: 'Sửa', icon: Edit, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onEdit(); }},
          { label: 'Nhân bản', icon: Copy, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onDuplicate(); }},
          { label: 'Xóa', icon: Trash2, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }, danger: true },
        ]} />
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {lesson.subject}
          </span>
        </div>
        
        <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">{lesson.title}</h3>
        
        {lesson.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{lesson.description}</p>
        )}
        
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(lesson.updatedAt).toLocaleDateString('vi-VN')}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {lesson.boards.length} trang
          </span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          Mở bảng trắng
        </Button>
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onTeach(); }}>
          <BookOpen className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

function LessonCardList({ lesson, onOpen, onTeach, onEdit, onDuplicate, onDelete }: any) {
  return (
    <Card className="card-hover p-3 flex items-center gap-4" onClick={onOpen}>
      <FileText className="w-10 h-10 text-primary-600 dark:text-primary-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">{lesson.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {lesson.subject}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{lesson.description || 'Không có mô tả'}</p>
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>{new Date(lesson.updatedAt).toLocaleDateString('vi-VN')}</span>
          <span>{lesson.boards.length} trang</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); onTeach(); }} title="Chế độ dạy học">
          <BookOpen className="w-4 h-4" />
        </Button>
        <DropdownMenu items={[
          { label: 'Sửa', icon: Edit, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onEdit(); }},
          { label: 'Nhân bản', icon: Copy, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onDuplicate(); }},
          { label: 'Xóa', icon: Trash2, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }, danger: true },
        ]} />
      </div>
    </Card>
  );
}

function DropdownMenu({ items }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <MoreVertical className="w-5 h-5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 animate-scale-in">
          {items.map((item: any, i: number) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); item.onClick(e); setOpen(false); }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                item.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }: any) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <Card className="relative w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </Card>
    </div>
  );
}
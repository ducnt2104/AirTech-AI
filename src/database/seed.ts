import { TeacherRepository, LessonRepository, BoardRepository } from './index';
import type { Teacher, Lesson, Board } from '@/types';

export function seedDemoData(): void {
  try {
    const existingTeachers = TeacherRepository.getAll();
    if (existingTeachers.length > 0) {
      return; // Already initialized
    }

    console.log('Seeding initial demo data for AIRTECH AI...');
    const now = new Date();

    // 1. Create Demo Teacher
    const demoTeacher: Teacher = {
      id: 'teacher-demo-001',
      name: 'Thầy Nguyễn Văn An',
      code: 'GV001',
      subject: 'Toán học & Vật lý',
      faceImages: [],
      preferences: {
        cameraId: '',
        cameraResolution: { width: 1280, height: 720 },
        gestureSensitivity: 0.75,
        faceRecognitionThreshold: 0.6,
        drawingSmoothing: 0.3,
        theme: 'system',
        language: 'vi',
        performanceMode: 'balanced',
        privacyMode: false,
        autoSaveInterval: 15000,
        showCursor: true,
        cursorSize: 14,
      },
      createdAt: now,
      updatedAt: now,
    };
    TeacherRepository.create(demoTeacher);

    // 2. Create Demo Lesson 1: Hàm số bậc hai
    const lesson1Id = 'lesson-math-001';
    const board1Id = 'board-math-001';

    const board1: Board = {
      id: board1Id,
      lessonId: lesson1Id,
      page: 1,
      strokes: [
        // Parabola curve simulation
        {
          id: 'stroke-1',
          tool: 'pen',
          color: '#2563eb',
          width: 4,
          timestamp: now.getTime(),
          points: [
            { x: 200, y: 400, timestamp: now.getTime() },
            { x: 300, y: 250, timestamp: now.getTime() },
            { x: 400, y: 200, timestamp: now.getTime() },
            { x: 500, y: 250, timestamp: now.getTime() },
            { x: 600, y: 400, timestamp: now.getTime() },
          ],
        },
        // Axis lines
        {
          id: 'stroke-2',
          tool: 'pen',
          color: '#64748b',
          width: 2,
          timestamp: now.getTime(),
          points: [
            { x: 150, y: 350, timestamp: now.getTime() },
            { x: 650, y: 350, timestamp: now.getTime() },
          ],
        },
      ],
      annotations: [
        {
          id: 'anno-1',
          type: 'text',
          position: { x: 250, y: 150 },
          size: { width: 300, height: 40 },
          content: 'Hàm số: y = ax² + bx + c (a > 0)',
          style: { color: '#1e293b', fontSize: 22 },
          timestamp: now.getTime(),
        },
      ],
      viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
      createdAt: now,
      updatedAt: now,
    };

    const demoLesson1: Lesson = {
      id: lesson1Id,
      teacherId: demoTeacher.id,
      title: 'Hàm số bậc hai và Đồ thị Parabol',
      subject: 'Toán 10',
      description: 'Khảo sát sự biến thiên và vẽ đồ thị hàm số y = ax² + bx + c',
      slides: [
        {
          id: 'slide-1',
          lessonId: lesson1Id,
          page: 1,
          title: 'Đồ thị Parabol',
          content: { type: 'whiteboard', data: {} },
          createdAt: now,
          updatedAt: now,
        },
      ],
      boards: [board1],
      assets: [],
      createdAt: now,
      updatedAt: now,
    };

    BoardRepository.create(board1);
    LessonRepository.create(demoLesson1);

    // 3. Create Demo Lesson 2: Định luật II Newton
    const lesson2Id = 'lesson-physics-001';
    const board2Id = 'board-physics-001';

    const board2: Board = {
      id: board2Id,
      lessonId: lesson2Id,
      page: 1,
      strokes: [
        {
          id: 'stroke-p1',
          tool: 'pen',
          color: '#dc2626',
          width: 3,
          timestamp: now.getTime(),
          points: [
            { x: 300, y: 300, timestamp: now.getTime() },
            { x: 550, y: 300, timestamp: now.getTime() },
          ],
        },
      ],
      annotations: [
        {
          id: 'anno-p1',
          type: 'text',
          position: { x: 280, y: 220 },
          size: { width: 250, height: 40 },
          content: 'Vectơ lực: F = m · a',
          style: { color: '#dc2626', fontSize: 24 },
          timestamp: now.getTime(),
        },
      ],
      viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
      createdAt: now,
      updatedAt: now,
    };

    const demoLesson2: Lesson = {
      id: lesson2Id,
      teacherId: demoTeacher.id,
      title: 'Định luật II Newton - Lực và Gia tốc',
      subject: 'Vật lý 10',
      description: 'Mối liên hệ giữa lực tác dụng, khối lượng và gia tốc chuyển động',
      slides: [],
      boards: [board2],
      assets: [],
      createdAt: now,
      updatedAt: now,
    };

    BoardRepository.create(board2);
    LessonRepository.create(demoLesson2);

    console.log('Sample data seeded successfully.');
  } catch (err) {
    console.warn('Could not seed initial demo data:', err);
  }
}

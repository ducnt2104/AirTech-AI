import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PenTool, Highlighter, Eraser, MousePointer, ArrowUpRight,
  Minus, Square, Circle, Type, Undo2, Redo2,
  Trash2, Download, Save, RotateCcw, RotateCw,
  ZoomIn, ZoomOut, Maximize, Minimize, Settings,
  Layers, Palette, MoreHorizontal, ArrowLeft, ArrowRight
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { drawingEngine } from '@/drawing/DrawingEngine';
import { BoardRepository, LessonRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTeacherWorkspace } from '@/stores/teacherWorkspaceStore';
import { cn } from '@/utils/cn';
import type { DrawingTool, Viewport } from '@/types';

export default function Whiteboard() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { mode, currentLesson, currentBoard, sessionState, setCurrentBoard, updateSessionState } = useAppStore();
  const { settings } = useSettingsStore();
  const { openDiagnostics, togglePrivacyMode } = useTeacherWorkspace();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!currentLesson || !currentBoard) {
      if (currentLesson && currentLesson.boards && currentLesson.boards.length > 0) {
        setCurrentBoard(currentLesson.boards[0]);
      } else {
        const now = new Date();
        const newBoard = {
          id: crypto.randomUUID(),
          lessonId: currentLesson?.id || '',
          page: 1,
          strokes: [],
          annotations: [],
          viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
          createdAt: now,
          updatedAt: now,
        };
        BoardRepository.create(newBoard);
        setCurrentBoard(newBoard);
      }
    }

    if (currentBoard) {
      drawingEngine.setTool(sessionState.currentTool);
      drawingEngine.setColor(sessionState.currentColor);
      drawingEngine.setWidth(sessionState.currentWidth);
      drawingEngine.setViewport(sessionState.viewport);
      drawingEngine.loadStrokes(currentBoard.strokes);

      const unsubscribe = drawingEngine.onChange(() => {
        if (currentBoard) {
          BoardRepository.update({
            ...currentBoard,
            strokes: drawingEngine.getStrokes(),
            viewport: drawingEngine.getState().viewport,
            updatedAt: new Date(),
          });
        }
      });

      const unsubscribeStore = useAppStore.subscribe(
        (state) => {
          const newState = state.sessionState;
          drawingEngine.setTool(newState.currentTool);
          drawingEngine.setColor(newState.currentColor);
          drawingEngine.setWidth(newState.currentWidth);
          drawingEngine.setViewport(newState.viewport);
        }
      );

      startRenderLoop();

      return () => {
        unsubscribe();
        unsubscribeStore();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [currentLesson, currentBoard, sessionState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (sessionState.isPresenting) {
        if (e.key === 'ArrowRight') nextSlide();
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'Escape') togglePresenting();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': updateSessionState({ currentTool: 'pointer' }); break;
        case 'p': updateSessionState({ currentTool: 'pen' }); break;
        case 'h': updateSessionState({ currentTool: 'highlighter' }); break;
        case 'e': updateSessionState({ currentTool: 'eraser' }); break;
        case 'z': if (e.ctrlKey || e.metaKey) (e.shiftKey ? drawingEngine.redo() : drawingEngine.undo()); break;
        case 'y': drawingEngine.redo(); break;
        case '=': case '+': zoom(1.2); break;
        case '-': zoom(0.8); break;
        case '0': resetViewport(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateSessionState]);

  useEffect(() => {
    const autosaveInterval = setInterval(() => {
      if (currentBoard) {
        BoardRepository.update({
          ...currentBoard,
          strokes: drawingEngine.getStrokes(),
          viewport: drawingEngine.getState().viewport,
          updatedAt: new Date(),
        });
      }
    }, 30000);

    return () => clearInterval(autosaveInterval);
  }, [currentBoard]);

  const startRenderLoop = () => {
    const render = () => {
      drawCanvas();
      animationRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr);
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    ctx.rotate(viewport.rotation);

    const strokes = drawingEngine.getStrokes();
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, false);
    }

    const currentStroke = drawingEngine.getCurrentStroke();
    if (currentStroke) {
      drawStroke(ctx, currentStroke, false);
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: any, presenting: boolean) => {
    const points = stroke.points;
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = presenting ? stroke.width * 1.5 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen');

  const handlePointerDown = (e: React.PointerEvent) => {
    if (sessionState.isPresenting) {
      if (e.button === 0) {
        const next = (sessionState.currentSlide || 0) + 1;
        useAppStore.getState().setAppMode('presentation');
        useAppStore.getState().setCurrentSlide(next);
        const board = currentLesson?.boards[next] || currentLesson?.boards[0] || null;
        if (board) setCurrentBoard(board);
      }
      return;
    }

    const tool = sessionState.currentTool;
    if (tool === 'pointer') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'eraser') {
      const point = getCanvasPoint(e.clientX, e.clientY);
      drawingEngine.startStroke(point);
      return;
    }

    const point = getCanvasPoint(e.clientX, e.clientY);
    drawingEngine.startStroke(point);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (sessionState.isPresenting) return;

    if (isPanning) {
      const newViewport = { ...viewport, x: e.clientX - panStart.x, y: e.clientY - panStart.y };
      setViewport(newViewport);
      updateSessionState({ viewport: newViewport });
      drawingEngine.setViewport(newViewport);
      return;
    }

    if (drawingEngine.getState().currentStroke || sessionState.currentTool === 'eraser') {
      const point = getCanvasPoint(e.clientX, e.clientY);
      drawingEngine.addPoint(point);
    }
  };

  const handlePointerUp = () => {
    if (sessionState.isPresenting) return;
    if (isPanning) { setIsPanning(false); return; }
    drawingEngine.endStroke();
  };

  const handlePointerLeave = () => {
    if (sessionState.isPresenting) return;
    if (isPanning) setIsPanning(false);
    drawingEngine.cancelStroke();
  };

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0, timestamp: Date.now() };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
      timestamp: Date.now(),
    };
  };

  const zoom = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newScale = Math.min(5, Math.max(0.1, viewport.scale * factor));
    const scaleRatio = newScale / viewport.scale;
    const newViewport: Viewport = {
      ...viewport,
      scale: newScale,
      x: centerX - (centerX - viewport.x) * scaleRatio,
      y: centerY - (centerY - viewport.y) * scaleRatio,
    };
    setViewport(newViewport);
    updateSessionState({ viewport: newViewport });
    drawingEngine.setViewport(newViewport);
  };

  const resetViewport = () => {
    const newViewport: Viewport = { x: 0, y: 0, scale: 1, rotation: 0 };
    setViewport(newViewport);
    updateSessionState({ viewport: newViewport });
    drawingEngine.setViewport(newViewport);
  };

  const togglePresenting = () => {
    useAppStore.getState().setAppMode('presentation');
  };

  const nextSlide = () => {
    if (!currentLesson) return;
    const next = Math.min((sessionState.currentSlide || 0) + 1, currentLesson.boards.length - 1);
    if (next !== (sessionState.currentSlide || 0)) {
      useAppStore.getState().setCurrentSlide(next);
      setCurrentBoard(currentLesson.boards[next]);
    }
  };

  const prevSlide = () => {
    if (!currentLesson) return;
    const prev = Math.max((sessionState.currentSlide || 0) - 1, 0);
    if (prev !== (sessionState.currentSlide || 0)) {
      useAppStore.getState().setCurrentSlide(prev);
      setCurrentBoard(currentLesson.boards[prev]);
    }
  };

  const handleSave = () => {
    if (!currentBoard) return;
    BoardRepository.update({
      ...currentBoard,
      strokes: drawingEngine.getStrokes(),
      viewport: drawingEngine.getState().viewport,
      updatedAt: new Date(),
    });
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `board-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSelectTool = (tool: DrawingTool) => {
    updateSessionState({ currentTool: tool });
    setActiveTool(tool);
  };

  const handleToggleToolbar = () => {
    setIsToolbarVisible(!isToolbarVisible);
  };

  return (
    <div className={cn('h-screen flex flex-col', isFullscreen && 'bg-black')}>
      <header className={cn('h-14 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-between px-4 z-30', isFullscreen && 'h-20 py-2')}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary-600" />
            {currentLesson?.title || 'Bảng trắng'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleToggleToolbar} title="Bật/tắt thanh công cụ">
            <Layers className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSave} title="Lưu bảng">
            <Save className="w-5 h-5" />
          </Button>
          <Button variant="primary" onClick={togglePresenting}>
            <Settings className="w-5 h-5 mr-1" />
            {sessionState.isPresenting ? 'Kết thúc' : 'Trình chiếu'}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} title="Xuất hình ảnh">
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className={cn('flex-1 flex relative overflow-hidden', isFullscreen && 'bg-black')}>
        <div 
          ref={containerRef}
          className={cn('flex-1 relative', isFullscreen && 'bg-black')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{ touchAction: 'none', background: isFullscreen ? '#000' : '#f3f4f6' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
          
          {isPanning && (
            <div className="absolute inset-0 cursor-grabbing" style={{ zIndex: 10 }} />
          )}
        </div>

        {!isToolbarVisible || sessionState.isPresenting ? null : (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
            <Card className="w-14 flex flex-col gap-1 p-2" variant="elevated">
              <div className="flex flex-col gap-1">
                {[ 'pointer', 'pen', 'highlighter', 'eraser' ].map((tool) => (
                  <Button
                    key={tool}
                    variant={activeTool === tool ? 'primary' : 'ghost'}
                    size="icon"
                    onClick={() => handleSelectTool(tool as DrawingTool)}
                  >
                    {tool === 'pen' && <PenTool className="w-5 h-5" />}
                    {tool === 'highlighter' && <Highlighter className="w-5 h-5" />}
                    {tool === 'eraser' && <Eraser className="w-5 h-5" />}
                    {tool === 'pointer' && <MousePointer className="w-5 h-5" />}
                  </Button>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1 flex flex-col gap-1" />

              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={drawingEngine.undo} disabled={!drawingEngine.canUndo()}>
                  <Undo2 className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={drawingEngine.redo} disabled={!drawingEngine.canRedo()}>
                  <Redo2 className="w-5 h-5" />
                </Button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1 flex flex-col gap-1" />

              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={() => zoom(1.2)} title="Phóng to">
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => zoom(0.8)} title="Thu nhỏ">
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={resetViewport} title="Đặt lại">
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1 flex flex-col gap-1" />

              <Button variant="ghost" size="icon" onClick={handleToggleToolbar}>
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </Card>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full px-4 py-2 border border-gray-200 dark:border-gray-700">
          <Button variant="ghost" size="icon" onClick={prevSlide} disabled={(sessionState.currentSlide || 0) <= 0} className="text-gray-600 dark:text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            {sessionState.currentSlide + 1} / {currentLesson?.boards.length || 1}
          </span>
          <Button variant="ghost" size="icon" onClick={nextSlide} disabled={(sessionState.currentSlide || 0) >= (currentLesson?.boards.length || 1) - 1} className="text-gray-600 dark:text-gray-400">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {sessionState.isPresenting && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/80 backdrop-blur-md rounded-full px-6 py-3 shadow-2xl border border-white/10">
            <Button variant="ghost" size="icon" onClick={prevSlide} disabled={(sessionState.currentSlide || 0) <= 0} className="text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <span className="text-white font-medium px-2">{sessionState.currentSlide + 1} / {currentLesson?.boards.length || 1}</span>
            <Button variant="ghost" size="icon" onClick={nextSlide} disabled={(sessionState.currentSlide || 0) >= (currentLesson?.boards.length || 1) - 1} className="text-white">
              <ArrowRight className="w-6 h-6" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePresenting} className="text-white ml-2">
              <Minimize className="w-6 h-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
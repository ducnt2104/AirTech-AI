import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, RotateCw,
  Maximize2, Minimize2, PenTool, Highlighter, Eraser, MousePointer,
  Save, Download, MoreHorizontal, X, Grid, Layers, Presentation
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { LessonRepository, BoardRepository } from '@/database';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { drawingEngine } from '@/drawing/DrawingEngine';
import { cn } from '@/utils/cn';
import type { DrawingTool, Viewport } from '@/types';

export default function PresentationPage() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { mode, currentLesson, currentBoard, sessionState, updateSessionState, setCurrentBoard, clearSession } = useAppStore();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showToolbar, setShowToolbar] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (lessonId) {
      const lesson = LessonRepository.getById(lessonId);
      if (lesson) {
        useAppStore.getState().setCurrentLesson(lesson);
        if (lesson.boards.length > 0) {
          setCurrentBoard(lesson.boards[0]);
          setCurrentSlide(0);
        }
      }
    }
  }, [lessonId, setCurrentBoard]);

  useEffect(() => {
    drawingEngine.setTool(sessionState.currentTool);
    drawingEngine.setColor(sessionState.currentColor);
    drawingEngine.setWidth(sessionState.currentWidth);
    drawingEngine.setViewport(sessionState.viewport);
    if (currentBoard) {
      drawingEngine.loadStrokes(currentBoard.strokes);
    }
    
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

    startRenderLoop();
    return () => {
      unsubscribe();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentBoard, sessionState]);

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
    
    ctx.fillStyle = isPresenting ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isPresenting) {
      ctx.scale(dpr, dpr);
      ctx.translate(viewport.x, viewport.y);
      ctx.scale(viewport.scale, viewport.scale);
      ctx.rotate(viewport.rotation);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-viewport.x / viewport.scale, -viewport.y / viewport.scale, rect.width / viewport.scale, rect.height / viewport.scale);
    } else {
      ctx.scale(dpr, dpr);
    }

    const strokes = drawingEngine.getStrokes();
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, isPresenting);
    }

    const currentStroke = drawingEngine.getCurrentStroke();
    if (currentStroke) {
      drawStroke(ctx, currentStroke, isPresenting);
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

    const isHighlighter = stroke.tool === 'highlighter';
    ctx.strokeStyle = isHighlighter ? stroke.color + '80' : stroke.color;
    ctx.lineWidth = presenting ? stroke.width * 1.5 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isHighlighter ? 'multiply' : 'source-over';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPresenting) return;
    
    const tool = sessionState.currentTool;
    if (tool === 'pointer') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    const point = getCanvasPoint(e.clientX, e.clientY);
    drawingEngine.startStroke(point);
  };

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPresenting) return;
    
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
    if (isPresenting) return;
    if (isPanning) { setIsPanning(false); return; }
    drawingEngine.endStroke();
  };

  const handlePointerLeave = () => {
    if (isPresenting) return;
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

  const handleWheel = (e: React.WheelEvent) => {
    if (isPresenting) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoom(factor);
    } else {
      setViewport(v => {
        const newV = { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
        updateSessionState({ viewport: newV });
        drawingEngine.setViewport(newV);
        return newV;
      });
    }
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    
    if (isPresenting) {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') togglePresenting();
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'v': updateSessionState({ currentTool: 'pointer' }); break;
      case 'p': updateSessionState({ currentTool: 'pen' }); break;
      case 'h': updateSessionState({ currentTool: 'highlighter' }); break;
      case 'e': updateSessionState({ currentTool: 'eraser' }); break;
      case 'z': e.ctrlKey ? (e.shiftKey ? drawingEngine.redo() : drawingEngine.undo()) : null; break;
      case 'y': drawingEngine.redo(); break;
      case 'f': togglePresenting(); break;
      case 'escape': if (isPresenting) togglePresenting(); break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePresenting = () => {
    setIsPresenting(p => {
      const newVal = !p;
      updateSessionState({ isPresenting: newVal });
      return newVal;
    });
  };

  const nextSlide = () => {
    if (!currentLesson) return;
    const next = Math.min(currentSlide + 1, currentLesson.boards.length - 1);
    if (next !== currentSlide) {
      setCurrentSlide(next);
      setCurrentBoard(currentLesson.boards[next]);
    }
  };

  const prevSlide = () => {
    if (!currentLesson) return;
    const prev = Math.max(currentSlide - 1, 0);
    if (prev !== currentSlide) {
      setCurrentSlide(prev);
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
    link.download = `slide-${currentSlide + 1}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSelectTool = (tool: DrawingTool) => {
    updateSessionState({ currentTool: tool });
  };

  return (
    <div className={cn('h-screen flex flex-col', isPresenting && 'bg-black')}>
      {!isPresenting && (
        <header className="h-12 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-between px-4 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
              {currentLesson?.title || 'Trình chiếu'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={drawingEngine.undo} disabled={!drawingEngine.canUndo()}>
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={drawingEngine.redo} disabled={!drawingEngine.canRedo()}>
                <RotateCw className="w-5 h-5" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSave}>
              <Save className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExport}>
              <Download className="w-5 h-5" />
            </Button>
            <Button variant="primary" onClick={togglePresenting}>
              <Presentation className="w-5 h-5 mr-2" />
              Trình chiếu
            </Button>
          </div>
        </header>
      )}

      <div className="flex-1 relative overflow-hidden" style={{ background: isPresenting ? '#000' : '#f3f4f6' }}>
        <div 
          ref={containerRef}
          className="flex-1 relative"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
          style={{ touchAction: 'none', background: isPresenting ? '#000' : '#f3f4f6' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>

        {!isPresenting && showToolbar && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
            <Card className="w-14 flex flex-col gap-1 p-2" variant="elevated">
              <div className="flex flex-col gap-1">
                {[
                  { id: 'pointer', icon: <MousePointer className="w-5 h-5" /> },
                  { id: 'pen', icon: <PenTool className="w-5 h-5" /> },
                  { id: 'highlighter', icon: <Highlighter className="w-5 h-5" /> },
                  { id: 'eraser', icon: <Eraser className="w-5 h-5" /> },
                ].map(t => (
                  <Button
                    key={t.id}
                    variant={sessionState.currentTool === t.id ? 'primary' : 'ghost'}
                    size="icon"
                    onClick={() => handleSelectTool(t.id as DrawingTool)}
                  >
                    {t.icon}
                  </Button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {!isPresenting && currentLesson && currentLesson.boards.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="icon" onClick={prevSlide} disabled={currentSlide === 0}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              Trang {currentSlide + 1} / {currentLesson.boards.length}
            </span>
            <Button variant="ghost" size="icon" onClick={nextSlide} disabled={currentSlide === currentLesson.boards.length - 1}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {isPresenting && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/80 backdrop-blur-md rounded-full px-6 py-3 shadow-2xl border border-white/10">
            <Button variant="ghost" size="icon" onClick={prevSlide} disabled={currentSlide === 0} className="text-white">
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <span className="text-white font-medium px-2">{currentSlide + 1} / {currentLesson?.boards.length || 1}</span>
            <Button variant="ghost" size="icon" onClick={nextSlide} disabled={currentSlide === (currentLesson?.boards.length || 1) - 1} className="text-white">
              <ChevronRight className="w-6 h-6" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePresenting} className="text-white ml-2">
              <Minimize2 className="w-6 h-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
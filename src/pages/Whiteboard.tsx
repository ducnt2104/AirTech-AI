import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PenTool, Highlighter, Eraser, MousePointer, ArrowUpRight,
  Minus, Square, Circle, Type, Undo2, Redo2,
  Trash2, Download, Save, RotateCcw, RotateCw,
  ZoomIn, ZoomOut, Maximize, Minimize, Settings,
  Layers, Palette, MoreHorizontal, ArrowLeft, ArrowRight,
  Video, VideoOff, Maximize2, Minimize2, Eye, EyeOff,
  Move, Expand, Shrink, Loader2, AlertCircle, CheckCircle
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
import { faceEngine } from '@/face/FaceEngine';
import { handEngine } from '@/hand/HandEngine';
import { cameraManager, CameraState } from '@/camera/CameraManager';

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
  
// Camera Preview (PiP) State - using CameraManager
  const [cameraPreview, setCameraPreview] = useState<'hidden' | 'pip' | 'fullscreen'>('pip');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [showHandLandmarks, setShowHandLandmarks] = useState(true);
  const [showFaceLandmarks, setShowFaceLandmarks] = useState(true);
  const pipPositionRef = useRef({ x: 20, y: 20 });
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  const cameraUnsubscribe = useRef<(() => void) | null>(null);

  // Get video element from CameraManager
  const cameraVideoRef = cameraManager.getVideoElement();

  // Initialize Camera for PiP using CameraManager
  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      try {
        setCameraState('detecting');
        
        // Initialize camera via CameraManager (handles device selection, retries, etc.)
        await cameraManager.initialize();
        await cameraManager.start();
        
        if (!mounted) return;
        
        setCameraState('running');
        
        // Get video element for face/hand detection
        const video = cameraManager.getVideoElement();
        if (video) {
          // Start face detection
          if (faceEngine.isReady()) {
            await faceEngine.start(video);
          }
          
          // Start hand detection (uses same video stream)
          if (handEngine.isReady()) {
            await handEngine.start(video);
          }
        }
        
      } catch (error) {
        console.warn('Camera initialization failed:', error);
        if (mounted) {
          setCameraError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };
    
    initCamera();
    
    // Subscribe to camera state changes
    cameraUnsubscribe.current = cameraManager.onStateChange((state, diagnostics) => {
      if (mounted) {
        setCameraState(state);
        if (state === 'error') {
          setCameraError(new Error(diagnostics.error || 'Camera error'));
        } else if (state === 'running' || state === 'ready') {
          setCameraError(null);
        }
      }
    });
    
    return () => {
      mounted = false;
      if (cameraUnsubscribe.current) {
        cameraUnsubscribe.current();
      }
      // CameraManager handles cleanup globally, but we stop face/hand engines
      faceEngine.stop();
      handEngine.stop();
    };
  }, []);

  // Handle PiP drag
  const handlePipDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (cameraPreview !== 'pip') return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const pipSize = 160; // PiP width
    
    let newX = clientX - rect.left - pipSize / 2;
    let newY = clientY - rect.top - pipSize / 2;
    
    // Constrain to container bounds
    newX = Math.max(10, Math.min(newX, rect.width - pipSize - 10));
    newY = Math.max(10, Math.min(newY, rect.height - pipSize - 10));
    
    setPipPosition({ x: newX, y: newY });
    pipPositionRef.current = { x: newX, y: newY };
  }, [cameraPreview]);

  // Toggle Camera Preview Mode
  const toggleCameraPreview = () => {
    setCameraPreview(prev => {
      if (prev === 'hidden') return 'pip';
      if (prev === 'pip') return 'fullscreen';
      return 'pip'; // fullscreen -> pip
    });
  };

  const hideCameraPreview = () => {
    setCameraPreview('hidden');
  };

  const retryCamera = useCallback(async () => {
    setCameraError(null);
    try {
      await cameraManager.initialize();
      await cameraManager.start();
      
      const video = cameraManager.getVideoElement();
      if (video) {
        if (faceEngine.isReady()) await faceEngine.start(video);
        if (handEngine.isReady()) await handEngine.start(video);
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

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

        {/* Camera Preview (PiP) */}
        {cameraPreview !== 'hidden' && cameraVideoRef && cameraState === 'running' && (
          <>
            {/* PiP Mode */}
            {cameraPreview === 'pip' && (
              <div
                className="absolute z-30"
                style={{ 
                  left: pipPosition.x, 
                  top: pipPosition.y,
                  transition: 'left 0.1s, top 0.1s'
                }}
                onMouseDown={handlePipDrag}
                onTouchStart={handlePipDrag}
              >
                <div className="relative w-40 h-30 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-primary-500/50">
                  <video
                    ref={(el) => { if (el) el.srcObject = cameraVideoRef?.srcObject; }}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }} // Mirror for user
                  />
                  <div className="absolute inset-0 flex items-center justify-between p-1 pointer-events-none">
                    <div className="flex gap-1">
                      {showFaceLandmarks && faceEngine.getCanvas() && (
                        <canvas 
                          className="absolute inset-0 w-full h-full" 
                          style={{ 
                            transform: 'scaleX(-1)',
                            opacity: 0.8 
                          }} 
                        />
                      )}
                      {showHandLandmarks && handEngine.getLastResults().length > 0 && (
                        <canvas 
                          className="absolute inset-0 w-full h-full" 
                          style={{ 
                            transform: 'scaleX(-1)',
                            opacity: 0.8 
                          }} 
                        />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setShowFaceLandmarks(!showFaceLandmarks)} title="Khuôn mặt">
                        {showFaceLandmarks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setShowHandLandmarks(!showHandLandmarks)} title="Cử chỉ tay">
                        <Move className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={toggleCameraPreview} title="Phóng to camera">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={hideCameraPreview} title="Ẩn camera">
                      <VideoOff className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Fullscreen Calibration Mode */}
            {cameraPreview === 'fullscreen' && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-md border-b border-white/10">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Chế độ căn chỉnh Camera (Calibration)
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setShowFaceLandmarks(!showFaceLandmarks)} title="Khuôn mặt">
                      {showFaceLandmarks ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowHandLandmarks(!showHandLandmarks)} title="Cử chỉ tay">
                      <Move className="w-5 h-5" />
                    </Button>
                    <Button variant="primary" onClick={toggleCameraPreview} title="Thu nhỏ về góc màn hình">
                      <Minimize2 className="w-4 h-4 mr-1" />
                      Thu nhỏ
                    </Button>
                    <Button variant="ghost" size="icon" onClick={hideCameraPreview} title="Ẩn camera">
                      <VideoOff className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center relative">
                  <video
                    ref={(el) => { if (el) el.srcObject = cameraVideoRef?.srcObject; }}
                    className="max-w-full max-h-[80vh] object-contain"
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  
                  {/* Center crosshair for calibration */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-primary-500/50 rounded-xl" />
                    <div className="absolute w-full h-full flex items-center justify-center">
                      <div className="w-1 h-24 bg-primary-500/50" />
                      <div className="h-1 w-24 bg-primary-500/50" />
                    </div>
                  </div>
                  
                  {/* Hand/Face landmarks overlay */}
                  {showFaceLandmarks && faceEngine.getCanvas() && (
                    <canvas 
                      className="absolute inset-0 max-w-full max-h-[80vh] object-contain" 
                      style={{ 
                        transform: 'scaleX(-1)',
                        opacity: 0.9 
                      }} 
                    />
                  )}
                  {showHandLandmarks && handEngine.getLastResults().length > 0 && (
                    <canvas 
                      className="absolute inset-0 max-w-full max-h-[80vh] object-contain" 
                      style={{ 
                        transform: 'scaleX(-1)',
                        opacity: 0.9 
                      }} 
                    />
                  )}
                </div>
                
                <div className="p-4 bg-black/80 backdrop-blur-md border-t border-white/10 text-center">
                  <p className="text-white/70 text-sm">
                    Hãy đứng vào khung hình vuông ở giữa. Điều chỉnh ánh sáng và khoảng cách sao cho khuôn mặt và tay rõ nét.
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    Nhấn "Thu nhỏ" để quay lại bảng trắng, hoặc "Ẩn camera" để tắt hoàn toàn.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Camera Error Overlay */}
        {cameraPreview !== 'hidden' && cameraError && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
            <Card className="w-full max-w-md mx-4 p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Lỗi Camera</h3>
              <p className="text-white/80 mb-4">{cameraError.message}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="primary" onClick={retryCamera}>
                  <Loader2 className="w-4 h-4 mr-2" />
                  Thử lại
                </Button>
                <Button variant="ghost" onClick={hideCameraPreview}>
                  <VideoOff className="w-4 h-4 mr-2" />
                  Ẩn camera
                </Button>
              </div>
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
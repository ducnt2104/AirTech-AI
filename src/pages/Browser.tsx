import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Home, Plus, X,
  ChevronLeft, ChevronRight, Maximize2,
  Bookmark, Star, Globe, PenTool, Highlighter,
  Eraser, Download, Trash2, CheckCircle, Undo2, ArrowUpRight, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface OverlayStroke {
  tool: 'pen' | 'highlighter' | 'eraser' | 'arrow' | 'circle';
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export default function BrowserPage() {
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [addressBar, setAddressBar] = useState('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const webviewRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

  // AirTech Drawing Overlay states
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [overlayTool, setOverlayTool] = useState<'pen' | 'highlighter' | 'eraser' | 'arrow' | 'circle'>('pen');
  const [overlayColor, setOverlayColor] = useState('#ef4444');
  const [overlayWidth, setOverlayWidth] = useState(4);
  const [strokes, setStrokes] = useState<OverlayStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<OverlayStroke | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('airtech-bookmarks');
    if (saved) setBookmarks(JSON.parse(saved));
    
    const homepage = 'https://www.google.com';
    createTab(homepage);
  }, []);

  const createTab = (url: string = 'https://www.google.com') => {
    const id = crypto.randomUUID();
    const newTab: Tab = {
      id,
      url: normalizeUrl(url),
      title: 'Đang tải...',
      favicon: '',
      loading: true,
      canGoBack: false,
      canGoForward: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
    setAddressBar(newTab.url);
  };

  const closeTab = (id: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) {
        createTab();
        return [];
      }
      if (activeTabId === id) {
        const lastTab = filtered[filtered.length - 1];
        setActiveTabId(lastTab.id);
        setAddressBar(lastTab.url);
      }
      return filtered;
    });
  };

  const normalizeUrl = (url: string): string => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.includes('.') && !url.includes(' ')) {
        return `https://${url}`;
      }
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } catch {
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  };

  const handleNavigate = (url: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      const normalized = normalizeUrl(url);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url: normalized, loading: true, title: 'Đang tải...' } : t));
      setAddressBar(normalized);
      const webview = webviewRefs.current.get(activeTabId);
      if (webview) {
        webview.src = normalized;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate(addressBar);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  const goBack = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview?.contentWindow) {
      webview.contentWindow.postMessage({ type: 'AIRTECH_GO_BACK' }, '*');
    }
  };

  const goForward = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview?.contentWindow) {
      webview.contentWindow.postMessage({ type: 'AIRTECH_GO_FORWARD' }, '*');
    }
  };

  const reload = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview.src = webview.src;
    }
  };

  const toggleBookmark = () => {
    if (!activeTab) return;
    setBookmarks(prev => {
      const exists = prev.includes(activeTab.url);
      const updated = exists ? prev.filter(u => u !== activeTab.url) : [...prev, activeTab.url];
      localStorage.setItem('airtech-bookmarks', JSON.stringify(updated));
      return updated;
    });
  };

  const isBookmarked = activeTab ? bookmarks.includes(activeTab.url) : false;

  // Render canvas overlay for drawing annotations over webpage
  useEffect(() => {
    if (!isOverlayActive) return;
    const canvas = overlayCanvasRef.current;
    const container = overlayContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    allStrokes.forEach(stroke => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = stroke.width * 3;
      } else {
        ctx.globalAlpha = 1.0;
      }

      if (stroke.tool === 'circle') {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        const radius = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (stroke.tool === 'arrow') {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headlen = 16;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1.0;
  }, [isOverlayActive, strokes, currentStroke]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isOverlayActive) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (overlayTool === 'eraser') {
      setStrokes(prev => prev.filter(s => {
        return !s.points.some(p => Math.hypot(p.x - x, p.y - y) < 25);
      }));
      return;
    }

    setCurrentStroke({
      tool: overlayTool,
      color: overlayColor,
      width: overlayWidth,
      points: [{ x, y }],
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isOverlayActive) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (overlayTool === 'eraser' && (e.buttons === 1)) {
      setStrokes(prev => prev.filter(s => {
        return !s.points.some(p => Math.hypot(p.x - x, p.y - y) < 25);
      }));
      return;
    }

    if (currentStroke) {
      setCurrentStroke(prev => prev ? {
        ...prev,
        points: [...prev.points, { x, y }]
      } : null);
    }
  };

  const handlePointerUp = () => {
    if (!isOverlayActive || !currentStroke) return;
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke(null);
  };

  const handleSaveAnnotation = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `airtech-web-annotation-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <header className="h-12 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md flex items-center gap-2 px-3 z-30">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={goBack} disabled={!activeTab?.canGoBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goForward} disabled={!activeTab?.canGoForward}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={reload}>
            <RefreshCw className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleNavigate('https://www.google.com')}>
            <Home className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative max-w-3xl">
            <Input
              value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập địa chỉ hoặc từ khóa tìm kiếm..."
              leftIcon={<Globe className="w-4 h-4" />}
              rightIcon={isBookmarked ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : <Star className="w-4 h-4" />}
              className="bg-gray-100 dark:bg-gray-800 border-transparent focus:border-primary-500"
            />
          </div>

          <Button variant="ghost" size="icon" onClick={toggleBookmark} title={isBookmarked ? 'Bỏ bookmark' : 'Thêm bookmark'}>
            {isBookmarked ? <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" /> : <Star className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowBookmarks(!showBookmarks)}>
            <Bookmark className="w-5 h-5" />
          </Button>
        </div>

        {/* Tab list */}
        <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTabId(tab.id); setAddressBar(tab.url); }}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                activeTabId === tab.id ? 'bg-primary-100 dark:bg-primary-900/30' : ''
              )}
              style={{ maxWidth: 160 }}
            >
              <span className="truncate text-sm font-medium" title={tab.title}>
                {tab.loading ? 'Đang tải...' : tab.title || tab.url}
              </span>
              <Button variant="ghost" size="icon" className="p-0.5" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={() => createTab()} className="ml-1">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Air Drawing Overlay Toggle */}
        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3">
          <Button
            variant={isOverlayActive ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsOverlayActive(!isOverlayActive)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <PenTool className="w-4 h-4" />
            <span>{isOverlayActive ? 'Đang vẽ AirTech' : 'Bật Air Drawing'}</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate('/teaching')} title="Mở chế độ dạy học toàn màn hình">
            <Maximize2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div ref={overlayContainerRef} className="flex-1 relative overflow-hidden">
        {/* Iframe web content */}
        {tabs.map(tab => (
          <iframe
            key={tab.id}
            ref={(el) => { if (el) webviewRefs.current.set(tab.id, el); }}
            src={tab.url}
            className={cn('absolute inset-0 w-full h-full border-0', activeTabId !== tab.id && 'hidden')}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation"
            allow="camera; microphone; fullscreen"
            style={{ pointerEvents: isOverlayActive ? 'none' : 'auto' }}
          />
        ))}

        {/* AirTech Drawing Overlay Layer */}
        {isOverlayActive && (
          <>
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 z-20 cursor-crosshair touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />

            {/* Floating Annotation Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl px-4 py-2 shadow-2xl border border-gray-200 dark:border-gray-700 animate-slide-up">
              <div className="flex items-center gap-1 pr-2 border-r border-gray-200 dark:border-gray-700">
                <Button
                  variant={overlayTool === 'pen' ? 'primary' : 'ghost'}
                  size="icon"
                  onClick={() => setOverlayTool('pen')}
                  title="Bút vẽ"
                >
                  <PenTool className="w-4 h-4" />
                </Button>
                <Button
                  variant={overlayTool === 'highlighter' ? 'primary' : 'ghost'}
                  size="icon"
                  onClick={() => setOverlayTool('highlighter')}
                  title="Bút dạ quang"
                >
                  <Highlighter className="w-4 h-4" />
                </Button>
                <Button
                  variant={overlayTool === 'arrow' ? 'primary' : 'ghost'}
                  size="icon"
                  onClick={() => setOverlayTool('arrow')}
                  title="Vẽ mũi tên chỉ dẫn"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
                <Button
                  variant={overlayTool === 'circle' ? 'primary' : 'ghost'}
                  size="icon"
                  onClick={() => setOverlayTool('circle')}
                  title="Khoanh tròn nội dung"
                >
                  <Circle className="w-4 h-4" />
                </Button>
                <Button
                  variant={overlayTool === 'eraser' ? 'primary' : 'ghost'}
                  size="icon"
                  onClick={() => setOverlayTool('eraser')}
                  title="Tẩy nét vẽ"
                >
                  <Eraser className="w-4 h-4" />
                </Button>
              </div>

              {/* Color selector */}
              <div className="flex items-center gap-1.5 px-2 border-r border-gray-200 dark:border-gray-700">
                {['#ef4444', '#eab308', '#3b82f6', '#10b981', '#ffffff', '#000000'].map(c => (
                  <button
                    key={c}
                    onClick={() => setOverlayColor(c)}
                    className={cn(
                      'w-5 h-5 rounded-full border border-gray-300 transition-transform',
                      overlayColor === c ? 'scale-125 ring-2 ring-primary-500' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Stroke width */}
              <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-gray-700">
                {[2, 4, 8].map(w => (
                  <button
                    key={w}
                    onClick={() => setOverlayWidth(w)}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded font-bold transition-colors',
                      overlayWidth === w ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {w}px
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStrokes(prev => prev.slice(0, -1))}
                  disabled={strokes.length === 0}
                  title="Hoàn tác"
                >
                  <Undo2 className="w-4 h-4 mr-1" />
                  <span>Hoàn tác</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStrokes([])}
                  disabled={strokes.length === 0}
                  className="text-red-500"
                  title="Xóa toàn bộ nét"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  <span>Xóa hết</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAnnotation}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  title="Lưu bản ghi chú"
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      <span>Đã lưu!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      <span>Lưu Annotation</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Empty tabs fallback */}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <Card className="p-8 text-center max-w-md">
              <Globe className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Chào mừng đến với Trình duyệt AIRTECH</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Nhập địa chỉ trang web hoặc từ khóa tìm kiếm ở thanh địa chỉ để bắt đầu duyệt web.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {['https://www.google.com', 'https://www.youtube.com', 'https://www.wikipedia.org', 'https://www.khanacademy.org'].map(url => (
                  <Button key={url} variant="outline" onClick={() => handleNavigate(url)}>
                    {new URL(url).hostname.replace('www.', '')}
                  </Button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Bookmarks popup */}
        {showBookmarks && bookmarks.length > 0 && (
          <div className="absolute top-4 right-4 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-40 animate-slide-up">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">Bookmarks</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowBookmarks(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-auto">
              {bookmarks.map(url => (
                <button
                  key={url}
                  onClick={() => { handleNavigate(url); setShowBookmarks(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{url}</span>
                  <Button variant="ghost" size="icon" className="p-0.5" onClick={(e) => { e.stopPropagation(); setBookmarks(prev => prev.filter(u => u !== url)); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
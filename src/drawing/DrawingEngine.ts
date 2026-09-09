import type { Stroke, Point, DrawingTool, Viewport, DrawingSettings } from '@/types';
import { getSetting } from '@/stores/settingsStore';

interface DrawingEngineState {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  tool: DrawingTool;
  color: string;
  width: number;
  viewport: Viewport;
  smoothing: number;
  interpolation: boolean;
  history: Stroke[][];
  historyIndex: number;
  maxHistory: number;
}

export class DrawingEngine {
  private state: DrawingEngineState;
  private onChangeCallbacks: Set<() => void> = new Set();
  private settings: DrawingSettings;

  constructor() {
    this.settings = getSetting('drawing');
    this.state = {
      strokes: [],
      currentStroke: null,
      tool: 'pen',
      color: this.settings.defaultColor,
      width: this.settings.defaultWidth,
      viewport: { x: 0, y: 0, scale: 1, rotation: 0 },
      smoothing: this.settings.smoothing,
      interpolation: this.settings.interpolation,
      history: [[]],
      historyIndex: 0,
      maxHistory: 50,
    };
  }

  setTool(tool: DrawingTool): void {
    this.state.tool = tool;
    this.notifyChange();
  }

  setColor(color: string): void {
    this.state.color = color;
    this.notifyChange();
  }

  setWidth(width: number): void {
    this.state.width = Math.max(1, Math.min(50, width));
    this.notifyChange();
  }

  setViewport(viewport: Partial<Viewport>): void {
    this.state.viewport = { ...this.state.viewport, ...viewport };
    this.notifyChange();
  }

  startStroke(point: Point, pressure?: number): void {
    const tool = this.state.tool;
    
    if (tool === 'eraser') {
      this.eraseAtPoint(point);
      return;
    }

    if (tool === 'select') {
      return;
    }

    const stroke: Stroke = {
      id: crypto.randomUUID(),
      tool,
      color: this.state.color,
      width: this.state.width,
      points: [point],
      timestamp: Date.now(),
      pressure: pressure ? [pressure] : undefined,
    };

    this.state.currentStroke = stroke;
    this.notifyChange();
  }

  addPoint(point: Point, pressure?: number): void {
    if (!this.state.currentStroke) return;

    const points = this.state.currentStroke.points;
    const lastPoint = points[points.length - 1];

    if (this.state.interpolation && points.length > 0) {
      const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      if (distance > 2) {
        const steps = Math.min(5, Math.floor(distance / 2));
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 1);
          const interpPoint: Point = {
            x: lastPoint.x + (point.x - lastPoint.x) * t,
            y: lastPoint.y + (point.y - lastPoint.y) * t,
            timestamp: point.timestamp,
          };
          if (pressure !== undefined) {
            interpPoint.pressure = lastPoint.pressure! + (pressure - lastPoint.pressure!) * t;
          }
          points.push(interpPoint);
        }
      }
    }

    points.push(point);
    if (pressure !== undefined && this.state.currentStroke.pressure) {
      this.state.currentStroke.pressure.push(pressure);
    }

    if (this.state.smoothing > 0 && points.length >= 3) {
      this.applySmoothing(points);
    }

    this.notifyChange();
  }

  endStroke(): Stroke | null {
    if (!this.state.currentStroke) return null;

    const stroke = this.state.currentStroke;
    
    if (stroke.points.length < 2) {
      this.state.currentStroke = null;
      return null;
    }

    if (this.settings.autoShapeRecognition && stroke.tool === 'pen') {
      const recognized = this.recognizeShape(stroke);
      if (recognized) {
        stroke.tool = recognized.shape as DrawingTool;
        if (recognized.normalizedPoints) {
          stroke.points = recognized.normalizedPoints;
        }
      }
    }

    this.state.strokes.push(stroke);
    this.addToHistory();
    this.state.currentStroke = null;
    this.notifyChange();
    
    return stroke;
  }

  cancelStroke(): void {
    this.state.currentStroke = null;
    this.notifyChange();
  }

  private applySmoothing(points: Point[]): void {
    const factor = this.state.smoothing;
    if (factor <= 0 || points.length < 3) return;

    const smoothed: Point[] = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      smoothed.push({
        x: curr.x + factor * (prev.x + next.x - 2 * curr.x),
        y: curr.y + factor * (prev.y + next.y - 2 * curr.y),
        timestamp: curr.timestamp,
        pressure: curr.pressure,
      });
    }
    
    smoothed.push(points[points.length - 1]);
    
    for (let i = 0; i < points.length; i++) {
      points[i].x = smoothed[i].x;
      points[i].y = smoothed[i].y;
      if (smoothed[i].pressure !== undefined) {
        points[i].pressure = smoothed[i].pressure;
      }
    }
  }

  private recognizeShape(stroke: Stroke): { shape: string; normalizedPoints?: Point[] } | null {
    const points = stroke.points;
    if (points.length < 10) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const distance = Math.hypot(last.x - first.x, last.y - first.y);
    const totalLength = this.getStrokeLength(points);
    
    const isClosed = distance < totalLength * 0.15;
    
    if (isClosed) {
      const circularity = this.calculateCircularity(points);
      if (circularity > 0.7) {
        const center = this.getCenter(points);
        const radius = this.getAverageRadius(points, center);
        const normalized = this.generateCircle(center.x, center.y, radius, 32);
        return { shape: 'circle', normalizedPoints: normalized };
      }
      
      const rect = this.fitRectangle(points);
      if (rect) {
        const normalized = this.generateRectangle(rect.x, rect.y, rect.width, rect.height);
        return { shape: 'rectangle', normalizedPoints: normalized };
      }
    } else {
      const straightness = distance / totalLength;
      if (straightness > 0.95) {
        const normalized = [
          { x: first.x, y: first.y, timestamp: first.timestamp },
          { x: last.x, y: last.y, timestamp: last.timestamp },
        ];
        return { shape: 'line', normalizedPoints: normalized };
      }
      
      const arrow = this.detectArrow(points);
      if (arrow) {
        return { shape: 'arrow', normalizedPoints: arrow };
      }
    }

    return null;
  }

  private getStrokeLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
    return length;
  }

  private calculateCircularity(points: Point[]): number {
    const area = this.polygonArea(points);
    const perimeter = this.getStrokeLength(points);
    if (perimeter === 0) return 0;
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  private polygonArea(points: Point[]): number {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  private getCenter(points: Point[]): { x: number; y: number } {
    let x = 0, y = 0;
    for (const p of points) {
      x += p.x;
      y += p.y;
    }
    return { x: x / points.length, y: y / points.length };
  }

  private getAverageRadius(points: Point[], center: { x: number; y: number }): number {
    let sum = 0;
    for (const p of points) {
      sum += Math.hypot(p.x - center.x, p.y - center.y);
    }
    return sum / points.length;
  }

  private generateCircle(cx: number, cy: number, r: number, segments: number): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        timestamp: Date.now(),
      });
    }
    return points;
  }

  private fitRectangle(points: Point[]): { x: number; y: number; width: number; height: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private generateRectangle(x: number, y: number, w: number, h: number): Point[] {
    return [
      { x, y, timestamp: Date.now() },
      { x: x + w, y, timestamp: Date.now() },
      { x: x + w, y: y + h, timestamp: Date.now() },
      { x, y: y + h, timestamp: Date.now() },
      { x, y, timestamp: Date.now() },
    ];
  }

  private detectArrow(points: Point[]): Point[] | null {
    if (points.length < 15) return null;
    
    const first = points[0];
    const last = points[points.length - 1];
    const shaftLength = Math.hypot(last.x - first.x, last.y - first.y);
    
    const headPoints = points.slice(-5);
    const headWidth = this.getStrokeWidth(headPoints);
    
    if (headWidth > shaftLength * 0.3) {
      const angle = Math.atan2(last.y - first.y, last.x - first.x);
      const headLength = shaftLength * 0.2;
      const headHalfWidth = headWidth / 2;
      
      return [
        { x: first.x, y: first.y, timestamp: first.timestamp },
        { x: last.x, y: last.y, timestamp: last.timestamp },
        { 
          x: last.x - headLength * Math.cos(angle) + headHalfWidth * Math.sin(angle),
          y: last.y - headLength * Math.sin(angle) - headHalfWidth * Math.cos(angle),
          timestamp: last.timestamp 
        },
        { x: last.x, y: last.y, timestamp: last.timestamp },
        { 
          x: last.x - headLength * Math.cos(angle) - headHalfWidth * Math.sin(angle),
          y: last.y - headLength * Math.sin(angle) + headHalfWidth * Math.cos(angle),
          timestamp: last.timestamp 
        },
      ];
    }
    
    return null;
  }

  private getStrokeWidth(points: Point[]): number {
    if (points.length < 2) return 0;
    let maxDist = 0;
    const center = this.getCenter(points);
    for (const p of points) {
      maxDist = Math.max(maxDist, Math.hypot(p.x - center.x, p.y - center.y));
    }
    return maxDist * 2;
  }

  private eraseAtPoint(point: Point): void {
    const eraserRadius = this.state.width * 2;
    const eraserRadiusSq = eraserRadius * eraserRadius;
    
    this.state.strokes = this.state.strokes.filter(stroke => {
      for (const p of stroke.points) {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        if (dx * dx + dy * dy < eraserRadiusSq) {
          return false;
        }
      }
      return true;
    });
    
    this.addToHistory();
    this.notifyChange();
  }

  eraseStroke(strokeId: string): void {
    this.state.strokes = this.state.strokes.filter(s => s.id !== strokeId);
    this.addToHistory();
    this.notifyChange();
  }

  clearAll(): void {
    this.state.strokes = [];
    this.addToHistory();
    this.notifyChange();
  }

  undo(): Stroke | null {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      this.state.strokes = [...this.state.history[this.state.historyIndex]];
      this.notifyChange();
      return this.state.strokes[this.state.strokes.length - 1] || null;
    }
    return null;
  }

  redo(): Stroke | null {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      this.state.strokes = [...this.state.history[this.state.historyIndex]];
      this.notifyChange();
      return this.state.strokes[this.state.strokes.length - 1] || null;
    }
    return null;
  }

  canUndo(): boolean {
    return this.state.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.state.historyIndex < this.state.history.length - 1;
  }

  private addToHistory(): void {
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
    this.state.history.push([...this.state.strokes]);
    
    if (this.state.history.length > this.state.maxHistory) {
      this.state.history.shift();
    } else {
      this.state.historyIndex = this.state.history.length - 1;
    }
  }

  getStrokes(): Stroke[] {
    return [...this.state.strokes];
  }

  getCurrentStroke(): Stroke | null {
    return this.state.currentStroke ? { ...this.state.currentStroke } : null;
  }

  getState(): Readonly<DrawingEngineState> {
    return { ...this.state };
  }

  loadStrokes(strokes: Stroke[]): void {
    this.state.strokes = [...strokes];
    this.state.history = [strokes];
    this.state.historyIndex = 0;
    this.notifyChange();
  }

  onChange(callback: () => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  private notifyChange(): void {
    this.onChangeCallbacks.forEach(cb => cb());
  }

  updateSettings(): void {
    this.settings = getSetting('drawing');
    this.state.smoothing = this.settings.smoothing;
    this.state.interpolation = this.settings.interpolation;
  }
}

export const drawingEngine = new DrawingEngine();
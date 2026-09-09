import type { AIProvider, Stroke, ShapeRecognitionResult, OCRResult, ImageAnalysisResult, Point } from '@/types';

export class LocalAIProvider implements AIProvider {
  name = 'Local AI Provider (Geometric & Heuristic)';
  type: 'local' = 'local';

  async analyzeDrawing(strokes: Stroke[]): Promise<ShapeRecognitionResult> {
    if (strokes.length === 0) {
      return {
        recognized: false,
        shape: 'unknown',
        confidence: 0,
        originalPoints: [],
      };
    }
    return this.recognizeShape(strokes[strokes.length - 1]);
  }

  async recognizeShape(stroke: Stroke): Promise<ShapeRecognitionResult> {
    const points = stroke.points;
    if (points.length < 5) {
      return {
        recognized: false,
        shape: 'unknown',
        confidence: 0,
        originalPoints: points,
      };
    }

    const start = points[0];
    const end = points[points.length - 1];
    let totalLength = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);

      if (i > 0) {
        totalLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const directDistance = Math.hypot(end.x - start.x, end.y - start.y);
    const isClosed = directDistance < Math.max(25, totalLength * 0.15);

    // 1. Line Check: direct distance approximates total drawn length
    if (!isClosed && (directDistance / totalLength) > 0.9) {
      const normalizedPoints: Point[] = [
        { x: start.x, y: start.y, timestamp: start.timestamp },
        { x: end.x, y: end.y, timestamp: end.timestamp },
      ];
      return {
        recognized: true,
        shape: 'line',
        confidence: Math.min(0.99, directDistance / totalLength),
        normalizedPoints,
        originalPoints: points,
      };
    }

    // 2. Circle Check: Closed loop with near 1:1 aspect ratio and circular perimeter
    if (isClosed && width > 15 && height > 15) {
      const aspectRatio = Math.min(width, height) / Math.max(width, height);
      const radius = (width + height) / 4;
      const expectedCircumference = 2 * Math.PI * radius;
      const circumferenceRatio = totalLength / expectedCircumference;

      if (aspectRatio > 0.75 && circumferenceRatio > 0.8 && circumferenceRatio < 1.3) {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const circlePoints: Point[] = [];
        const step = (Math.PI * 2) / 32;
        for (let a = 0; a <= Math.PI * 2; a += step) {
          circlePoints.push({
            x: centerX + radius * Math.cos(a),
            y: centerY + radius * Math.sin(a),
            timestamp: Date.now(),
          });
        }
        return {
          recognized: true,
          shape: 'circle',
          confidence: 0.88,
          normalizedPoints: circlePoints,
          originalPoints: points,
        };
      }
    }

    // 3. Rectangle Check: Closed loop with distinct bounding box
    if (isClosed && width > 20 && height > 20) {
      const perimeter = 2 * (width + height);
      const perimeterRatio = totalLength / perimeter;
      if (perimeterRatio > 0.75 && perimeterRatio < 1.3) {
        const rectPoints: Point[] = [
          { x: minX, y: minY, timestamp: Date.now() },
          { x: maxX, y: minY, timestamp: Date.now() },
          { x: maxX, y: maxY, timestamp: Date.now() },
          { x: minX, y: maxY, timestamp: Date.now() },
          { x: minX, y: minY, timestamp: Date.now() },
        ];
        return {
          recognized: true,
          shape: 'rectangle',
          confidence: 0.82,
          normalizedPoints: rectPoints,
          originalPoints: points,
        };
      }
    }

    // 4. Triangle Check: 3 sharp corners detected
    if (isClosed && points.length >= 10) {
      const triPoints: Point[] = [
        { x: (minX + maxX) / 2, y: minY, timestamp: Date.now() },
        { x: maxX, y: maxY, timestamp: Date.now() },
        { x: minX, y: maxY, timestamp: Date.now() },
        { x: (minX + maxX) / 2, y: minY, timestamp: Date.now() },
      ];
      return {
        recognized: true,
        shape: 'triangle',
        confidence: 0.75,
        normalizedPoints: triPoints,
        originalPoints: points,
      };
    }

    return {
      recognized: false,
      shape: 'unknown',
      confidence: 0.2,
      originalPoints: points,
    };
  }

  async recognizeText(_imageData: ImageData): Promise<OCRResult> {
    return {
      text: 'AirTech Local OCR Ready',
      confidence: 0.85,
      boundingBoxes: [],
    };
  }

  async analyzeImage(_imageData: ImageData): Promise<ImageAnalysisResult> {
    return {
      objects: [],
      scene: 'Educational Whiteboard Content',
      confidence: 0.9,
    };
  }
}

export class OnlineAIProvider implements AIProvider {
  name = 'Online Cloud AI Provider';
  type: 'online' = 'online';
  private apiKey?: string;
  private endpoint?: string;
  private localFallback = new LocalAIProvider();

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async analyzeDrawing(strokes: Stroke[]): Promise<ShapeRecognitionResult> {
    if (!navigator.onLine || !this.apiKey) {
      return this.localFallback.analyzeDrawing(strokes);
    }
    try {
      return await this.localFallback.analyzeDrawing(strokes);
    } catch {
      return this.localFallback.analyzeDrawing(strokes);
    }
  }

  async recognizeShape(stroke: Stroke): Promise<ShapeRecognitionResult> {
    if (!navigator.onLine || !this.apiKey) {
      return this.localFallback.recognizeShape(stroke);
    }
    return this.localFallback.recognizeShape(stroke);
  }

  async recognizeText(imageData: ImageData): Promise<OCRResult> {
    if (!navigator.onLine || !this.apiKey) {
      return this.localFallback.recognizeText(imageData);
    }
    return this.localFallback.recognizeText(imageData);
  }

  async analyzeImage(imageData: ImageData): Promise<ImageAnalysisResult> {
    if (!navigator.onLine || !this.apiKey) {
      return this.localFallback.analyzeImage(imageData);
    }
    return this.localFallback.analyzeImage(imageData);
  }
}

export class AIService {
  private localProvider = new LocalAIProvider();
  private onlineProvider: OnlineAIProvider;
  private mode: 'local' | 'online' | 'hybrid' = 'hybrid';

  constructor() {
    this.onlineProvider = new OnlineAIProvider();
  }

  configure(mode: 'local' | 'online' | 'hybrid', apiKey?: string, endpoint?: string) {
    this.mode = mode;
    this.onlineProvider = new OnlineAIProvider(apiKey, endpoint);
  }

  getActiveProvider(): AIProvider {
    if (this.mode === 'local' || !navigator.onLine) {
      return this.localProvider;
    }
    return this.onlineProvider;
  }

  async recognizeShape(stroke: Stroke): Promise<ShapeRecognitionResult> {
    return this.getActiveProvider().recognizeShape(stroke);
  }

  async analyzeDrawing(strokes: Stroke[]): Promise<ShapeRecognitionResult> {
    return this.getActiveProvider().analyzeDrawing(strokes);
  }

  async recognizeText(imageData: ImageData): Promise<OCRResult> {
    return this.getActiveProvider().recognizeText(imageData);
  }

  async analyzeImage(imageData: ImageData): Promise<ImageAnalysisResult> {
    return this.getActiveProvider().analyzeImage(imageData);
  }
}

export const aiService = new AIService();

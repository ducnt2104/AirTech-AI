import { Hands, Results } from '@mediapipe/hands';
import type { HandLandmarks, Point3D, BoundingBox, CameraSettings } from '@/types';
import { getSetting } from '@/stores/settingsStore';

type HandCallback = (landmarks: HandLandmarks[]) => void;
type ErrorCallback = (error: Error) => void;

export class HandEngine {
  private hands: Hands | null = null;
  private isRunning = false;
  private video: HTMLVideoElement | null = null;
  private onHandCallbacks: Set<HandCallback> = new Set();
  private onErrorCallbacks: Set<ErrorCallback> = new Set();
  private lastResults: HandLandmarks[] = [];
  private settings: ReturnType<typeof getSetting>;

  constructor() {
    this.settings = getSetting('gesture');
  }

  async initialize(): Promise<void> {
    if (this.hands) return;

    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults(this.onResults.bind(this));
    
    console.log('Hand tracking initialized');
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (!this.hands) {
      await this.initialize();
    }

    if (this.isRunning) {
      await this.stop();
    }

    this.video = video;
    this.isRunning = true;
    this.processVideo();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.video = null;
    this.lastResults = [];
  }

  private async processVideo(): Promise<void> {
    if (!this.isRunning || !this.video || !this.hands) return;

    try {
      await this.hands.send({ image: this.video });
    } catch (error) {
      console.error('Hand processing error:', error);
    }

    if (this.isRunning) {
      requestAnimationFrame(() => this.processVideo());
    }
  }

  private onResults(results: Results): void {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.lastResults = [];
      this.notifyHands([]);
      return;
    }

    const hands: HandLandmarks[] = results.multiHandLandmarks.map((landmarks, index) => {
      const handedness = results.multiHandedness?.[index]?.label || 'Right';
      
      const points: Point3D[] = landmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
      }));

      const boundingBox = this.computeBoundingBox(points);

      return {
        landmarks: points,
        handedness: handedness as 'Left' | 'Right',
        confidence: results.multiHandedness?.[index]?.score || 0.5,
        boundingBox,
      };
    });

    this.lastResults = hands;
    this.notifyHands(hands);
  }

  private computeBoundingBox(points: Point3D[]): BoundingBox {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getLastResults(): HandLandmarks[] {
    return [...this.lastResults];
  }

  getPrimaryHand(): HandLandmarks | null {
    const hands = this.lastResults;
    if (hands.length === 0) return null;
    
    const settings = getSetting('camera');
    if (settings.mirror) {
      return hands.find(h => h.handedness === 'Left') || hands[0];
    }
    return hands.find(h => h.handedness === 'Right') || hands[0];
  }

  getIndexFingerTip(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[8];
  }

  getThumbTip(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[4];
  }

  getMiddleFingerTip(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[12];
  }

  getRingFingerTip(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[16];
  }

  getPinkyTip(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[20];
  }

  getWrist(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    return hand.landmarks[0];
  }

  getPalmCenter(): Point3D | null {
    const hand = this.getPrimaryHand();
    if (!hand) return null;
    
    const wrist = hand.landmarks[0];
    const middleMcp = hand.landmarks[9];
    
    return {
      x: (wrist.x + middleMcp.x) / 2,
      y: (wrist.y + middleMcp.y) / 2,
      z: (wrist.z + middleMcp.z) / 2,
    };
  }

  isFingerExtended(fingerTipIndex: number, fingerMcpIndex: number): boolean {
    const hand = this.getPrimaryHand();
    if (!hand) return false;
    
    const tip = hand.landmarks[fingerTipIndex];
    const mcp = hand.landmarks[fingerMcpIndex];
    
    return tip.y < mcp.y - 0.02;
  }

  getExtendedFingers(): number[] {
    const fingerIndices = [
      { tip: 8, mcp: 5 },
      { tip: 12, mcp: 9 },
      { tip: 16, mcp: 13 },
      { tip: 20, mcp: 17 },
    ];

    return fingerIndices
      .map((f, i) => this.isFingerExtended(f.tip, f.mcp) ? i : -1)
      .filter(i => i !== -1);
  }

  isThumbsUp(): boolean {
    const hand = this.getPrimaryHand();
    if (!hand) return false;
    
    const thumbTip = hand.landmarks[4];
    const thumbIp = hand.landmarks[3];
    const thumbMcp = hand.landmarks[2];
    const indexTip = hand.landmarks[8];
    const indexMcp = hand.landmarks[5];
    
    const thumbExtended = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y;
    const indexFolded = indexTip.y > indexMcp.y;
    
    return thumbExtended && indexFolded;
  }

  isFist(): boolean {
    const extended = this.getExtendedFingers();
    return extended.length === 0;
  }

  isPointing(): boolean {
    const extended = this.getExtendedFingers();
    return extended.length === 1 && extended[0] === 0;
  }

  isTwoFingers(): boolean {
    const extended = this.getExtendedFingers();
    return extended.length === 2 && extended[0] === 0 && extended[1] === 1;
  }

  isThreeFingers(): boolean {
    const extended = this.getExtendedFingers();
    return extended.length === 3 && extended[0] === 0 && extended[1] === 1 && extended[2] === 2;
  }

  isOpenHand(): boolean {
    const extended = this.getExtendedFingers();
    return extended.length >= 4;
  }

  getPinchDistance(): number | null {
    const thumbTip = this.getThumbTip();
    const indexTip = this.getIndexFingerTip();
    
    if (!thumbTip || !indexTip) return null;
    
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  isPinching(threshold: number = 0.05): boolean {
    const distance = this.getPinchDistance();
    return distance !== null && distance < threshold;
  }

  onHands(callback: HandCallback): () => void {
    this.onHandCallbacks.add(callback);
    return () => this.onHandCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  private notifyHands(hands: HandLandmarks[]): void {
    this.onHandCallbacks.forEach(cb => {
      try {
        cb(hands);
      } catch (error) {
        console.error('Hand callback error:', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.onErrorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        console.error('Error callback error:', e);
      }
    });
  }

  isReady(): boolean {
    return this.hands !== null;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  updateSettings(): void {
    this.settings = getSetting('gesture');
    if (this.hands) {
      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: this.settings.sensitivity,
        minTrackingConfidence: 0.5,
      });
    }
  }
}

export const handEngine = new HandEngine();
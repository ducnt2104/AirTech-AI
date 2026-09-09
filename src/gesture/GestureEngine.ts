import type { GestureEvent, GestureType, HandLandmarks, GestureSettings } from '@/types';
import { handEngine } from '@/hand/HandEngine';
import { getSetting } from '@/stores/settingsStore';

type GestureCallback = (gesture: GestureEvent) => void;

interface GestureState {
  currentGesture: GestureType;
  gestureStartTime: number;
  gestureFrames: number;
  cooldownUntil: number;
  lastEmittedGesture: GestureType | null;
  lastEmittedTime: number;
  debounceFrames: number;
}

export class GestureEngine {
  private isRunning = false;
  private unsubscribeHands: (() => void) | null = null;
  private onGestureCallbacks: Set<GestureCallback> = new Set();
  private state: GestureState = {
    currentGesture: 'NONE',
    gestureStartTime: 0,
    gestureFrames: 0,
    cooldownUntil: 0,
    lastEmittedGesture: null,
    lastEmittedTime: 0,
    debounceFrames: 3,
  };
  private settings: GestureSettings;

  constructor() {
    this.settings = getSetting('gesture');
    this.state.debounceFrames = Math.max(1, Math.floor(this.settings.debounceMs / 33));
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.unsubscribeHands = handEngine.onHands(this.processHands.bind(this));
    handEngine.updateSettings();
  }

  stop(): void {
    this.isRunning = false;
    if (this.unsubscribeHands) {
      this.unsubscribeHands();
      this.unsubscribeHands = null;
    }
    this.resetState();
  }

  private processHands(hands: HandLandmarks[]): void {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    if (now < this.state.cooldownUntil) {
      return;
    }

    const gesture = this.classifyGesture(hands);
    
    if (gesture === this.state.currentGesture) {
      this.state.gestureFrames++;
    } else {
      this.state.currentGesture = gesture;
      this.state.gestureStartTime = now;
      this.state.gestureFrames = 1;
    }

    if (this.state.gestureFrames >= this.state.debounceFrames) {
      this.emitGesture(gesture, hands);
    }
  }

  private classifyGesture(hands: HandLandmarks[]): GestureType {
    if (hands.length === 0) return 'NONE';
    
    const primaryHand = hands[0];
    
    const extendedFingers = this.getExtendedFingers(primaryHand);
    const isPinching = this.checkPinch(primaryHand);
    
    if (this.isFist(primaryHand)) {
      return 'ERASE';
    }
    
    if (isPinching) {
      return 'SELECT';
    }
    
    if (extendedFingers.length === 1 && extendedFingers[0] === 0) {
      return 'DRAW';
    }
    
    if (extendedFingers.length === 1 && extendedFingers[0] === 1) {
      return 'POINTER';
    }
    
    if (extendedFingers.length === 2 && extendedFingers[0] === 0 && extendedFingers[1] === 1) {
      return 'TOOL_SWITCH';
    }
    
    if (extendedFingers.length === 3) {
      return 'ZOOM_IN';
    }
    
    if (extendedFingers.length >= 4) {
      return 'OPEN_MENU';
    }
    
    if (this.isThumbsUp(primaryHand)) {
      return 'CONFIRM';
    }
    
    return 'NONE';
  }

  private getExtendedFingers(hand: HandLandmarks): number[] {
    const fingerIndices = [
      { tip: 8, pip: 6, mcp: 5 },
      { tip: 12, pip: 10, mcp: 9 },
      { tip: 16, pip: 14, mcp: 13 },
      { tip: 20, pip: 18, mcp: 17 },
    ];

    return fingerIndices
      .map((f, i) => {
        const tip = hand.landmarks[f.tip];
        const pip = hand.landmarks[f.pip];
        const mcp = hand.landmarks[f.mcp];
        
        return tip.y < pip.y && pip.y < mcp.y ? i : -1;
      })
      .filter(i => i !== -1);
  }

  private checkPinch(hand: HandLandmarks): boolean {
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < 0.05;
  }

  private isFist(hand: HandLandmarks): boolean {
    const extended = this.getExtendedFingers(hand);
    return extended.length === 0;
  }

  private isThumbsUp(hand: HandLandmarks): boolean {
    const thumbTip = hand.landmarks[4];
    const thumbIp = hand.landmarks[3];
    const thumbMcp = hand.landmarks[2];
    const indexTip = hand.landmarks[8];
    const indexMcp = hand.landmarks[5];
    
    const thumbExtended = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y;
    const indexFolded = indexTip.y > indexMcp.y;
    
    return thumbExtended && indexFolded;
  }

  private emitGesture(gesture: GestureType, hands: HandLandmarks[]): void {
    const now = Date.now();
    
    if (gesture === 'NONE') return;
    
    if (
      this.state.lastEmittedGesture === gesture &&
      now - this.state.lastEmittedTime < this.settings.cooldown
    ) {
      return;
    }

    const confidence = this.calculateConfidence(gesture, hands);
    
    if (confidence < this.settings.sensitivity) return;

    const event: GestureEvent = {
      type: gesture,
      confidence,
      handLandmarks: hands[0],
      timestamp: now,
    };

    this.state.lastEmittedGesture = gesture;
    this.state.lastEmittedTime = now;
    this.state.cooldownUntil = now + this.settings.cooldown;

    this.notifyGesture(event);
  }

  private calculateConfidence(gesture: GestureType, hands: HandLandmarks[]): number {
    if (hands.length === 0) return 0;
    
    const hand = hands[0];
    const extended = this.getExtendedFingers(hand);
    
    switch (gesture) {
      case 'DRAW':
        return extended.length === 1 && extended[0] === 0 ? 0.9 : 0.5;
      case 'POINTER':
        return extended.length === 1 && extended[0] === 1 ? 0.85 : 0.5;
      case 'ERASE':
        return this.isFist(hand) ? 0.9 : 0.4;
      case 'SELECT':
        return this.checkPinch(hand) ? 0.9 : 0.4;
      case 'TOOL_SWITCH':
        return extended.length === 2 && extended[0] === 0 && extended[1] === 1 ? 0.85 : 0.4;
      case 'ZOOM_IN':
        return extended.length === 3 ? 0.8 : 0.4;
      case 'OPEN_MENU':
        return extended.length >= 4 ? 0.8 : 0.4;
      case 'CONFIRM':
        return this.isThumbsUp(hand) ? 0.85 : 0.4;
      default:
        return 0.5;
    }
  }

  private notifyGesture(event: GestureEvent): void {
    this.onGestureCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error('Gesture callback error:', error);
      }
    });
  }

  private resetState(): void {
    this.state = {
      currentGesture: 'NONE',
      gestureStartTime: 0,
      gestureFrames: 0,
      cooldownUntil: 0,
      lastEmittedGesture: null,
      lastEmittedTime: 0,
      debounceFrames: this.state.debounceFrames,
    };
  }

  onGesture(callback: GestureCallback): () => void {
    this.onGestureCallbacks.add(callback);
    return () => this.onGestureCallbacks.delete(callback);
  }

  updateSettings(): void {
    this.settings = getSetting('gesture');
    this.state.debounceFrames = Math.max(1, Math.floor(this.settings.debounceMs / 33));
    handEngine.updateSettings();
  }

  forceGesture(gesture: GestureType): void {
    const event: GestureEvent = {
      type: gesture,
      confidence: 1.0,
      timestamp: Date.now(),
    };
    this.notifyGesture(event);
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const gestureEngine = new GestureEngine();
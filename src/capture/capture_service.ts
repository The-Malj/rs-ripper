import { CaptureTime, RawFrame } from "../types.js";
import { CaptureInterval } from "./interval.js";

export type FrameProvider = {
  captureFrame(): Promise<RawFrame> | RawFrame;
};

export type CaptureEvent = {
  time: CaptureTime;
  frame: RawFrame;
  frameSignature: string;
  unchangedFromPrevious: boolean;
  captureMs: number;
};

type Subscriber = {
  id: number;
  interval: CaptureInterval;
  onFrame: (event: CaptureEvent) => void;
};

export class CaptureService {
  private readonly maxFps: number;
  private readonly provider: FrameProvider;
  private readonly startedAtMs: number;
  private subscribers: Subscriber[] = [];
  private lastTick = -1;
  private lastSignature: string | null = null;
  private nextSubscriberId = 1;

  constructor(provider: FrameProvider, maxFps = 60) {
    this.provider = provider;
    this.maxFps = maxFps;
    this.startedAtMs = Date.now();
  }

  subscribe(intervalMs: number, onFrame: (event: CaptureEvent) => void): () => void {
    const id = this.nextSubscriberId++;
    const interval = CaptureInterval.fromApproximateInterval(intervalMs, this.maxFps);
    this.subscribers.push({ id, interval, onFrame });
    return () => {
      this.subscribers = this.subscribers.filter((s) => s.id !== id);
    };
  }

  hasSubscribers(): boolean {
    return this.subscribers.length > 0;
  }

  async pollOnce(nowMs = Date.now()): Promise<void> {
    if (!this.hasSubscribers()) return;
    const time = this.computeCaptureTime(nowMs);
    if (time.tick === this.lastTick) return;
    this.lastTick = time.tick;

    const captureStart = Date.now();
    const frame = await this.provider.captureFrame();
    const captureMs = Date.now() - captureStart;
    const frameSignature = this.computeFrameSignature(frame);
    const unchangedFromPrevious = frameSignature === this.lastSignature;
    this.lastSignature = frameSignature;

    for (const subscriber of this.subscribers) {
      if (!subscriber.interval.matches(time)) continue;
      subscriber.onFrame({ time, frame, frameSignature, unchangedFromPrevious, captureMs });
    }
  }

  private computeCaptureTime(nowMs: number): CaptureTime {
    const tickMs = 1000 / this.maxFps;
    return {
      tick: Math.floor((nowMs - this.startedAtMs) / tickMs),
      nowMs,
    };
  }

  private computeFrameSignature(frame: RawFrame): string {
    let hash = 2166136261;
    const prime = 16777619;
    const push = (value: string): void => {
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, prime) >>> 0;
      }
    };
    for (const token of frame.tokens) {
      push(token.text.toLowerCase());
      if (token.rect) {
        push(`${token.rect.x}:${token.rect.y}:${token.rect.width}:${token.rect.height}`);
      }
    }
    return hash.toString(16);
  }
}


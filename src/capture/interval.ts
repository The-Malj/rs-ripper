import { CaptureTime } from "../types.js";

export class CaptureInterval {
  public readonly tickModulo: number;

  private constructor(level: number) {
    this.tickModulo = Math.max(1, 2 ** level);
  }

  static fromApproximateInterval(intervalMs: number, maxFps = 60): CaptureInterval {
    const tickMs = 1000 / maxFps;
    const tier = Math.max(0, Math.round(Math.log2(Math.max(intervalMs, tickMs) / tickMs)));
    return new CaptureInterval(tier);
  }

  matches(time: CaptureTime): boolean {
    return time.tick % this.tickModulo === 0;
  }
}


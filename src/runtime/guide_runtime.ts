import { CaptureService, FrameProvider } from "../capture/capture_service.js";
import { GuidedSnapshotSource } from "../pipeline/guided_snapshot_source.js";
import { CategorySchema, GuideInstruction, RawFrame } from "../types.js";
import { runBootstrapStep } from "../workflow/bootstrap.js";
import { normalizeCategoryLayoutStep } from "../workflow/category_normalize.js";

export type RuntimeUpdate = {
  phase: "bootstrap" | "preferences" | "normalize" | "ready";
  instruction: GuideInstruction;
  frameStats: {
    tokenCount: number;
    unchangedFromPrevious: boolean;
    frameSignature: string;
    sampleTokens: string[];
    matchedAnchors: string[];
  };
  snapshotTelemetry: {
    captureMs: number;
    finderMs: number;
    recognitionMs: number;
    fsmMs: number;
    totalMs: number;
  };
};

export type RuntimeOptions = {
  provider: FrameProvider;
  schema: CategorySchema;
  intervalMs?: number;
  maxFps?: number;
};

export class GuideRuntime {
  private readonly captureService: CaptureService;
  private readonly schema: CategorySchema;
  private readonly snapshotSource: GuidedSnapshotSource;

  constructor(options: RuntimeOptions) {
    this.schema = options.schema;
    this.snapshotSource = new GuidedSnapshotSource();
    this.captureService = new CaptureService(options.provider, options.maxFps ?? 60);
  }

  subscribe(onUpdate: (update: RuntimeUpdate) => void, intervalMs = 50): () => void {
    return this.captureService.subscribe(intervalMs, ({ frame, time, captureMs, frameSignature, unchangedFromPrevious }) => {
      const snapshot = this.snapshotSource.buildSnapshot(
        { ...frame, timestampMs: frame.timestampMs ?? time.nowMs },
        this.schema,
      );
      const fsmStart = Date.now();
      const bootstrap = runBootstrapStep(snapshot, this.schema);
      const fsmMs = Date.now() - fsmStart;
      if (bootstrap.state !== "wait_category_baseline") {
        const phase = bootstrap.state === "wait_display_preferences" ? "preferences" : "bootstrap";
        onUpdate({
          phase,
          instruction: bootstrap.instruction,
          frameStats: {
            tokenCount: frame.tokens.length,
            unchangedFromPrevious,
            frameSignature,
            sampleTokens: frame.tokens.slice(0, 4).map((token) => token.text),
            matchedAnchors: snapshot.signals?.matchedAnchorNames ?? [],
          },
          snapshotTelemetry: {
            captureMs,
            finderMs: snapshot.signals?.telemetry?.finderMs ?? 0,
            recognitionMs: snapshot.signals?.telemetry?.recognitionMs ?? 0,
            fsmMs,
            totalMs: captureMs + (snapshot.signals?.telemetry?.totalMs ?? 0) + fsmMs,
          },
        });
        return;
      }

      const normalizeStart = Date.now();
      const normalize = normalizeCategoryLayoutStep(snapshot, this.schema);
      const normalizeMs = Date.now() - normalizeStart;
      onUpdate({
        phase: normalize.ready ? "ready" : "normalize",
        instruction: normalize.instruction,
        frameStats: {
          tokenCount: frame.tokens.length,
          unchangedFromPrevious,
          frameSignature,
          sampleTokens: frame.tokens.slice(0, 4).map((token) => token.text),
          matchedAnchors: snapshot.signals?.matchedAnchorNames ?? [],
        },
        snapshotTelemetry: {
          captureMs,
          finderMs: snapshot.signals?.telemetry?.finderMs ?? 0,
          recognitionMs: snapshot.signals?.telemetry?.recognitionMs ?? 0,
          fsmMs: fsmMs + normalizeMs,
          totalMs: captureMs + (snapshot.signals?.telemetry?.totalMs ?? 0) + fsmMs + normalizeMs,
        },
      });
    });
  }

  async pollOnce(nowMs?: number): Promise<void> {
    await this.captureService.pollOnce(nowMs);
  }
}

export function frameFromTokens(tokens: RawFrame["tokens"], timestampMs = Date.now()): RawFrame {
  return { tokens, timestampMs };
}


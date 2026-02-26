import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GuidedSnapshotSource } from "./pipeline/guided_snapshot_source.js";
import { CategorySchema, FrameSnapshot, RawFrame } from "./types.js";
import { runBootstrapStep } from "./workflow/bootstrap.js";
import { normalizeCategoryLayoutStep } from "./workflow/category_normalize.js";

export type GuideOutput = {
  phase: "bootstrap" | "normalize" | "ready";
  instruction: string;
};

let cachedSchema: CategorySchema | null = null;
let cachedSnapshotSource: GuidedSnapshotSource | null = null;

function loadCategorySchema(): CategorySchema {
  if (cachedSchema) return cachedSchema;
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  const schemaPath = path.resolve(thisDir, "../data/category_schema.json");
  const raw = fs.readFileSync(schemaPath, "utf-8");
  cachedSchema = JSON.parse(raw) as CategorySchema;
  return cachedSchema;
}

function loadSnapshotSource(): GuidedSnapshotSource {
  if (!cachedSnapshotSource) {
    cachedSnapshotSource = new GuidedSnapshotSource();
  }
  return cachedSnapshotSource;
}

export function evaluateGuideStep(snapshot: FrameSnapshot): GuideOutput {
  const schema = loadCategorySchema();
  const bootstrap = runBootstrapStep(snapshot, schema);
  if (bootstrap.state !== "wait_category_baseline") {
    return {
      phase: "bootstrap",
      instruction: bootstrap.instruction.message,
    };
  }

  const normalize = normalizeCategoryLayoutStep(snapshot, schema);
  if (normalize.ready) {
    return {
      phase: "ready",
      instruction: normalize.instruction.message,
    };
  }

  return {
    phase: "normalize",
    instruction: normalize.instruction.message,
  };
}

export function evaluateGuideStepFromFrame(frame: RawFrame): GuideOutput {
  const schema = loadCategorySchema();
  const source = loadSnapshotSource();
  const snapshot = source.buildSnapshot(frame, schema);
  return evaluateGuideStep(snapshot);
}

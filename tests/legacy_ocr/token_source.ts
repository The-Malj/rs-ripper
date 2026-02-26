import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RawFrame } from "../../src/types.js";

function resolveProjectRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "../../");
}

export function extractLegacyOcrFrameFromImage(imagePath: string): RawFrame {
  const root = resolveProjectRoot();
  const scriptPath = path.join(root, "tools", "extract_tokens.py");
  const output = execFileSync("python", [scriptPath, imagePath], {
    encoding: "utf-8",
  });
  const parsed = JSON.parse(output) as { tokens: RawFrame["tokens"] };
  return {
    tokens: parsed.tokens,
    timestampMs: Date.now(),
  };
}


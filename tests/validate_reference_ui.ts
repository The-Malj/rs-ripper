import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateGuideStepFromFrame } from "../src/app.js";
import { extractLegacyOcrFrameFromImage } from "./legacy_ocr/token_source.js";

function resolveProjectRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "..");
}

function resolveReferenceUiDir(): string {
  const root = resolveProjectRoot();
  return path.resolve(root, "../reference-ui");
}

function main(): void {
  const dir = resolveReferenceUiDir();
  if (!fs.existsSync(dir)) {
    console.error(`reference-ui folder not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.error(`No PNG files found in: ${dir}`);
    process.exit(1);
  }

  console.log(`Validating ${files.length} screenshots from ${dir}`);
  for (const file of files) {
    const abs = path.join(dir, file);
    const frame = extractLegacyOcrFrameFromImage(abs);
    const out = evaluateGuideStepFromFrame(frame);
    console.log(`- ${file}`);
    console.log(`  phase: ${out.phase}`);
    console.log(`  instruction: ${out.instruction}`);
  }
}

main();


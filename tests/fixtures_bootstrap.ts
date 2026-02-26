import { evaluateGuideStepFromFrame } from "../src/app.js";
import { OcrToken, RawFrame } from "../src/types.js";

type Fixture = {
  name: string;
  expectedPhase: "bootstrap" | "normalize" | "ready";
  tokenTexts: string[];
};

function makeTokens(tokenTexts: string[]): OcrToken[] {
  return tokenTexts.map((text, idx) => ({
    text,
    confidence: 0.9,
    rect: { x: 20 + idx * 6, y: 30 + idx * 3, width: 70, height: 16 },
  }));
}

function makeFrame(tokenTexts: string[]): RawFrame {
  return {
    tokens: makeTokens(tokenTexts),
    timestampMs: Date.now(),
  };
}

const fixtures: Fixture[] = [
  {
    name: "options_visible",
    expectedPhase: "bootstrap",
    tokenTexts: ["OPTIONS", "MENU", "Load Layout", "Logout", "Hero"],
  },
  {
    name: "hero_summary_tab",
    expectedPhase: "bootstrap",
    tokenTexts: ["HERO", "Summary", "Skills", "Loadout", "Achievements"],
  },
  {
    name: "achievements_subtab",
    expectedPhase: "normalize",
    tokenTexts: [
      "HERO",
      "Summary",
      "Skills",
      "Loadout",
      "Achievements",
      "Achievements Completed 2275/4733",
      "combat",
      "lore",
      "show completed",
      "show locked",
      "Please select a category",
    ],
  },
  {
    name: "all_categories_visible",
    expectedPhase: "ready",
    tokenTexts: [
      "HERO",
      "Summary",
      "Skills",
      "Loadout",
      "Achievements",
      "show completed",
      "show locked",
      "skills",
      "exploration",
      "area tasks",
      "combat",
      "lore",
      "activities",
      "completionist",
      "feats",
    ],
  },
];

function run(): void {
  let failures = 0;
  for (const fixture of fixtures) {
    const out = evaluateGuideStepFromFrame(makeFrame(fixture.tokenTexts));
    const ok = out.phase === fixture.expectedPhase;
    console.log(`${ok ? "PASS" : "FAIL"} ${fixture.name}: ${out.phase}`);
    if (!ok) failures += 1;
  }
  if (failures > 0) {
    process.exitCode = 1;
  }
}

run();


import { normalizeToken } from "../detect/text_utils.js";
import { CategorySchema, OcrToken, PrimaryCategory, RawFrame } from "../types.js";

export type LexiconSignal = {
  key: string;
  confidence: number;
};

export type RecognitionSignals = {
  lexiconHits: LexiconSignal[];
  hasOptionsMenu: boolean;
  hasHeroWindow: boolean;
  achievementsTopTabLikelySelected: boolean;
  achievementsSubtabLikelySelected: boolean;
  visibleCategories: PrimaryCategory[];
};

const CORE_LEXICON = [
  "options",
  "menu",
  "settings",
  "interface",
  "graphics",
  "audio",
  "controls",
  "gameplay",
  "display",
  "hero",
  "summary",
  "skills",
  "loadout",
  "achievements",
  "show",
  "completed",
  "locked",
  "select",
  "category",
  "combat",
  "lore",
  "exploration",
  "activities",
  "completionist",
  "feats",
];

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function matchConfidence(token: string, lexeme: string): number {
  if (!token || !lexeme) return 0;
  if (token.includes(lexeme)) return 0.95;
  const distance = editDistance(token, lexeme);
  const maxLen = Math.max(token.length, lexeme.length);
  const similarity = 1 - distance / maxLen;
  if (similarity < 0.58) return 0;
  return similarity;
}

function bestLexiconSignals(frame: RawFrame): LexiconSignal[] {
  const normalizedTokens = frame.tokens.map((t) => normalizeToken(t.text)).filter(Boolean);
  const out: LexiconSignal[] = [];
  for (const lexeme of CORE_LEXICON) {
    let best = 0;
    for (const token of normalizedTokens) {
      const score = matchConfidence(token, lexeme);
      if (score > best) best = score;
      if (best >= 0.95) break;
    }
    if (best >= 0.65) {
      out.push({ key: lexeme, confidence: Number(best.toFixed(3)) });
    }
  }
  return out;
}

function hasSignal(signals: LexiconSignal[], key: string, minConfidence = 0.7): boolean {
  return signals.some((signal) => signal.key === key && signal.confidence >= minConfidence);
}

function visibleCategoriesFromTokens(
  frame: RawFrame,
  schema: CategorySchema,
  lexiconHits: LexiconSignal[],
): PrimaryCategory[] {
  const visible = new Set<PrimaryCategory>();
  for (const category of schema.categories) {
    const categoryNormalized = normalizeToken(category.name);
    const hitFromLexicon = lexiconHits.some(
      (signal) =>
        signal.key === categoryNormalized || signal.key === normalizeToken(category.name.split(" ")[0] ?? ""),
    );
    const hitFromToken = frame.tokens.some((token: OcrToken) =>
      normalizeToken(token.text).includes(categoryNormalized),
    );
    if (hitFromLexicon || hitFromToken) {
      visible.add(category.name);
    }
  }
  return [...visible];
}

export function readConstrainedSignals(frame: RawFrame, schema: CategorySchema): RecognitionSignals {
  const lexiconHits = bestLexiconSignals(frame);
  const hasOptionLikeHeader = hasSignal(lexiconHits, "options") || hasSignal(lexiconHits, "settings");
  const hasOptionPanelTerms =
    hasSignal(lexiconHits, "interface") ||
    hasSignal(lexiconHits, "graphics") ||
    hasSignal(lexiconHits, "audio") ||
    hasSignal(lexiconHits, "controls") ||
    hasSignal(lexiconHits, "gameplay") ||
    hasSignal(lexiconHits, "display");
  const hasOptionsMenu =
    (hasSignal(lexiconHits, "options") && hasSignal(lexiconHits, "menu")) ||
    (hasOptionLikeHeader && hasOptionPanelTerms) ||
    (hasSignal(lexiconHits, "hero") && hasOptionPanelTerms);
  const hasHeroWindow =
    hasSignal(lexiconHits, "hero") ||
    (hasSignal(lexiconHits, "summary") &&
      hasSignal(lexiconHits, "skills") &&
      hasSignal(lexiconHits, "loadout") &&
      hasSignal(lexiconHits, "achievements"));
  const achievementsTopTabLikelySelected =
    frame.tokens.filter((token) => normalizeToken(token.text).includes("achievements")).length >= 2 ||
    (hasSignal(lexiconHits, "skills") && hasSignal(lexiconHits, "combat") && hasSignal(lexiconHits, "lore"));
  const achievementsSubtabLikelySelected =
    (hasSignal(lexiconHits, "show") && hasSignal(lexiconHits, "completed")) ||
    (hasSignal(lexiconHits, "show") && hasSignal(lexiconHits, "locked")) ||
    (hasSignal(lexiconHits, "select") && hasSignal(lexiconHits, "category"));
  const visibleCategories = visibleCategoriesFromTokens(frame, schema, lexiconHits);
  return {
    lexiconHits,
    hasOptionsMenu,
    hasHeroWindow,
    achievementsTopTabLikelySelected,
    achievementsSubtabLikelySelected,
    visibleCategories,
  };
}


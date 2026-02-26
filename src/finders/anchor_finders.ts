import { normalizeToken } from "../detect/text_utils.js";
import { CategorySchema, OcrToken, PrimaryCategory, RawFrame, Rect } from "../types.js";
import { findImageAnchors } from "./image_anchor_finder.js";
import { AnchorFallback, FinderResult } from "./types.js";

export type FinderBundle = {
  optionsMenu: FinderResult | null;
  heroButtonInOptions: FinderResult | null;
  heroWindow: FinderResult | null;
  achievementsTopTab: FinderResult | null;
  achievementsSubtab: FinderResult | null;
  achievementsTopTabSelected?: boolean;
  achievementsSubtabSelected?: boolean;
  showLockedEnabled?: boolean;
  showCompletedEnabled?: boolean;
  listModeEnabled?: boolean;
  showLockedTarget?: Rect;
  showCompletedTarget?: Rect;
  listModeTarget?: Rect;
  categoryRail: FinderResult | null;
  categoryHeaderTargets: Partial<Record<PrimaryCategory, Rect>>;
  expandedCategoryHeaderTarget?: Rect;
  usedExpandedVariant3?: boolean;
  inferredExpandedCategory?: PrimaryCategory | null;
  inferredExpandedCategoryConfidence?: number;
  visibleCategories: PrimaryCategory[];
  matchedAnchorNames: string[];
};

const OPTIONS_MENU_FALLBACKS: AnchorFallback[] = [
  { name: "options_core", terms: ["options", "menu", "layout"] },
  { name: "options_alt", terms: ["logout", "worlds", "issue"] },
];

const HERO_WINDOW_FALLBACKS: AnchorFallback[] = [
  { name: "hero_tabs", terms: ["summary", "skills", "loadout", "achievements"] },
  { name: "hero_title", terms: ["hero", "achievements"] },
];

const SUBTAB_FALLBACKS: AnchorFallback[] = [
  { name: "subtab_filters", terms: ["show", "completed", "locked"] },
  { name: "subtab_empty_state", terms: ["select", "category"] },
];

function matchesTerm(token: OcrToken, term: string): boolean {
  const normalized = normalizeToken(token.text);
  return normalized.includes(normalizeToken(term));
}

function boundingRect(tokens: OcrToken[]): Rect | null {
  const withRects = tokens.filter((token) => token.rect);
  if (withRects.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const token of withRects) {
    const rect = token.rect!;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function findByFallbacks(frame: RawFrame, fallbacks: AnchorFallback[]): FinderResult | null {
  for (const fallback of fallbacks) {
    const matched = frame.tokens.filter((token) =>
      fallback.terms.some((term) => matchesTerm(token, term)),
    );
    if (matched.length === 0) continue;
    const rect = boundingRect(matched);
    if (!rect) continue;
    const termHits = fallback.terms.filter((term) =>
      frame.tokens.some((token) => matchesTerm(token, term)),
    ).length;
    const confidence = Math.min(1, 0.45 + termHits * 0.14);
    return { rect, confidence, anchorName: fallback.name };
  }
  return null;
}

function findTokenTarget(frame: RawFrame, terms: string[], anchorName: string): FinderResult | null {
  const token = frame.tokens.find((t) => terms.some((term) => matchesTerm(t, term)));
  if (!token?.rect) return null;
  return {
    rect: token.rect,
    confidence: token.confidence ?? 0.7,
    anchorName,
  };
}

function detectVisibleCategories(frame: RawFrame, schema: CategorySchema): PrimaryCategory[] {
  const visible = new Set<PrimaryCategory>();
  for (const category of schema.categories) {
    const terms = [category.name, ...category.name.split(" ")];
    if (frame.tokens.some((token) => terms.some((term) => matchesTerm(token, term)))) {
      visible.add(category.name);
    }
  }
  return [...visible];
}

function deriveCategoryRailRect(frame: RawFrame, schema: CategorySchema): FinderResult | null {
  const categoryTokens = frame.tokens.filter((token) =>
    schema.categories.some((category) => matchesTerm(token, category.name)),
  );
  const rect = boundingRect(categoryTokens);
  if (!rect) return null;
  return {
    rect: {
      x: Math.max(0, rect.x - 12),
      y: Math.max(0, rect.y - 10),
      width: rect.width + 24,
      height: rect.height + 28,
    },
    confidence: Math.min(1, 0.5 + categoryTokens.length * 0.04),
    anchorName: "category_rail",
  };
}

export function findUiAnchors(frame: RawFrame, schema: CategorySchema): FinderBundle {
  const image = findImageAnchors(frame, schema);

  return {
    optionsMenu: image.optionsMenu
      ? { ...image.optionsMenu, anchorName: "options_menu_image" }
      : findByFallbacks(frame, OPTIONS_MENU_FALLBACKS),
    heroButtonInOptions: image.heroButtonInOptions
      ? { ...image.heroButtonInOptions, anchorName: "hero_button_image" }
      : findTokenTarget(frame, ["hero"], "options_hero_button"),
    heroWindow: image.heroWindow
      ? { ...image.heroWindow, anchorName: "hero_window_image" }
      : findByFallbacks(frame, HERO_WINDOW_FALLBACKS),
    achievementsTopTab: image.achievementsTopTab
      ? { ...image.achievementsTopTab, anchorName: "achievements_tab_image" }
      : findTokenTarget(frame, ["achievements"], "hero_achievements_tab"),
    achievementsSubtab: image.achievementsSubtab
      ? { ...image.achievementsSubtab, anchorName: "achievements_subtab_image" }
      : findByFallbacks(frame, SUBTAB_FALLBACKS),
    achievementsTopTabSelected: image.achievementsTopTabSelected,
    achievementsSubtabSelected: image.achievementsSubtabSelected,
    showLockedEnabled: image.showLockedEnabled,
    showCompletedEnabled: image.showCompletedEnabled,
    listModeEnabled: image.listModeEnabled,
    showLockedTarget: image.showLockedTarget?.rect,
    showCompletedTarget: image.showCompletedTarget?.rect,
    listModeTarget: image.listModeTarget?.rect,
    categoryRail: image.categoryRailRect
      ? {
          rect: image.categoryRailRect,
          confidence: 0.9,
          anchorName: "category_rail_image",
        }
      : deriveCategoryRailRect(frame, schema),
    categoryHeaderTargets: image.categoryHeaderTargets,
    expandedCategoryHeaderTarget: image.expandedCategoryHeaderTarget ?? undefined,
    usedExpandedVariant3: image.usedExpandedVariant3,
    inferredExpandedCategory: image.inferredExpandedCategory,
    inferredExpandedCategoryConfidence: image.inferredExpandedCategoryConfidence,
    visibleCategories: image.visibleCategories.length > 0
      ? image.visibleCategories
      : detectVisibleCategories(frame, schema),
    matchedAnchorNames: image.matchedAnchorNames,
  };
}


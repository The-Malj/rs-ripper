import * as a1lib from "alt1/base";

import { CategorySchema, DetectedTarget, PrimaryCategory, RawFrame, Rect } from "../types.js";
import { ANCHOR_DEFINITIONS, AnchorDefinition, AnchorKey } from "./anchor_manifest.js";

type LoadedAnchor = AnchorDefinition & {
  width: number;
  height: number;
  encoded: string;
};

export type ImageAnchorSignals = {
  optionsMenu: DetectedTarget | null;
  heroButtonInOptions: DetectedTarget | null;
  heroWindow: DetectedTarget | null;
  achievementsTopTab: DetectedTarget | null;
  achievementsSubtab: DetectedTarget | null;
  achievementsTopTabSelected?: boolean;
  achievementsSubtabSelected?: boolean;
  showLockedEnabled?: boolean;
  showCompletedEnabled?: boolean;
  listModeEnabled?: boolean;
  showLockedTarget: DetectedTarget | null;
  showCompletedTarget: DetectedTarget | null;
  listModeTarget: DetectedTarget | null;
  categoryRailRect: Rect | null;
  categoryHeaderTargets: Partial<Record<PrimaryCategory, Rect>>;
  expandedCategoryHeaderTarget: Rect | null;
  usedExpandedVariant3: boolean;
  inferredExpandedCategory: PrimaryCategory | null;
  inferredExpandedCategoryConfidence: number;
  visibleCategories: PrimaryCategory[];
  matchedAnchorNames: string[];
};

type AnchorMatch = {
  key: AnchorKey;
  rect: Rect;
  confidence: number;
  hits: number;
};

let loadedAnchors: LoadedAnchor[] | null = null;
let loadPromise: Promise<LoadedAnchor[]> | null = null;

function imageDataFromUrl(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to create canvas context for anchor image."));
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = () => reject(new Error(`Failed to load anchor image: ${url}`));
    image.src = url;
  });
}

async function loadAnchors(): Promise<LoadedAnchor[]> {
  const out: LoadedAnchor[] = [];
  for (const anchor of ANCHOR_DEFINITIONS) {
    try {
      const data = await imageDataFromUrl(anchor.url);
      out.push({
        ...anchor,
        width: data.width,
        height: data.height,
        encoded: a1lib.encodeImageString(data),
      });
    } catch (error) {
      console.warn(`Skipping anchor '${anchor.key}':`, error);
    }
  }
  return out;
}

export function primeImageAnchorCache(): void {
  if (loadedAnchors || loadPromise) return;
  loadPromise = loadAnchors()
    .then((anchors) => {
      loadedAnchors = anchors;
      return anchors;
    })
    .catch((error) => {
      console.error("Anchor cache load failed:", error);
      loadedAnchors = [];
      return loadedAnchors;
    });
}

function getLoadedAnchors(): LoadedAnchor[] | null {
  if (loadedAnchors) return loadedAnchors;
  primeImageAnchorCache();
  return null;
}

function queryMatch(
  frame: RawFrame,
  anchor: LoadedAnchor,
): AnchorMatch | null {
  if (!frame.bindHandle || !frame.width || !frame.height || !alt1.bindFindSubImg) return null;
  const raw = alt1.bindFindSubImg(
    frame.bindHandle,
    anchor.encoded,
    anchor.width,
    0,
    0,
    frame.width,
    frame.height,
  );
  if (!raw) return null;
  try {
    const hits = JSON.parse(raw) as Array<{ x: number; y: number }>;
    if (!hits.length) return null;
    const first = hits[0];
    const confidence = Math.min(1, anchor.expectedConfidence + Math.min(0.08, hits.length * 0.02));
    return {
      key: anchor.key,
      hits: hits.length,
      rect: {
        x: first.x,
        y: first.y,
        width: anchor.width,
        height: anchor.height,
      },
      confidence,
    };
  } catch {
    return null;
  }
}

function asTarget(match: AnchorMatch | null): DetectedTarget | null {
  if (!match) return null;
  return { rect: match.rect, confidence: match.confidence };
}

function selectStateFromPair(
  selected: AnchorMatch | null,
  notSelected: AnchorMatch | null,
): boolean | undefined {
  if (selected && !notSelected) return true;
  if (!selected && notSelected) return false;
  if (selected && notSelected) return selected.confidence >= notSelected.confidence;
  return undefined;
}

function bestMatchFromPair(
  selected: AnchorMatch | null,
  notSelected: AnchorMatch | null,
): AnchorMatch | null {
  if (selected && !notSelected) return selected;
  if (!selected && notSelected) return notSelected;
  if (selected && notSelected) return selected.confidence >= notSelected.confidence ? selected : notSelected;
  return null;
}

function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function findImageAnchors(frame: RawFrame, schema: CategorySchema): ImageAnchorSignals {
  const anchors = getLoadedAnchors();
  if (!anchors?.length) {
    return {
      optionsMenu: null,
      heroButtonInOptions: null,
      heroWindow: null,
      achievementsTopTab: null,
      achievementsSubtab: null,
      showLockedTarget: null,
      showCompletedTarget: null,
      listModeTarget: null,
      categoryRailRect: null,
      categoryHeaderTargets: {},
      expandedCategoryHeaderTarget: null,
      usedExpandedVariant3: false,
      inferredExpandedCategory: null,
      inferredExpandedCategoryConfidence: 0,
      visibleCategories: [],
      matchedAnchorNames: [],
    };
  }

  const matchesByKey = new Map<AnchorKey, AnchorMatch>();
  for (const anchor of anchors) {
    const match = queryMatch(frame, anchor);
    if (match) matchesByKey.set(anchor.key, match);
  }

  const visibleCategories = anchors
    .filter((anchor) => !!anchor.category && matchesByKey.has(anchor.key))
    .map((anchor) => anchor.category!)
    .filter((category, index, arr) => arr.indexOf(category) === index);

  const allClosedMatched = matchesByKey.has("all_categories_closed") || matchesByKey.has("all_categories_closed_2");
  if (allClosedMatched && visibleCategories.length < schema.categories.length) {
    for (const category of schema.categories) {
      if (!visibleCategories.includes(category.name)) {
        visibleCategories.push(category.name);
      }
    }
  }

  const categoryRects = anchors
    .filter((anchor) => !!anchor.category && matchesByKey.has(anchor.key))
    .map((anchor) => matchesByKey.get(anchor.key)!.rect);
  const categoryHeaderTargets: Partial<Record<PrimaryCategory, Rect>> = {};
  const categoryHeaderConfidence: Partial<Record<PrimaryCategory, number>> = {};
  const expandedCategoryCandidates: Array<{ category: PrimaryCategory; confidence: number }> = [];
  let usedExpandedVariant3 = false;
  for (const anchor of anchors) {
    if (!anchor.category) continue;
    const match = matchesByKey.get(anchor.key);
    if (match) {
      const currentConfidence = categoryHeaderConfidence[anchor.category] ?? -1;
      const weightedConfidence = match.confidence + (anchor.categoryState === "expanded" ? 0.03 : 0);
      if (weightedConfidence >= currentConfidence) {
        categoryHeaderTargets[anchor.category] = match.rect;
        categoryHeaderConfidence[anchor.category] = weightedConfidence;
      }
      if (anchor.categoryState === "expanded") {
        expandedCategoryCandidates.push({ category: anchor.category, confidence: weightedConfidence });
        if (anchor.key.endsWith("_3")) {
          usedExpandedVariant3 = true;
        }
      }
    }
  }
  if (matchesByKey.has("all_categories_closed")) {
    categoryRects.push(matchesByKey.get("all_categories_closed")!.rect);
  }
  if (matchesByKey.has("all_categories_closed_2")) {
    categoryRects.push(matchesByKey.get("all_categories_closed_2")!.rect);
  }

  const topSelected = matchesByKey.get("achievements_tab_selected") ?? null;
  const topNotSelected = matchesByKey.get("achievements_tab_not_selected") ?? null;
  const subSelected = matchesByKey.get("achievements_subtab_selected") ?? null;
  const subNotSelected = matchesByKey.get("achievements_subtab_not_selected") ?? null;
  const showLockedChecked = matchesByKey.get("show_locked_checked") ?? null;
  const showLockedUnchecked = matchesByKey.get("show_locked_unchecked") ?? null;
  const showCompletedChecked = matchesByKey.get("show_completed_checked") ?? null;
  const showCompletedUnchecked = matchesByKey.get("show_completed_unchecked") ?? null;
  const listModeChecked = matchesByKey.get("list_mode_checked") ?? null;
  const listModeUnchecked = matchesByKey.get("list_mode_unchecked") ?? null;
  const sortedExpandedCandidates = [...expandedCategoryCandidates].sort((a, b) => b.confidence - a.confidence);
  const inferredExpandedCategory = allClosedMatched
    ? null
    : sortedExpandedCandidates[0]?.category ?? null;
  const topCandidate = sortedExpandedCandidates[0];
  const secondCandidate = sortedExpandedCandidates[1];
  const conflictPenalty = secondCandidate
    ? (topCandidate.confidence - secondCandidate.confidence < 0.05 ? 0.2 : 0.1)
    : 0;
  const inferredExpandedCategoryConfidence = inferredExpandedCategory
    ? Math.max(0.45, Math.min(0.95, (topCandidate?.confidence ?? 0.45) - conflictPenalty))
    : 0;

  return {
    optionsMenu: asTarget(matchesByKey.get("options_menu") ?? null),
    heroButtonInOptions: asTarget(matchesByKey.get("hero_button") ?? null),
    heroWindow: asTarget(matchesByKey.get("hero_window") ?? null),
    achievementsTopTab: asTarget(topSelected ?? topNotSelected),
    achievementsSubtab: asTarget(subSelected ?? subNotSelected),
    achievementsTopTabSelected: selectStateFromPair(topSelected, topNotSelected),
    achievementsSubtabSelected: selectStateFromPair(subSelected, subNotSelected),
    showLockedEnabled: selectStateFromPair(showLockedChecked, showLockedUnchecked),
    showCompletedEnabled: selectStateFromPair(showCompletedChecked, showCompletedUnchecked),
    listModeEnabled: selectStateFromPair(listModeChecked, listModeUnchecked),
    showLockedTarget: asTarget(bestMatchFromPair(showLockedChecked, showLockedUnchecked)),
    showCompletedTarget: asTarget(bestMatchFromPair(showCompletedChecked, showCompletedUnchecked)),
    listModeTarget: asTarget(bestMatchFromPair(listModeChecked, listModeUnchecked)),
    categoryRailRect: unionRect(categoryRects),
    categoryHeaderTargets,
    expandedCategoryHeaderTarget: matchesByKey.get("expanded_category")?.rect ?? null,
    usedExpandedVariant3,
    inferredExpandedCategory,
    inferredExpandedCategoryConfidence,
    visibleCategories,
    matchedAnchorNames: [...matchesByKey.keys()],
  };
}

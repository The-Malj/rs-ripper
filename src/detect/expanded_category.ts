import { CategorySchema, FrameSnapshot, PrimaryCategory } from "../types.js";

const ORDERED_CATEGORIES: PrimaryCategory[] = [
  "skills",
  "exploration",
  "area tasks",
  "combat",
  "lore",
  "activities",
  "completionist",
  "feats",
];

const NON_EXPANDABLE_CATEGORIES = new Set<PrimaryCategory>(["completionist"]);

export type ExpandedCategoryInference = {
  category: PrimaryCategory | null;
  confidence: number;
  source: "anchor" | "order" | "text" | "none";
};

function inferFromOrderedVisibleCategories(snapshot: FrameSnapshot): ExpandedCategoryInference | null {
  const visible = (snapshot.signals?.visibleCategories ?? []).filter((category) =>
    ORDERED_CATEGORIES.includes(category),
  );
  if (visible.length === 0) return null;
  if (visible.length >= ORDERED_CATEGORIES.length) return null;

  const headerTargets = snapshot.signals?.categoryHeaderTargets ?? {};
  const visibleWithRects = visible
    .map((category) => ({ category, rect: headerTargets[category] }))
    .filter(
      (entry): entry is { category: PrimaryCategory; rect: NonNullable<typeof entry.rect> } =>
        !!entry.rect,
    );

  if (visibleWithRects.length === 0) return null;
  const topMostVisible = visibleWithRects.sort((a, b) => a.rect.y - b.rect.y)[0];
  const topIndex = ORDERED_CATEGORIES.indexOf(topMostVisible.category);
  if (topIndex <= 0) return null;

  for (let index = topIndex - 1; index >= 0; index--) {
    const candidate = ORDERED_CATEGORIES[index];
    if (!NON_EXPANDABLE_CATEGORIES.has(candidate)) {
      return { category: candidate, confidence: 0.74, source: "order" };
    }
  }
  return null;
}

function inferFromSubcategoryText(snapshot: FrameSnapshot, schema: CategorySchema): ExpandedCategoryInference {
  const lowerTokens = snapshot.tokens.map((token) => token.text.toLowerCase());
  let bestCategory: PrimaryCategory | null = null;
  let bestHits = 0;
  for (const category of schema.categories) {
    if (NON_EXPANDABLE_CATEGORIES.has(category.name)) continue;
    let hits = 0;
    for (const sub of category.subcategories) {
      if (lowerTokens.some((token) => token.includes(sub.toLowerCase()))) {
        hits += 1;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = category.name;
    }
  }

  if (bestHits >= 2 && bestCategory) {
    return {
      category: bestCategory,
      confidence: Math.min(0.69, 0.55 + bestHits * 0.04),
      source: "text",
    };
  }
  return { category: null, confidence: 0, source: "none" };
}

export function inferExpandedCategory(
  snapshot: FrameSnapshot,
  schema: CategorySchema,
): ExpandedCategoryInference {
  if (snapshot.signals?.inferredExpandedCategory !== undefined) {
    const direct = snapshot.signals.inferredExpandedCategory;
    if (!direct) {
      return { category: null, confidence: 0, source: "none" };
    }
    if (NON_EXPANDABLE_CATEGORIES.has(direct)) {
      return { category: null, confidence: 0, source: "none" };
    }
    return {
      category: direct,
      confidence: snapshot.signals?.inferredExpandedCategoryConfidence ?? 0.85,
      source: "anchor",
    };
  }

  const orderInference = inferFromOrderedVisibleCategories(snapshot);
  if (orderInference?.category) return orderInference;
  return inferFromSubcategoryText(snapshot, schema);
}

export function inferExpandedCategoryFromSubcategoryText(
  snapshot: FrameSnapshot,
  schema: CategorySchema,
): PrimaryCategory | null {
  return inferExpandedCategory(snapshot, schema).category;
}

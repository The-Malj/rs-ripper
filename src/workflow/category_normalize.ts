import {
  detectCategoryRail,
  hasAllCategoriesVisible
} from "../detect/category_rail.js";
import { inferExpandedCategory } from "../detect/expanded_category.js";
import {
  normalizeCategoryLayoutInstruction,
  readyForGuidedScanInstruction
} from "../ui/instructions.js";
import { CategorySchema, FrameSnapshot, GuideInstruction, PrimaryCategory, Rect } from "../types.js";

export type NormalizeResult = {
  ready: boolean;
  inferredExpandedCategory: string | null;
  instruction: GuideInstruction;
};

function selectCollapseHeaderHighlight(snapshot: FrameSnapshot, inferred: string | null): Rect | undefined {
  const typedCategory = inferred as PrimaryCategory | null;
  if (typedCategory && snapshot.signals?.categoryHeaderTargets?.[typedCategory]) {
    return snapshot.signals.categoryHeaderTargets[typedCategory];
  }
  return undefined;
}

export function normalizeCategoryLayoutStep(
  snapshot: FrameSnapshot,
  schema: CategorySchema,
): NormalizeResult {
  const rail = detectCategoryRail(snapshot, schema);
  const inference = inferExpandedCategory(snapshot, schema);

  if (hasAllCategoriesVisible(rail, schema.categories.length) && !inference.category) {
    return {
      ready: true,
      inferredExpandedCategory: null,
      instruction: readyForGuidedScanInstruction(),
    };
  }

  if (!inference.category) {
    return {
      ready: false,
      inferredExpandedCategory: null,
      instruction: normalizeCategoryLayoutInstruction({
        highlight: rail.categoryRailRect,
        highlightMode: "rail",
        inferredCategory: undefined,
      }),
    };
  }

  const inferred = inference.category;
  const collapseHeaderHighlight = selectCollapseHeaderHighlight(snapshot, inferred);
  const isHighConfidence = inference.confidence >= 0.7;
  const fallbackScrollbarHighlight = snapshot.signals?.expandedCategoryHeaderTarget;
  const forceScrollbarHighlight = snapshot.signals?.usedExpandedVariant3 === true;
  const chosenHighlight =
    !forceScrollbarHighlight && isHighConfidence && collapseHeaderHighlight
      ? collapseHeaderHighlight
      : (fallbackScrollbarHighlight ?? rail.categoryRailRect);

  const instruction = normalizeCategoryLayoutInstruction({
    highlight: chosenHighlight,
    highlightMode: !forceScrollbarHighlight && isHighConfidence && collapseHeaderHighlight
      ? "header"
      : (fallbackScrollbarHighlight ? "scrollbar" : "rail"),
    inferredCategory: inferred ?? undefined,
  });
  return {
    ready: false,
    inferredExpandedCategory: inferred,
    instruction,
  };
}

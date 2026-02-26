import { GuideInstruction, Rect } from "../types.js";

export function pressEscInstruction(): GuideInstruction {
  return {
    message: "Open the options menu (Esc or settings cog icon).",
  };
}

export function clickHeroInstruction(highlight?: Rect): GuideInstruction {
  return {
    message: "Click the highlighted Hero button in the Options menu.",
    highlight,
  };
}

export function clickAchievementsTopTabInstruction(highlight?: Rect): GuideInstruction {
  return {
    message: "Click the highlighted Achievements tab in the Hero window.",
    highlight,
  };
}

export function clickAchievementsSubtabInstruction(highlight?: Rect): GuideInstruction {
  return {
    message: "Click the highlighted Achievements sub-tab icon.",
    highlight,
  };
}

type DisplayPreferenceKey = "show_locked" | "show_completed" | "list_mode";

export function fixDisplayPreferenceInstruction(
  key?: DisplayPreferenceKey,
  highlight?: Rect,
): GuideInstruction {
  if (key === "show_locked") {
    return {
      message: "Enable Show locked (checked) to continue.",
      highlight,
    };
  }
  if (key === "show_completed") {
    return {
      message: "Disable Show completed (unchecked) to continue.",
      highlight,
    };
  }
  if (key === "list_mode") {
    return {
      message: "Disable List mode (unchecked) to continue.",
      highlight,
    };
  }
  return {
    message:
      "Set required display filters: Show locked = checked, Show completed = unchecked, List mode = unchecked.",
    highlight,
  };
}

export function normalizeCategoryLayoutInstruction(options: {
  highlight?: Rect;
  highlightMode: "header" | "rail" | "scrollbar";
  inferredCategory?: string;
}): GuideInstruction {
  const categoryPrefix = options.inferredCategory
    ? `Likely expanded category: ${options.inferredCategory}. `
    : "";
  const message =
    options.highlightMode === "header"
      ? `${categoryPrefix}Click the highlighted category header to collapse it.`
      : options.highlightMode === "scrollbar"
        ? `${categoryPrefix}Category layout is not baseline. Scroll up until the expanded category header is visible, then click it to collapse.`
        : `${categoryPrefix}Category layout is not baseline. Scroll in the highlighted rail area until the expanded category header is visible, then click it to collapse.`;
  return {
    message,
    highlight: options.highlight,
  };
}

export function readyForGuidedScanInstruction(): GuideInstruction {
  return {
    message: "Interface verified... Ripper is ready to begin scanning process.",
  };
}

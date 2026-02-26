import {
  detectHeroButtonInOptions,
  detectOptionsMenu
} from "../detect/options_menu.js";
import {
  detectAchievementsTopTabTarget,
  detectHeroWindow,
  isAchievementsTopTabSelected
} from "../detect/hero_window.js";
import {
  detectAchievementsSubtabTarget,
  isAchievementsSubtabSelected
} from "../detect/achievements_subtab.js";
import {
  clickAchievementsSubtabInstruction,
  clickAchievementsTopTabInstruction,
  clickHeroInstruction,
  fixDisplayPreferenceInstruction,
  pressEscInstruction
} from "../ui/instructions.js";
import { BootstrapResult, CategorySchema, FrameSnapshot } from "../types.js";

type DisplayPreferenceKey = "show_locked" | "show_completed" | "list_mode";

type DisplayPreferenceGateResult = {
  ready: boolean;
  nextPreference?: DisplayPreferenceKey;
  highlight?: { x: number; y: number; width: number; height: number };
};

function evaluateDisplayPreferences(snapshot: FrameSnapshot): DisplayPreferenceGateResult {
  const showLockedEnabled = snapshot.signals?.showLockedEnabled;
  const showCompletedEnabled = snapshot.signals?.showCompletedEnabled;
  const listModeEnabled = snapshot.signals?.listModeEnabled;

  const requirements: Array<{
    key: DisplayPreferenceKey;
    current: boolean | undefined;
    expected: boolean;
    highlight: { x: number; y: number; width: number; height: number } | undefined;
  }> = [
    {
      key: "show_locked",
      current: showLockedEnabled,
      expected: true,
      highlight: snapshot.signals?.showLockedTarget?.rect,
    },
    {
      key: "show_completed",
      current: showCompletedEnabled,
      expected: false,
      highlight: snapshot.signals?.showCompletedTarget?.rect,
    },
    {
      key: "list_mode",
      current: listModeEnabled,
      expected: false,
      highlight: snapshot.signals?.listModeTarget?.rect,
    },
  ];

  for (const setting of requirements) {
    if (setting.current !== undefined && setting.current !== setting.expected) {
      return {
        ready: false,
        nextPreference: setting.key,
        highlight: setting.highlight,
      };
    }
  }

  const allKnown = requirements.every((setting) => setting.current !== undefined);
  const allMatching = requirements.every((setting) => setting.current === setting.expected);
  if (allKnown && allMatching) {
    return { ready: true };
  }

  const firstUnknown = requirements.find((setting) => setting.current === undefined);
  return {
    ready: false,
    nextPreference: firstUnknown?.key,
    highlight: firstUnknown?.highlight,
  };
}

export function runBootstrapStep(
  snapshot: FrameSnapshot,
  schema: CategorySchema,
): BootstrapResult {
  const hero = detectHeroWindow(snapshot);
  if (!hero) {
    const options = detectOptionsMenu(snapshot);
    if (options) {
      const heroTarget = detectHeroButtonInOptions(snapshot);
      return {
        state: "wait_hero_window",
        instruction: clickHeroInstruction(heroTarget?.rect),
      };
    }

    return {
      state: "wait_options_menu",
      instruction: pressEscInstruction(),
    };
  }

  if (!isAchievementsTopTabSelected(snapshot)) {
    const tabTarget = detectAchievementsTopTabTarget(snapshot);
    return {
      state: "wait_achievements_top_tab",
      instruction: clickAchievementsTopTabInstruction(tabTarget?.rect),
    };
  }

  if (!isAchievementsSubtabSelected(snapshot)) {
    const subtabTarget = detectAchievementsSubtabTarget(snapshot);
    return {
      state: "wait_achievements_subtab",
      instruction: clickAchievementsSubtabInstruction(subtabTarget?.rect),
    };
  }

  const displayPreferences = evaluateDisplayPreferences(snapshot);
  if (!displayPreferences.ready) {
    return {
      state: "wait_display_preferences",
      instruction: fixDisplayPreferenceInstruction(
        displayPreferences.nextPreference,
        displayPreferences.highlight,
      ),
    };
  }

  return {
    state: "wait_category_baseline",
    instruction: {
      message: `Achievements sub-tab verified. Starting category normalization (${schema.categories.length} categories expected).`,
    },
  };
}

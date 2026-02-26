import { findUiAnchors } from "../finders/anchor_finders.js";
import { readConstrainedSignals } from "../recognition/constrained_reader.js";
import { CategorySchema, FrameSnapshot, RawFrame } from "../types.js";
import { SnapshotSource } from "./snapshot_source.js";

function nowMs(): number {
  return Date.now();
}

export class GuidedSnapshotSource implements SnapshotSource {
  buildSnapshot(frame: RawFrame, schema: CategorySchema): FrameSnapshot {
    const t0 = nowMs();
    const anchorBundle = findUiAnchors(frame, schema);
    const t1 = nowMs();
    const shouldUseRecognitionFallback = anchorBundle.matchedAnchorNames.length < 3;
    const recognition = shouldUseRecognitionFallback
      ? readConstrainedSignals(frame, schema)
      : {
          lexiconHits: [],
          hasOptionsMenu: false,
          hasHeroWindow: false,
          achievementsTopTabLikelySelected: false,
          achievementsSubtabLikelySelected: false,
          visibleCategories: [],
        };
    const t2 = nowMs();
    const anchorHasOptionsMenu = !!anchorBundle.optionsMenu;
    const anchorHasHeroWindow = !!anchorBundle.heroWindow;

    const mergedSignals = {
      ...frame.precomputedSignals,
      matchedAnchorNames:
        frame.precomputedSignals?.matchedAnchorNames ?? anchorBundle.matchedAnchorNames,
      hasOptionsMenu:
        frame.precomputedSignals?.hasOptionsMenu ?? (anchorHasOptionsMenu || recognition.hasOptionsMenu),
      hasHeroWindow:
        frame.precomputedSignals?.hasHeroWindow ?? (anchorHasHeroWindow || recognition.hasHeroWindow),
      optionsMenuTarget: frame.precomputedSignals?.optionsMenuTarget ?? (anchorBundle.optionsMenu
        ? { rect: anchorBundle.optionsMenu.rect, confidence: anchorBundle.optionsMenu.confidence }
        : undefined),
      heroButtonTarget: frame.precomputedSignals?.heroButtonTarget ?? (anchorBundle.heroButtonInOptions
        ? { rect: anchorBundle.heroButtonInOptions.rect, confidence: anchorBundle.heroButtonInOptions.confidence }
        : undefined),
      heroWindowTarget: frame.precomputedSignals?.heroWindowTarget ?? (anchorBundle.heroWindow
        ? { rect: anchorBundle.heroWindow.rect, confidence: anchorBundle.heroWindow.confidence }
        : undefined),
      achievementsTopTabTarget: frame.precomputedSignals?.achievementsTopTabTarget ?? (anchorBundle.achievementsTopTab
        ? {
            rect: anchorBundle.achievementsTopTab.rect,
            confidence: anchorBundle.achievementsTopTab.confidence,
          }
        : undefined),
      achievementsSubtabTarget: frame.precomputedSignals?.achievementsSubtabTarget ?? (anchorBundle.achievementsSubtab
        ? {
            rect: anchorBundle.achievementsSubtab.rect,
            confidence: anchorBundle.achievementsSubtab.confidence,
          }
        : undefined),
      achievementsTopTabSelected:
        frame.precomputedSignals?.achievementsTopTabSelected ??
        anchorBundle.achievementsTopTabSelected ??
        recognition.achievementsTopTabLikelySelected,
      achievementsSubtabSelected:
        frame.precomputedSignals?.achievementsSubtabSelected ??
        anchorBundle.achievementsSubtabSelected ??
        recognition.achievementsSubtabLikelySelected,
      showLockedEnabled:
        frame.precomputedSignals?.showLockedEnabled ??
        anchorBundle.showLockedEnabled,
      showCompletedEnabled:
        frame.precomputedSignals?.showCompletedEnabled ??
        anchorBundle.showCompletedEnabled,
      listModeEnabled:
        frame.precomputedSignals?.listModeEnabled ??
        anchorBundle.listModeEnabled,
      showLockedTarget:
        frame.precomputedSignals?.showLockedTarget ??
        (anchorBundle.showLockedTarget
          ? { rect: anchorBundle.showLockedTarget, confidence: 0.8 }
          : undefined),
      showCompletedTarget:
        frame.precomputedSignals?.showCompletedTarget ??
        (anchorBundle.showCompletedTarget
          ? { rect: anchorBundle.showCompletedTarget, confidence: 0.8 }
          : undefined),
      listModeTarget:
        frame.precomputedSignals?.listModeTarget ??
        (anchorBundle.listModeTarget
          ? { rect: anchorBundle.listModeTarget, confidence: 0.8 }
          : undefined),
      categoryRailRect: frame.precomputedSignals?.categoryRailRect ?? anchorBundle.categoryRail?.rect,
      categoryHeaderTargets:
        frame.precomputedSignals?.categoryHeaderTargets ?? anchorBundle.categoryHeaderTargets,
      expandedCategoryHeaderTarget:
        frame.precomputedSignals?.expandedCategoryHeaderTarget ??
        anchorBundle.expandedCategoryHeaderTarget,
      usedExpandedVariant3:
        frame.precomputedSignals?.usedExpandedVariant3 ??
        anchorBundle.usedExpandedVariant3,
      inferredExpandedCategory:
        frame.precomputedSignals?.inferredExpandedCategory ??
        anchorBundle.inferredExpandedCategory,
      inferredExpandedCategoryConfidence:
        frame.precomputedSignals?.inferredExpandedCategoryConfidence ??
        anchorBundle.inferredExpandedCategoryConfidence,
      visibleCategories:
        frame.precomputedSignals?.visibleCategories ??
        (anchorBundle.visibleCategories.length ? anchorBundle.visibleCategories : recognition.visibleCategories),
      telemetry: {
        ...frame.precomputedSignals?.telemetry,
        finderMs: t1 - t0,
        recognitionMs: t2 - t1,
        totalMs: t2 - t0,
      },
    };

    return {
      tokens: frame.tokens,
      frameTick: undefined,
      frameTimestampMs: frame.timestampMs,
      signals: mergedSignals,
    };
  }
}


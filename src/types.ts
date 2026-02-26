export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrToken = {
  text: string;
  rect?: Rect;
  confidence?: number;
};

export type CaptureTime = {
  tick: number;
  nowMs: number;
};

export type RawFrame = {
  tokens: OcrToken[];
  image?: ImageData;
  bindHandle?: number;
  precomputedSignals?: SnapshotSignals;
  width?: number;
  height?: number;
  timestampMs: number;
};

export type PerformanceTelemetry = {
  captureMs?: number;
  finderMs?: number;
  recognitionMs?: number;
  fsmMs?: number;
  totalMs?: number;
};

export type SnapshotSignals = {
  hasOptionsMenu?: boolean;
  hasHeroWindow?: boolean;
  matchedAnchorNames?: string[];
  optionsMenuTarget?: DetectedTarget;
  heroButtonTarget?: DetectedTarget;
  heroWindowTarget?: DetectedTarget;
  achievementsTopTabTarget?: DetectedTarget;
  achievementsSubtabTarget?: DetectedTarget;
  achievementsTopTabSelected?: boolean;
  achievementsSubtabSelected?: boolean;
  showLockedEnabled?: boolean;
  showCompletedEnabled?: boolean;
  listModeEnabled?: boolean;
  showLockedTarget?: DetectedTarget;
  showCompletedTarget?: DetectedTarget;
  listModeTarget?: DetectedTarget;
  categoryRailRect?: Rect;
  categoryHeaderTargets?: Partial<Record<PrimaryCategory, Rect>>;
  expandedCategoryHeaderTarget?: Rect;
  usedExpandedVariant3?: boolean;
  visibleCategories?: PrimaryCategory[];
  inferredExpandedCategory?: PrimaryCategory | null;
  inferredExpandedCategoryConfidence?: number;
  telemetry?: PerformanceTelemetry;
};

export type FrameSnapshot = {
  tokens: OcrToken[];
  frameTick?: number;
  frameTimestampMs?: number;
  signals?: SnapshotSignals;
};

export type DetectedTarget = {
  rect: Rect;
  confidence: number;
};

export type PrimaryCategory =
  | "skills"
  | "exploration"
  | "area tasks"
  | "combat"
  | "lore"
  | "activities"
  | "completionist"
  | "feats";

export type BootstrapState =
  | "wait_options_menu"
  | "wait_hero_window"
  | "wait_achievements_top_tab"
  | "wait_achievements_subtab"
  | "wait_display_preferences"
  | "wait_category_baseline"
  | "ready_for_guided_scan";

export type GuideInstruction = {
  message: string;
  highlight?: Rect;
};

export type CategorySchema = {
  categories: Array<{
    name: PrimaryCategory;
    subcategories: string[];
  }>;
};

export type BootstrapResult = {
  state: BootstrapState;
  instruction: GuideInstruction;
};

import * as a1lib from "alt1/base";
import { readTitleFromImage } from "../ocr/index.js";
import { Alt1LiveFrameProvider } from "./alt1_live_frame_provider.js";
import { GuideRuntime, RuntimeUpdate } from "../runtime/guide_runtime.js";
import { CategorySchema } from "../types.js";
import categorySchema from "../../data/category_schema.json";
import achievementsData from "../../data/achievements.json";
import { buildHierarchy } from "./achievement_hierarchy.js";
import { createCategoryCardsView } from "./category_cards_view.js";
import {
  validateProfileCsv,
  createProfile,
  clearAllProfiles,
  saveProfileFromCsvRows,
  getProfile,
  updateProfile,
  listProfiles,
  downloadProfileAsCsv,
} from "../profile/index.js";
import { ACHIEVEMENT_CATEGORY_TO_KEY } from "../profile/profile_constants.js";
import runescoreIconUrl from "../assets/category-icons/RuneScore_icon.png";
import skillsIconUrl from "../assets/category-icons/Skills_achievements_icon.png";
import explorationIconUrl from "../assets/category-icons/Exploration_achievements_icon.png";
import areaTasksIconUrl from "../assets/category-icons/Area_Tasks_achievements_icon.png";
import combatIconUrl from "../assets/category-icons/Combat_achievements_icon.png";
import loreIconUrl from "../assets/category-icons/Lore_achievements_icon.png";
import activitiesIconUrl from "../assets/category-icons/Activities_achievements_icon.png";
import completionistIconUrl from "../assets/category-icons/Completionist_achievements_icon.png";
import featsIconUrl from "../assets/category-icons/Feats_achievements_icon.png";
import achievementPinUrl from "../../data/anchors/dev-samples/achievement_pin.png";

type UiRefs = {
  instructionEl: HTMLElement;
  profileSelectionCardEl: HTMLElement;
  profileErrorEl: HTMLElement;
  profileListItemsEl: HTMLElement;
  profileCreateCardEl: HTMLElement;
  profileNameInputEl: HTMLInputElement;
  profileCreateBtnEl: HTMLElement;
  profileCreateErrorEl: HTMLElement;
  categoryPropertiesCardEl: HTMLElement;
  categoryProgressEl: HTMLElement;
  profileWarningModalEl: HTMLElement;
  profileWarningMessageEl: HTMLElement;
  profileWarningExportBtnEl: HTMLElement;
  profileWarningProceedBtnEl: HTMLElement;
  profileWarningCancelBtnEl: HTMLElement;
  refreshExportButton?: () => Promise<void>;
  onEnterCaptureView?: () => void | Promise<void>;
};

type CategoryProgressItem = {
  key: string;
  label: string;
  iconUrl: string;
};

type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CaptureSelectionState = {
  image: ImageData | null;
  selectedRect: SelectionRect | null;
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
  dragging: boolean;
};

type Alt1TextReadArgs = {
  fontname?: "chat" | "chatmono" | "xpcounter";
  allowgap?: boolean;
};

type PinMatch = {
  x: number;
  y: number;
};

type EncodedTemplate = {
  encoded: string;
  width: number;
  height: number;
};

type VisibleAchievement = {
  id: string;
  title: string;
  confidence: number;
  titleRect: SelectionRect;
};

const parseSessionState = {
  seenIds: new Set<string>(),
  lastVisibleIds: [] as string[],
};

let achievementPinTemplatePromise: Promise<EncodedTemplate | null> | null = null;

const PIN_DEDUP_TOLERANCE_PX = 3;

/** Mutable crop tuning - adjust via dev console inputs for live tweaking */
const cropConfig = {
  rowTopOffset: 6,
  rowHeightFallback: 42,
  titleTopOffset: -1,
  titleHeight: 64,
  titleLeftPad: -47,
  titleRightScrollbarPad: 38,
  titleMinWidth: 60,
};

const EXPECTED_CATEGORY_TOTALS: Record<string, number> = {
  runescore: 44680,
  skills: 985,
  exploration: 240,
  area_tasks: 673,
  combat: 1236,
  lore: 571,
  activities: 180,
  completionist: 8,
  feats: 82,
};

const RUNESCORE_ITEM: CategoryProgressItem = {
  key: "runescore",
  label: "RuneScore",
  iconUrl: runescoreIconUrl,
};

const CATEGORY_PROGRESS_ITEMS: CategoryProgressItem[] = [
  RUNESCORE_ITEM,
  { key: "skills", label: "Skills", iconUrl: skillsIconUrl },
  { key: "exploration", label: "Exploration", iconUrl: explorationIconUrl },
  { key: "area_tasks", label: "Area Tasks", iconUrl: areaTasksIconUrl },
  { key: "combat", label: "Combat", iconUrl: combatIconUrl },
  { key: "lore", label: "Lore", iconUrl: loreIconUrl },
  { key: "activities", label: "Activities", iconUrl: activitiesIconUrl },
  { key: "completionist", label: "Completionist", iconUrl: completionistIconUrl },
  { key: "feats", label: "Feats", iconUrl: featsIconUrl },
];

const CATEGORY_TOTAL_DENOMINATOR = CATEGORY_PROGRESS_ITEMS.filter((item) => item.key !== "runescore").reduce(
  (sum, item) => sum + (EXPECTED_CATEGORY_TOTALS[item.key] ?? 0),
  0,
);
const NUMERATOR_MAX_DIGITS = 5;

function profileHasRecordedCategoryValues(profile: { categoryCompletion?: Record<string, string> }): boolean {
  if (!profile.categoryCompletion) return false;
  return CATEGORY_PROGRESS_ITEMS.some((item) => {
    const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
    const val = profile.categoryCompletion![item.key] ?? `null/${total}`;
    return val !== `null/${total}`;
  });
}

function normalizeNumeratorDigits(raw: string): string {
  // Hard cap: max 4 digits, commas do not count toward the limit.
  return raw.replace(/,/g, "").replace(/\D/g, "").slice(0, NUMERATOR_MAX_DIGITS);
}

/** Filename-safe: a-z, A-Z, 0-9, -, _, space. Max 20 chars. Rejects: \\ / : * ? " < > | */
function validateProfileName(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Profile name is required." };
  if (trimmed.length > 20) return { ok: false, error: "Profile name must be 20 characters or less." };
  const invalid = /[\\/:*?"<>|]/;
  if (invalid.test(trimmed)) {
    return { ok: false, error: "Profile name cannot contain \\ / : * ? \" < > |" };
  }
  const allowed = /^[a-zA-Z0-9\-_\s]+$/;
  if (!allowed.test(trimmed)) {
    return { ok: false, error: "Profile name can only contain letters, numbers, spaces, hyphens, and underscores." };
  }
  return { ok: true };
}

function updateCategoryProgressBar(
  container: HTMLElement,
  key: string,
  numerator: number,
  denominator: number,
): void {
  const fillEl = container.querySelector<HTMLElement>(`.category-progressbar-fill[data-progress-for="${key}"]`);
  const pctEl = container.querySelector<HTMLElement>(`.category-progress-percent[data-progress-pct-for="${key}"]`);
  if (!fillEl) return;
  const ratio = denominator > 0 ? Math.max(0, Math.min(1, numerator / denominator)) : 0;
  const percent = ratio * 100;
  fillEl.style.width = `${Math.round(percent)}%`;
  if (pctEl) {
    const text = Number.isInteger(percent) ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
    pctEl.textContent = text;
  }
}

function loadCategorySchema(): CategorySchema {
  return categorySchema as CategorySchema;
}

function setText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

function normalizeAchievementId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type KnownAchievement = { id: number; title: string };

function buildKnownAchievementsMaps(achievements: Array<KnownAchievement>): {
  map: Map<string, KnownAchievement>;
  mapNoSpaces: Map<string, KnownAchievement>;
  mapAlphanumeric: Map<string, KnownAchievement>;
  collisionKeys: Set<string>;
  collisionKeysAlphanumeric: Set<string>;
} {
  const map = new Map<string, KnownAchievement>();
  const mapNoSpaces = new Map<string, KnownAchievement>();
  const mapAlphanumeric = new Map<string, KnownAchievement>();
  const collisionKeys = new Set<string>();
  const collisionKeysAlphanumeric = new Set<string>();

  for (const a of achievements) {
    const key = normalizeAchievementId(a.title);
    if (key && !map.has(key)) map.set(key, { id: a.id, title: a.title });

    const spaceless = key.replace(/\s/g, "");
    if (spaceless) {
      if (collisionKeys.has(spaceless)) continue;
      if (mapNoSpaces.has(spaceless)) {
        mapNoSpaces.delete(spaceless);
        collisionKeys.add(spaceless);
      } else {
        mapNoSpaces.set(spaceless, { id: a.id, title: a.title });
      }
    }

    const alphanumeric = key.replace(/[^a-z0-9]/g, "");
    if (alphanumeric) {
      if (collisionKeysAlphanumeric.has(alphanumeric)) continue;
      if (mapAlphanumeric.has(alphanumeric)) {
        mapAlphanumeric.delete(alphanumeric);
        collisionKeysAlphanumeric.add(alphanumeric);
      } else {
        mapAlphanumeric.set(alphanumeric, { id: a.id, title: a.title });
      }
    }
  }
  return { map, mapNoSpaces, mapAlphanumeric, collisionKeys, collisionKeysAlphanumeric };
}

function resolveParsedIdToCanonical(
  parsedId: string,
  knownMap: Map<string, KnownAchievement>,
  knownMapNoSpaces: Map<string, KnownAchievement>,
  knownMapAlphanumeric: Map<string, KnownAchievement>,
  collisionKeys: Set<string>,
  collisionKeysAlphanumeric: Set<string>,
): string | null {
  const parsedNorm = normalizeAchievementId(parsedId);
  if (!parsedNorm) return null;
  if (knownMap.has(parsedNorm)) return parsedNorm;

  const withoutTrailingSingle = parsedNorm.replace(/\s+[a-z]$/i, "").trim();
  if (withoutTrailingSingle && knownMap.has(withoutTrailingSingle)) return withoutTrailingSingle;

  const stripped = parsedNorm.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "").trim();
  if (stripped && knownMap.has(stripped)) return stripped;

  const spaceless = parsedNorm.replace(/\s/g, "");
  if (spaceless && !collisionKeys.has(spaceless)) {
    const found = knownMapNoSpaces.get(spaceless);
    if (found) return normalizeAchievementId(found.title);
  }

  const alphanumeric = parsedNorm.replace(/[^a-z0-9]/g, "");
  if (alphanumeric && !collisionKeysAlphanumeric.has(alphanumeric)) {
    const found = knownMapAlphanumeric.get(alphanumeric);
    if (found) return normalizeAchievementId(found.title);
  }

  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
    }
  }
  return d[m][n];
}

function getTopNearestMatches(
  parsedId: string,
  knownAchievements: Array<KnownAchievement>,
  topN: number,
): Array<{ achievement: KnownAchievement; score: number }> {
  const parsedNorm = parsedId.toLowerCase();
  const parsedAlphanumeric = parsedNorm.replace(/[^a-z0-9]/g, "");
  const scored = knownAchievements.map((a) => {
    const knownNorm = normalizeAchievementId(a.title);
    const knownAlphanumeric = knownNorm.replace(/[^a-z0-9]/g, "");
    const dist = Math.min(
      levenshteinDistance(parsedNorm, knownNorm),
      levenshteinDistance(parsedAlphanumeric, knownAlphanumeric),
    );
    const maxLen = Math.max(parsedNorm.length, knownNorm.length, 1);
    const score = 1 - dist / maxLen;
    return { achievement: a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, topN);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function isPlausibleTitleCandidate(value: string): { ok: boolean; reason?: string } {
  const text = value.trim();
  if (text.length < 3) return { ok: false, reason: "too_short" };
  if (text.length > 72) return { ok: false, reason: "too_long" };
  if (/(.)\1{4,}/.test(text.toLowerCase())) return { ok: false, reason: "repeat_run" };
  const bracketCount = (text.match(/[\[\]\(\)\{\}]/g) ?? []).length;
  if (bracketCount / text.length > 0.2) return { ok: false, reason: "bracket_heavy" };
  const alphaChars = text.replace(/[^a-z]/gi, "");
  if (alphaChars.length < 3) return { ok: false, reason: "alpha_sparse" };
  if (alphaChars.length / text.length < 0.45) return { ok: false, reason: "low_alpha_ratio" };
  if (new Set(alphaChars.toLowerCase()).size < 3) return { ok: false, reason: "low_alpha_diversity" };
  return { ok: true };
}

function parseSubImgHits(raw: string | null | undefined): PinMatch[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ x: number; y: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
      .map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));
  } catch {
    return [];
  }
}

function dedupePinMatches(points: PinMatch[], tolerancePx: number): PinMatch[] {
  const sorted = [...points].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const out: PinMatch[] = [];
  for (const point of sorted) {
    const nearby = out.find(
      (existing) =>
        Math.abs(existing.x - point.x) <= tolerancePx &&
        Math.abs(existing.y - point.y) <= tolerancePx,
    );
    if (!nearby) out.push(point);
  }
  return out;
}

async function getAchievementPinTemplate(): Promise<EncodedTemplate | null> {
  if (achievementPinTemplatePromise) return achievementPinTemplatePromise;
  achievementPinTemplatePromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        encoded: a1lib.encodeImageString(data),
        width: data.width,
        height: data.height,
      });
    };
    img.onerror = () => resolve(null);
    img.src = achievementPinUrl;
  });
  return achievementPinTemplatePromise;
}

async function findAchievementPins(rect: SelectionRect, bindId: number): Promise<{ pins: PinMatch[]; pinWidth: number; pinHeight: number }> {
  const template = await getAchievementPinTemplate();
  if (!template || !alt1.bindFindSubImg) return { pins: [], pinWidth: 0, pinHeight: 0 };
  const raw = alt1.bindFindSubImg(
    bindId,
    template.encoded,
    template.width,
    0,
    0,
    rect.width,
    rect.height,
  );
  const localHits = parseSubImgHits(raw);
  const deduped = dedupePinMatches(localHits, PIN_DEDUP_TOLERANCE_PX);
  const absolute = deduped
    .map((hit) => ({ x: rect.x + hit.x, y: rect.y + hit.y }))
    .sort((a, b) => a.y - b.y);
  return { pins: absolute, pinWidth: template.width, pinHeight: template.height };
}

function safeReadBoundString(handle: number, x: number, y: number, args: Alt1TextReadArgs): string {
  try {
    const payload = JSON.stringify(args);
    const raw = (alt1.bindReadStringEx(handle, x, y, payload) ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("{") && raw.includes("\"text\"")) {
      try {
        const parsed = JSON.parse(raw) as { text?: unknown; fragments?: Array<{ text?: unknown }> };
        if (typeof parsed.text === "string") return parsed.text.trim();
        if (Array.isArray(parsed.fragments)) {
          return parsed.fragments
            .map((fragment) => (typeof fragment?.text === "string" ? fragment.text : ""))
            .join("")
            .trim();
        }
      } catch {
        return "";
      }
    }
    return raw;
  } catch {
    return "";
  }
}

function buildRowRectsFromPins(pins: PinMatch[], selectionRect: SelectionRect): SelectionRect[] {
  if (pins.length === 0) return [];
  const deltas = pins
    .slice(1)
    .map((pin, index) => pin.y - pins[index].y)
    .filter((delta) => delta >= 18 && delta <= 120);
  const rowHeight = deltas.length > 0 ? Math.round(median(deltas)) : cropConfig.rowHeightFallback;
  return pins.map((pin) => {
    const y = clamp(pin.y - cropConfig.rowTopOffset, selectionRect.y, selectionRect.y + selectionRect.height - 1);
    const maxHeight = selectionRect.y + selectionRect.height - y;
    return {
      x: selectionRect.x,
      y,
      width: selectionRect.width,
      height: clamp(rowHeight, 1, maxHeight),
    };
  });
}

function buildTitleRectFromPin(pin: PinMatch, selectionRect: SelectionRect, pinWidth: number): SelectionRect {
  const x = clamp(
    pin.x + Math.max(1, pinWidth) + cropConfig.titleLeftPad,
    selectionRect.x,
    selectionRect.x + selectionRect.width - 1,
  );
  const y = clamp(
    pin.y + cropConfig.titleTopOffset,
    selectionRect.y,
    selectionRect.y + selectionRect.height - 1,
  );
  const rightEdge = selectionRect.x + selectionRect.width - cropConfig.titleRightScrollbarPad;
  const maxWidth = Math.max(1, rightEdge - x);
  const width = Math.max(cropConfig.titleMinWidth, maxWidth);
  const maxHeight = selectionRect.y + selectionRect.height - y;
  return {
    x,
    y,
    width: clamp(width, 1, maxWidth),
    height: clamp(cropConfig.titleHeight, 1, maxHeight),
  };
}

function cropImageData(source: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const srcW = source.width;
  const x0 = Math.max(0, Math.min(x, srcW - 1));
  const y0 = Math.max(0, Math.min(y, source.height - 1));
  const w0 = Math.max(1, Math.min(w, srcW - x0));
  const h0 = Math.max(1, Math.min(h, source.height - y0));
  const out = new ImageData(w0, h0);
  for (let row = 0; row < h0; row++) {
    const srcOffset = ((y0 + row) * srcW + x0) * 4;
    const dstOffset = row * w0 * 4;
    out.data.set(source.data.subarray(srcOffset, srcOffset + w0 * 4), dstOffset);
  }
  return out;
}

function imageDataToPngDataUrl(image: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

async function readTitleFromRect(
  fullImage: ImageData,
  titleRect: SelectionRect,
  bindFallback?: { bindId: number; localX: number; localY: number },
  cropOrigin?: { x: number; y: number },
): Promise<{ text: string; source: string; debug?: Record<string, unknown> }> {
  const cropX = cropOrigin ? titleRect.x - cropOrigin.x : titleRect.x;
  const cropY = cropOrigin ? titleRect.y - cropOrigin.y : titleRect.y;
  const image = cropImageData(
    fullImage,
    cropX,
    cropY,
    titleRect.width,
    titleRect.height,
  );
  return readTitleFromImage(image, bindFallback);
}

async function parseSelectedRegion(rect: SelectionRect): Promise<string> {
  if (!a1lib.hasAlt1 || !window.alt1?.rsLinked) {
    return JSON.stringify({ error: "Alt1 with RS linked required for parsing.", rect }, null, 2);
  }
  const rsWidth = window.alt1.rsWidth || 0;
  const rsHeight = window.alt1.rsHeight || 0;
  if (rsWidth <= 0 || rsHeight <= 0) {
    return JSON.stringify({ error: "RuneScape dimensions unavailable.", rect }, null, 2);
  }
  const selectionImgRef = a1lib.captureHold(rect.x, rect.y, rect.width, rect.height);
  const selectionImage = selectionImgRef.toData(rect.x, rect.y, rect.width, rect.height);
  const bindId = selectionImgRef.handle;
  if (!bindId || bindId <= 0) {
    return JSON.stringify({ error: "Unable to bind selected region for parsing.", rect }, null, 2);
  }
  const { pins, pinWidth, pinHeight } = await findAchievementPins(rect, bindId);
  if (pins.length === 0) {
    return JSON.stringify(
      {
        rect,
        error: "No achievement pushpins detected in selection.",
        pins: [],
      },
      null,
      2,
    );
  }
  const rowRects = buildRowRectsFromPins(pins, rect);
  const visibleAchievements: VisibleAchievement[] = [];
  const lines: string[] = [];
  const rejectedCandidates: Array<{ text: string; reason: string; row: number }> = [];
  const seenIds = new Set<string>();
  const ocrFontsUsed: string[] = [];

  const cropOrigin = { x: rect.x, y: rect.y };
  const firstPin = pins[0];
  const firstTitleRect = buildTitleRectFromPin(firstPin, rowRects[0] ?? rect, pinWidth);
  const firstCrop = cropImageData(
    selectionImage,
    firstTitleRect.x - cropOrigin.x,
    firstTitleRect.y - cropOrigin.y,
    firstTitleRect.width,
    firstTitleRect.height,
  );
  const debugFirstCrop = {
    pin: { x: firstPin.x, y: firstPin.y },
    titleRect: { x: firstTitleRect.x, y: firstTitleRect.y, width: firstTitleRect.width, height: firstTitleRect.height },
    titleRectLocal: {
      x: firstTitleRect.x - rect.x,
      y: firstTitleRect.y - rect.y,
      width: firstTitleRect.width,
      height: firstTitleRect.height,
    },
    inspectUrl: imageDataToPngDataUrl(firstCrop),
  };

  let debugOcr: Record<string, unknown> | undefined;
  for (let index = 0; index < pins.length; index++) {
    const pin = pins[index];
    const titleRect = buildTitleRectFromPin(pin, rowRects[index] ?? rect, pinWidth);
    const bindFallback =
      bindId > 0
        ? {
            bindId,
            localX: titleRect.x - rect.x,
            localY: titleRect.y - rect.y,
          }
        : undefined;
    const { text, source, debug: rowDebug } = await readTitleFromRect(
      selectionImage,
      titleRect,
      bindFallback,
      cropOrigin,
    );
    if (!text) {
      if (rowDebug && debugOcr === undefined) {
        debugOcr = { row: index, ...rowDebug };
      }
      continue;
    }
    if (source.startsWith("ocr.") || source.startsWith("bindReadStringEx") || source === "tesseract") {
      ocrFontsUsed.push(source);
    }
    lines.push(text);
    const plausibility = isPlausibleTitleCandidate(text);
    if (!plausibility.ok) {
      rejectedCandidates.push({
        text,
        reason: plausibility.reason ?? "invalid",
        row: index,
      });
      continue;
    }
    const id = normalizeAchievementId(text);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const confidence = source.startsWith("ocr.") ? 0.82 : 0.68;
    visibleAchievements.push({
      id,
      title: text,
      confidence,
      titleRect,
    });
  }

  const visibleIds = visibleAchievements.map((item) => item.id);
  const lastVisibleSet = new Set(parseSessionState.lastVisibleIds);
  const newlyVisibleSinceLastParse = visibleAchievements.filter((item) => !lastVisibleSet.has(item.id));
  const newlySeenInSession = visibleAchievements.filter((item) => !parseSessionState.seenIds.has(item.id));
  for (const id of visibleIds) {
    parseSessionState.seenIds.add(id);
  }
  parseSessionState.lastVisibleIds = visibleIds;

  return JSON.stringify(
    {
      rect,
      pinCount: pins.length,
      pinTemplate: { width: pinWidth, height: pinHeight },
      pins,
      rowRects,
      debugFirstCrop,
      debugOcr,
      ocrFontsUsed: ocrFontsUsed.length > 0 ? ocrFontsUsed : undefined,
      lineCount: lines.length,
      lines,
      visibleAchievementsNow: visibleAchievements,
      newlyVisibleSinceLastParse,
      newlySeenInSession,
      seenCount: parseSessionState.seenIds.size,
      rejectedCandidates,
    },
    null,
    2,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): SelectionRect {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  return {
    x: x0,
    y: y0,
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0),
  };
}

function getCanvasPoint(event: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const width = canvas.width || 1;
  const height = canvas.height || 1;
  const scaleX = width / Math.max(1, rect.width);
  const scaleY = height / Math.max(1, rect.height);
  const x = Math.floor((event.clientX - rect.left) * scaleX);
  const y = Math.floor((event.clientY - rect.top) * scaleY);
  return {
    x: clamp(x, 0, Math.max(0, width - 1)),
    y: clamp(y, 0, Math.max(0, height - 1)),
  };
}

function renderSelectionCanvas(
  canvas: HTMLCanvasElement,
  state: CaptureSelectionState,
  options?: { showFullView?: boolean },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (!state.image) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const rect = state.selectedRect;
  const isZoomed = rect && !options?.showFullView;
  if (isZoomed) {
    const crop = cropImageData(state.image, rect.x, rect.y, rect.width, rect.height);
    if (canvas.width !== crop.width || canvas.height !== crop.height) {
      canvas.width = crop.width;
      canvas.height = crop.height;
    }
    ctx.putImageData(crop, 0, 0);
    if (state.dragging && state.dragStart && state.dragCurrent) {
      const overlayRect = buildRectFromPoints(state.dragStart, state.dragCurrent);
      ctx.save();
      ctx.strokeStyle = "#70aae6";
      ctx.lineWidth = 5;
      ctx.strokeRect(overlayRect.x + 0.5, overlayRect.y + 0.5, overlayRect.width, overlayRect.height);
      ctx.restore();
    }
  } else {
    if (canvas.width !== state.image.width || canvas.height !== state.image.height) {
      canvas.width = state.image.width;
      canvas.height = state.image.height;
    }
    ctx.putImageData(state.image, 0, 0);
    const overlayRect =
      state.dragging && state.dragStart && state.dragCurrent
        ? buildRectFromPoints(state.dragStart, state.dragCurrent)
        : rect;
    if (overlayRect) {
      ctx.save();
      ctx.strokeStyle = "#70aae6";
      ctx.lineWidth = 5;
      ctx.strokeRect(overlayRect.x + 0.5, overlayRect.y + 0.5, overlayRect.width, overlayRect.height);
      ctx.restore();
    }
  }
}

function captureFrameData(infoEl: HTMLElement): ImageData | null {
  if (!a1lib.hasAlt1 || !window.alt1?.rsLinked) {
    setText(infoEl, "Screen capture requires Alt1 with RS window linked.");
    return null;
  }
  const width = window.alt1.rsWidth || 0;
  const height = window.alt1.rsHeight || 0;
  if (width <= 0 || height <= 0) {
    setText(infoEl, "RuneScape dimensions unavailable.");
    return null;
  }
  const t0 = performance.now();
  const imgRef = a1lib.captureHoldFullRs();
  const image = imgRef.toData(0, 0, width, height);
  const ms = Math.round(performance.now() - t0);
  setText(infoEl, `Captured ${width}x${height} in ${ms}ms.`);
  return image;
}

function drawHighlight(update: RuntimeUpdate): void {
  const rect = update.instruction.highlight;
  if (!window.alt1?.permissionOverlay || !rect) return;
  const groupName = "rsripperv2-guide";
  window.alt1.overLaySetGroup(groupName);
  window.alt1.overLayClearGroup(groupName);
  window.alt1.overLaySetGroup(groupName);
  window.alt1.overLaySetGroupZIndex?.(groupName, 1);
  const color = a1lib.mixColor(80, 220, 130, 255);
  // Repaint every update with a medium TTL to avoid visual dropouts.
  window.alt1.overLayRect(color, rect.x, rect.y, rect.width, rect.height, 500, 3);
  window.alt1.overLayRefreshGroup(groupName);
  window.alt1.overLaySetGroup("");
}

async function renderProfileList(
  refs: UiRefs,
  profileState: ProfileState,
): Promise<void> {
  const names = await listProfiles();
  refs.profileListItemsEl.innerHTML = "";
  if (names.length === 0) {
    const empty = document.createElement("div");
    empty.className = "profile-list-empty";
    empty.textContent = "No saved profiles.";
    refs.profileListItemsEl.appendChild(empty);
    return;
  }
  for (const name of names) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profile-list-item";
    btn.textContent = name;
    btn.addEventListener("click", async () => {
      refs.profileErrorEl.classList.add("is-hidden");
      refs.profileErrorEl.textContent = "";
      try {
        const profile = await getProfile(name);
        if (!profile) {
          refs.profileErrorEl.textContent = `Profile "${name}" not found.`;
          refs.profileErrorEl.classList.remove("is-hidden");
          return;
        }
        profileState.currentProfileName = name;
        const values = CATEGORY_PROGRESS_ITEMS.map(
          (item) =>
            profile.categoryCompletion[item.key] ??
            `null/${EXPECTED_CATEGORY_TOTALS[item.key] ?? 0}`,
        );
        setCategoryProgressValues(refs.categoryProgressEl, values);
        proceedToCategoryTable(refs);
        await refs.onEnterCaptureView?.();
        await refs.refreshExportButton?.();
      } catch (err) {
        refs.profileErrorEl.textContent = `Failed to load: ${String(err)}`;
        refs.profileErrorEl.classList.remove("is-hidden");
      }
    });
    refs.profileListItemsEl.appendChild(btn);
  }
}

function renderUpdate(
  refs: UiRefs,
  update: RuntimeUpdate,
  profileState: ProfileState,
): void {
  setText(refs.instructionEl, update.instruction.message);
  drawHighlight(update);
  if (update.phase === "ready") {
    refs.profileSelectionCardEl.classList.remove("is-hidden");
    void renderProfileList(refs, profileState);
  }
}

function proceedToCategoryTable(refs: UiRefs): void {
  refs.profileSelectionCardEl.classList.add("is-hidden");
  refs.profileErrorEl.classList.add("is-hidden");
  refs.profileErrorEl.textContent = "";
  refs.profileCreateCardEl.classList.add("is-hidden");
  refs.profileCreateErrorEl.classList.add("is-hidden");
  refs.profileCreateErrorEl.textContent = "";
  refs.categoryPropertiesCardEl.classList.remove("is-hidden");
}

type ProfileState = { currentProfileName: string | null };

function renderCategoryProgressShell(
  container: HTMLElement,
  profileState: ProfileState,
): { refreshExportButton: () => Promise<void>; onEnterCaptureView: () => void | Promise<void> } {
  const table = document.createElement("table");
  table.className = "category-table";
  const tbody = document.createElement("tbody");
  const globalError = document.createElement("div");
  globalError.className = "category-table-error-global";
  globalError.textContent = "Numerator cannot exceed denominator.";
  const beginScanButton = document.createElement("button");
  beginScanButton.type = "button";
  beginScanButton.className = "scan-completion-btn";
  beginScanButton.textContent = "Begin scanning process";
  beginScanButton.disabled = true;
  const selectionTool = document.createElement("div");
  selectionTool.className = "selection-tool is-hidden";
  const selectionInfoWrap = document.createElement("div");
  selectionInfoWrap.className = "selection-info";
  const captureInfo = document.createElement("div");
  captureInfo.textContent = "Press Begin scanning process to capture.";
  const selectionCoords = document.createElement("div");
  selectionCoords.textContent = "Selection: none";
  selectionInfoWrap.append(captureInfo, selectionCoords);
  const recaptureBtn = document.createElement("button");
  recaptureBtn.type = "button";
  recaptureBtn.className = "selection-recapture-btn";
  recaptureBtn.textContent = "Recapture";
  const clearSelectionBtn = document.createElement("button");
  clearSelectionBtn.type = "button";
  clearSelectionBtn.className = "selection-recapture-btn";
  clearSelectionBtn.textContent = "Clear selection";
  clearSelectionBtn.title = "Remove the selected area from the capture";
  clearSelectionBtn.disabled = true;
  const showFullBtn = document.createElement("button");
  showFullBtn.type = "button";
  showFullBtn.className = "selection-recapture-btn";
  showFullBtn.textContent = "Show full image";
  showFullBtn.title = "Show the full capture with selection overlay";
  showFullBtn.style.display = "none";
  const hidePreviewBtn = document.createElement("button");
  hidePreviewBtn.type = "button";
  hidePreviewBtn.className = "selection-recapture-btn";
  hidePreviewBtn.textContent = "Hide preview";
  hidePreviewBtn.title = "Hide the capture preview";
  const captureScrollShell = document.createElement("div");
  captureScrollShell.className = "selection-capture-scroll-shell";
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "selection-canvas-wrap";
  const captureCanvas = document.createElement("canvas");
  captureCanvas.id = "selection-canvas";
  canvasWrap.appendChild(captureCanvas);
  captureScrollShell.appendChild(canvasWrap);

  const captureOverlay = document.createElement("div");
  captureOverlay.className = "capture-overlay is-hidden";
  captureOverlay.setAttribute("aria-label", "Full-screen capture - draw to select area");
  const overlayCanvasWrap = document.createElement("div");
  overlayCanvasWrap.className = "capture-overlay-canvas-wrap";
  const overlayToolbar = document.createElement("div");
  overlayToolbar.className = "capture-overlay-toolbar";
  const overlayRecaptureBtn = document.createElement("button");
  overlayRecaptureBtn.type = "button";
  overlayRecaptureBtn.className = "selection-recapture-btn";
  overlayRecaptureBtn.textContent = "Recapture";
  const overlayClearBtn = document.createElement("button");
  overlayClearBtn.type = "button";
  overlayClearBtn.className = "selection-recapture-btn";
  overlayClearBtn.textContent = "Clear";
  overlayClearBtn.disabled = true;
  const overlaySwitchBtn = document.createElement("button");
  overlaySwitchBtn.type = "button";
  overlaySwitchBtn.className = "selection-recapture-btn";
  overlaySwitchBtn.textContent = "Switch profile";
  const overlayHint = document.createElement("span");
  overlayHint.className = "capture-overlay-hint";
  overlayHint.textContent = "Draw a rectangle to select the achievement list area";
  overlayToolbar.append(overlayHint, overlayRecaptureBtn, overlayClearBtn, overlaySwitchBtn);
  captureOverlay.append(overlayCanvasWrap, overlayToolbar);
  document.body.appendChild(captureOverlay);
  const selectionConsoleActions = document.createElement("div");
  selectionConsoleActions.className = "selection-console-actions";
  const parseBtn = document.createElement("button");
  parseBtn.type = "button";
  parseBtn.className = "selection-recapture-btn";
  parseBtn.textContent = "Parse selection";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "selection-recapture-btn selection-dev-only";
  copyBtn.textContent = "Copy";
  const expandLogBtn = document.createElement("button");
  expandLogBtn.type = "button";
  expandLogBtn.className = "selection-recapture-btn selection-dev-only";
  expandLogBtn.textContent = "Expand";
  expandLogBtn.title = "Show full parse details";
  selectionConsoleActions.append(parseBtn, copyBtn, expandLogBtn);
  const ocrTuningBtn = document.createElement("button");
  ocrTuningBtn.type = "button";
  ocrTuningBtn.className = "selection-recapture-btn selection-dev-only";
  ocrTuningBtn.textContent = "OCR Tuning";
  const cropTuningWrap = document.createElement("div");
  cropTuningWrap.className = "selection-crop-tuning-wrap selection-dev-only";
  cropTuningWrap.style.display = "none";
  const cropTuningRow = document.createElement("div");
  cropTuningRow.className = "selection-crop-tuning";
  const cropTuningFields: Array<{ key: keyof typeof cropConfig; label: string }> = [
    { key: "rowTopOffset", label: "Row top" },
    { key: "rowHeightFallback", label: "Row height" },
    { key: "titleTopOffset", label: "Title top" },
    { key: "titleHeight", label: "Title height" },
    { key: "titleLeftPad", label: "Title left" },
    { key: "titleRightScrollbarPad", label: "Title right pad" },
    { key: "titleMinWidth", label: "Title min w" },
  ];
  for (const { key, label } of cropTuningFields) {
    const wrap = document.createElement("label");
    wrap.className = "selection-crop-tuning-field";
    const span = document.createElement("span");
    span.textContent = label;
    span.className = "selection-crop-tuning-label";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "selection-crop-tuning-input";
    input.value = String(cropConfig[key]);
    input.addEventListener("change", () => {
      const n = parseInt(input.value, 10);
      if (Number.isFinite(n)) cropConfig[key] = n;
    });
    wrap.append(span, input);
    cropTuningRow.appendChild(wrap);
  }
  cropTuningWrap.appendChild(cropTuningRow);
  ocrTuningBtn.addEventListener("click", () => {
    const isHidden = cropTuningWrap.style.display === "none";
    cropTuningWrap.style.display = isHidden ? "block" : "none";
    ocrTuningBtn.classList.toggle("is-active", isHidden);
  });
  const inspectUrlRow = document.createElement("div");
  inspectUrlRow.className = "selection-inspect-url-row selection-dev-only";
  inspectUrlRow.style.display = "none";
  const inspectUrlInput = document.createElement("input");
  inspectUrlInput.type = "text";
  inspectUrlInput.readOnly = true;
  inspectUrlInput.className = "selection-inspect-url-input";
  inspectUrlInput.placeholder = "Inspect URL (parse first)";
  const copyUrlBtn = document.createElement("button");
  copyUrlBtn.type = "button";
  copyUrlBtn.className = "selection-recapture-btn";
  copyUrlBtn.textContent = "Copy URL";
  inspectUrlRow.append(inspectUrlInput, copyUrlBtn);
  const selectionLog = document.createElement("pre");
  selectionLog.className = "selection-log";
  selectionLog.textContent = "Parsed output will appear here.";
  let lastFullPayload = "";
  let lastSummaryHtml = "";
  const toolbarActionsWrap = document.createElement("div");
  toolbarActionsWrap.className = "selection-toolbar-actions";
  toolbarActionsWrap.append(recaptureBtn, clearSelectionBtn, showFullBtn, hidePreviewBtn);
  const selectionCaptureRight = document.createElement("div");
  selectionCaptureRight.className = "selection-capture-right";
  selectionCaptureRight.append(selectionInfoWrap, captureScrollShell);
  const selectionCaptureMain = document.createElement("div");
  selectionCaptureMain.className = "selection-capture-main";
  selectionCaptureMain.append(toolbarActionsWrap, selectionCaptureRight);
  const parseVerificationPanel = document.createElement("div");
  parseVerificationPanel.className = "parse-verification-panel is-hidden";
  parseVerificationPanel.dataset.devOnly = "true";
  const parseVerificationTitle = document.createElement("div");
  parseVerificationTitle.className = "parse-verification-title";
  parseVerificationTitle.textContent = "Parse verification (dev)";
  const parseVerificationContent = document.createElement("div");
  parseVerificationContent.className = "parse-verification-content";
  parseVerificationPanel.append(parseVerificationTitle, parseVerificationContent);

  const selectionConsole = document.createElement("div");
  selectionConsole.className = "selection-console";
  selectionConsole.append(
    selectionConsoleActions,
    ocrTuningBtn,
    cropTuningWrap,
    inspectUrlRow,
    selectionLog,
    parseVerificationPanel,
  );
  const macroProgressCardsWrap = document.createElement("div");
  macroProgressCardsWrap.className = "macro-progress-cards";
  for (const item of CATEGORY_PROGRESS_ITEMS) {
    const card = document.createElement("div");
    card.className = "macro-progress-card";
    card.dataset.categoryKey = item.key;
    const iconCell = document.createElement("div");
    iconCell.className = "macro-progress-card-cell macro-progress-card-icon-cell";
    const icon = document.createElement("img");
    icon.src = item.iconUrl;
    icon.alt = "";
    icon.className = "macro-progress-card-icon";
    iconCell.appendChild(icon);
    const labelCell = document.createElement("div");
    labelCell.className = "macro-progress-card-cell macro-progress-card-label-cell";
    const label = document.createElement("span");
    label.className = "macro-progress-card-label";
    label.textContent = item.label;
    labelCell.appendChild(label);
    const fractionCell = document.createElement("div");
    fractionCell.className = "macro-progress-card-cell macro-progress-card-fraction-cell";
    const fractionWrap = document.createElement("span");
    fractionWrap.className = "macro-progress-card-fraction-wrap";
    const fraction = document.createElement("span");
    fraction.className = "macro-progress-card-fraction";
    fraction.dataset.progressFor = item.key;
    fraction.textContent = "—/—";
    fractionWrap.append(fraction);
    fractionCell.append(fractionWrap);
    card.append(iconCell, labelCell, fractionCell);
    macroProgressCardsWrap.appendChild(card);
  }
  let macroProgressLastProfile: string | null = null;
  const macroProgressPrevNumerators: Record<string, number> = {};
  const renderMacroProgressCards = async (): Promise<void> => {
    const name = profileState.currentProfileName;
    if (!name) return;
    if (macroProgressLastProfile !== name) {
      macroProgressLastProfile = name;
      Object.keys(macroProgressPrevNumerators).forEach((k) => delete macroProgressPrevNumerators[k]);
    }
    const profile = await getProfile(name);
    if (!profile) return;
    const { achievements } = profile;
    for (const item of CATEGORY_PROGRESS_ITEMS) {
      const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
      let numerator: number;
      if (item.key === "runescore") {
        const runescoreOfFalse = achievements
          .filter((a) => a.complete === false)
          .reduce((s, a) => s + ((a.runescore ?? 0) | 0), 0);
        numerator = total - runescoreOfFalse;
      } else {
        const catLabel = Object.entries(ACHIEVEMENT_CATEGORY_TO_KEY).find(([, v]) => v === item.key)?.[0];
        const falseCount = catLabel
          ? achievements.filter((a) => a.category === catLabel && a.complete === false).length
          : 0;
        numerator = total - falseCount;
      }
      numerator = Math.max(0, numerator);
      const val = `${numerator}/${total}`;
      const fracEl = macroProgressCardsWrap.querySelector<HTMLElement>(
        `[data-progress-for="${item.key}"]`,
      );
      const cardEl = macroProgressCardsWrap.querySelector<HTMLElement>(`[data-category-key="${item.key}"]`);
      const userTargetStr = profile.categoryCompletion[item.key];
      const userTarget =
        userTargetStr && userTargetStr !== `null/${total}`
          ? parseInt(userTargetStr.split("/")[0] ?? "", 10)
          : NaN;
      const targetReached = Number.isFinite(userTarget) && numerator === userTarget;
      if (cardEl) cardEl.classList.toggle("is-target-reached", targetReached);
      const wrapEl = fracEl?.closest(".macro-progress-card-fraction-wrap");
      const prev = macroProgressPrevNumerators[item.key];
      if (fracEl) fracEl.textContent = val;
      if (prev !== undefined && prev !== numerator && wrapEl) {
        const diff = numerator - prev;
        const badge = document.createElement("span");
        badge.className = diff > 0 ? "macro-progress-diff macro-progress-diff-added" : "macro-progress-diff macro-progress-diff-removed";
        badge.textContent = diff > 0 ? `+${diff}` : `${diff}`;
        wrapEl.appendChild(badge);
        badge.addEventListener("animationend", () => badge.remove(), { once: true });
      }
      macroProgressPrevNumerators[item.key] = numerator;
    }
  };
  const selectionCapture = document.createElement("div");
  selectionCapture.className = "selection-capture";
  selectionCapture.append(macroProgressCardsWrap, selectionCaptureMain);
  selectionTool.append(selectionCapture, selectionConsole);
  const selectionState: CaptureSelectionState = {
    image: null,
    selectedRect: null,
    dragStart: null,
    dragCurrent: null,
    dragging: false,
  };
  let showFullView = true;

  const showCaptureOverlay = (): void => {
    overlayCanvasWrap.appendChild(canvasWrap);
    captureOverlay.classList.remove("is-hidden");
    selectionTool.classList.add("capture-overlay-active");
  };
  const hideCaptureOverlay = (): void => {
    captureOverlay.classList.add("is-hidden");
    captureScrollShell.appendChild(canvasWrap);
    selectionTool.classList.remove("capture-overlay-active");
  };

  const renderCanvas = (): void => {
    renderSelectionCanvas(captureCanvas, selectionState, { showFullView });
  };
  const updateSelectionText = (): void => {
    const rect = selectionState.selectedRect;
    clearSelectionBtn.disabled = !rect;
    overlayClearBtn.disabled = !rect;
    showFullBtn.style.display = "none"; /* cropped view only after selection */
    if (!rect) {
      selectionCoords.textContent = "Selection: none";
      return;
    }
    selectionCoords.textContent = `Selection: x=${rect.x}, y=${rect.y}, w=${rect.width}, h=${rect.height}`;
  };
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  };
  const refreshCapture = (): void => {
    const image = captureFrameData(captureInfo);
    if (!image) return;
    const prevRect = selectionState.selectedRect;
    showFullView = !prevRect;
    const scrollEl = canvasWrap.parentElement as HTMLElement | null;
    if (scrollEl) {
      scrollEl.scrollTop = 0;
      scrollEl.scrollLeft = 0;
    }
    selectionState.image = image;
    if (prevRect) {
      const x = clamp(prevRect.x, 0, Math.max(0, image.width - 1));
      const y = clamp(prevRect.y, 0, Math.max(0, image.height - 1));
      const maxWidth = Math.max(1, image.width - x);
      const maxHeight = Math.max(1, image.height - y);
      selectionState.selectedRect = {
        x,
        y,
        width: clamp(prevRect.width, 1, maxWidth),
        height: clamp(prevRect.height, 1, maxHeight),
      };
    } else {
      selectionState.selectedRect = null;
    }
    selectionState.dragStart = null;
    selectionState.dragCurrent = null;
    selectionState.dragging = false;
    updateSelectionText();
    renderCanvas();
  };
  showFullBtn.addEventListener("click", () => {
    showFullView = !showFullView;
    updateSelectionText();
    renderCanvas();
  });
  let previewHidden = false;
  const categoryCard = container.closest("#category-properties-card");
  hidePreviewBtn.addEventListener("click", () => {
    previewHidden = !previewHidden;
    captureScrollShell.classList.toggle("is-hidden", previewHidden);
    selectionTool.classList.toggle("preview-hidden", previewHidden);
    categoryCard?.classList.toggle("preview-hidden", previewHidden);
    hidePreviewBtn.textContent = previewHidden ? "Show preview" : "Hide preview";
    hidePreviewBtn.title = previewHidden ? "Show the capture preview" : "Hide the capture preview";
  });
  let panning = false;
  let lastPanClient: { x: number; y: number } | null = null;

  captureCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  captureCanvas.addEventListener("mousedown", (event) => {
    if (!selectionState.image) return;
    const isZoomed = selectionState.selectedRect && !selectionState.dragging && !showFullView;
    if (event.button === 2) {
      if (isZoomed) return;
      panning = true;
      lastPanClient = { x: event.clientX, y: event.clientY };
      captureCanvas.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    const start = getCanvasPoint(event, captureCanvas);
    selectionState.dragging = true;
    selectionState.dragStart = start;
    selectionState.dragCurrent = start;
    renderCanvas();
  });
  const onPanMove = (event: MouseEvent): void => {
    if (!panning || !lastPanClient) return;
    const dx = event.clientX - lastPanClient.x;
    const dy = event.clientY - lastPanClient.y;
    lastPanClient = { x: event.clientX, y: event.clientY };
    const scrollEl = canvasWrap.parentElement as HTMLElement | null;
    if (scrollEl) {
      scrollEl.scrollLeft -= dx;
      scrollEl.scrollTop -= dy;
    }
  };
  captureCanvas.addEventListener("mousemove", (event) => {
    if (panning && lastPanClient) {
      onPanMove(event);
      return;
    }
    if (!selectionState.dragging || !selectionState.dragStart) return;
    selectionState.dragCurrent = getCanvasPoint(event, captureCanvas);
    renderCanvas();
  });
  window.addEventListener("mousemove", onPanMove);
  window.addEventListener("mouseup", (event) => {
    if (event.button === 2 && panning) {
      panning = false;
      lastPanClient = null;
      captureCanvas.style.cursor = "crosshair";
      return;
    }
    if (event.button !== 0) return;
    if (!selectionState.dragging || !selectionState.dragStart || !selectionState.dragCurrent) return;
    let drawnRect = buildRectFromPoints(selectionState.dragStart, selectionState.dragCurrent);
    const prevRect = selectionState.selectedRect;
    if (prevRect && !showFullView) {
      drawnRect = {
        x: prevRect.x + drawnRect.x,
        y: prevRect.y + drawnRect.y,
        width: drawnRect.width,
        height: drawnRect.height,
      };
      drawnRect.x = clamp(drawnRect.x, prevRect.x, prevRect.x + prevRect.width - 1);
      drawnRect.y = clamp(drawnRect.y, prevRect.y, prevRect.y + prevRect.height - 1);
      const maxW = prevRect.x + prevRect.width - drawnRect.x;
      const maxH = prevRect.y + prevRect.height - drawnRect.y;
      drawnRect.width = clamp(drawnRect.width, 1, maxW);
      drawnRect.height = clamp(drawnRect.height, 1, maxH);
    }
    selectionState.selectedRect = drawnRect;
    selectionState.dragging = false;
    selectionState.dragStart = null;
    selectionState.dragCurrent = null;
    showFullView = false;
    updateSelectionText();
    renderCanvas();
    if (!captureOverlay.classList.contains("is-hidden")) hideCaptureOverlay();
    previewHidden = true;
    captureScrollShell.classList.add("is-hidden");
    selectionTool.classList.add("preview-hidden");
    categoryCard?.classList.add("preview-hidden");
    hidePreviewBtn.textContent = "Show preview";
    hidePreviewBtn.title = "Show the capture preview";
  });
  const actionsRow = document.createElement("div");
  actionsRow.className = "category-table-actions";
  const devModeBtn = document.createElement("button");
  devModeBtn.type = "button";
  devModeBtn.className = "selection-recapture-btn";
  devModeBtn.textContent = "Dev";
  devModeBtn.title = "Toggle dev layout: minimize category table, console above capture";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "selection-recapture-btn";
  exportBtn.textContent = "Export";
  exportBtn.title = "Download profile as CSV";
  exportBtn.classList.add("is-hidden");
  actionsRow.append(beginScanButton, exportBtn, devModeBtn);
  for (const item of CATEGORY_PROGRESS_ITEMS) {
    const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
    const tr = document.createElement("tr");
    tr.dataset.categoryKey = item.key;

    const tdIcon = document.createElement("td");
    tdIcon.className = "category-table-icon";
    const icon = document.createElement("img");
    icon.src = item.iconUrl;
    icon.alt = "";
    tdIcon.appendChild(icon);

    const tdName = document.createElement("td");
    tdName.className = "category-table-name";
    tdName.textContent = item.label;

    const tdProgress = document.createElement("td");
    tdProgress.className = "category-table-progress";
    const progressInline = document.createElement("div");
    progressInline.className = "category-progress-inline";
    const progressPercentEl = document.createElement("span");
    progressPercentEl.className = "category-progress-percent";
    progressPercentEl.dataset.progressPctFor = item.key;
    progressPercentEl.textContent = "0%";
    const progressEl = document.createElement("div");
    progressEl.className = "category-progressbar";
    const progressFillEl = document.createElement("div");
    progressFillEl.className = "category-progressbar-fill";
    progressFillEl.dataset.progressFor = item.key;
    progressEl.appendChild(progressFillEl);
    progressInline.append(progressPercentEl, progressEl);
    tdProgress.appendChild(progressInline);

    const tdValue = document.createElement("td");
    tdValue.className = "category-table-value";
    const valueWrap = document.createElement("div");
    valueWrap.className = "category-table-value-wrap";
    const valueEl = document.createElement("input");
    valueEl.className = "category-table-input";
    valueEl.type = "text";
    valueEl.autocomplete = "off";
    valueEl.dataset.categoryKey = item.key;
    valueEl.dataset.prevValidValue = "x";
    valueEl.value = "x";
    const errorAsterisk = document.createElement("span");
    errorAsterisk.className = "category-table-error-asterisk";
    errorAsterisk.dataset.errorFor = item.key;
    errorAsterisk.textContent = "*";
    const setInvalidUi = (invalid: boolean): void => {
      valueEl.classList.toggle("is-invalid", invalid);
      errorAsterisk.classList.toggle("is-visible", invalid);
      updateCategoryErrorState(container);
    };
    const isOverDenominator = (): boolean => {
      const raw = valueEl.value.trim();
      if (raw === "") return false;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > total;
    };
    valueEl.addEventListener("focus", () => {
      valueEl.dataset.prevValidValue = valueEl.value.trim() || "x";
      if (valueEl.value.trim().toLowerCase() === "x") {
        valueEl.value = "";
      }
      setInvalidUi(false);
      updateBeginScanButtonState(container);
    });
    valueEl.addEventListener("input", () => {
      const digits = normalizeNumeratorDigits(valueEl.value);
      if (digits === "") {
        if (valueEl.value !== "") valueEl.value = "";
        setInvalidUi(false);
        updateCategoryProgressBar(container, item.key, 0, total);
        updateBeginScanButtonState(container);
        return;
      }
      const next = digits;
      if (next !== valueEl.value) {
        valueEl.value = next;
        valueEl.setSelectionRange(valueEl.value.length, valueEl.value.length);
      }
      setInvalidUi(isOverDenominator());
      const n = parseInt(valueEl.value.trim(), 10);
      updateCategoryProgressBar(container, item.key, Number.isFinite(n) ? n : 0, total);
      updateBeginScanButtonState(container);
    });
    valueEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!isOverDenominator()) {
          valueEl.blur();
        } else {
          setInvalidUi(true);
        }
      }
    });
    valueEl.addEventListener("blur", async () => {
      if (valueEl.value.trim() === "") {
        valueEl.value = "x";
        valueEl.dataset.prevValidValue = "x";
        setInvalidUi(false);
        updateCategoryProgressBar(container, item.key, 0, total);
        updateCategoryTotals(container);
        const name = profileState.currentProfileName;
        if (name) {
          const profile = await getProfile(name);
          if (profile) {
            const updated = { ...profile.categoryCompletion, [item.key]: `null/${total}` };
            await updateProfile(name, { categoryCompletion: updated });
            updateExportButtonVisibility();
          }
        }
        return;
      }
      if (isOverDenominator()) {
        valueEl.value = valueEl.dataset.prevValidValue ?? "x";
      }
      valueEl.dataset.prevValidValue = valueEl.value.trim() || "x";
      setInvalidUi(false);
      const n = parseInt(valueEl.value.trim(), 10);
      updateCategoryProgressBar(container, item.key, Number.isFinite(n) ? n : 0, total);
      updateCategoryTotals(container);
      const name = profileState.currentProfileName;
      if (name) {
        const raw = valueEl.value.trim();
        const num = raw === "" || raw.toLowerCase() === "x" ? 0 : parseInt(raw, 10);
        const valueStr = Number.isFinite(num) && num >= 0 ? `${num}/${total}` : `null/${total}`;
        const profile = await getProfile(name);
        if (profile) {
          const updated = { ...profile.categoryCompletion, [item.key]: valueStr };
          await updateProfile(name, { categoryCompletion: updated });
          updateExportButtonVisibility();
        }
      }
    });
    valueEl.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = normalizeNumeratorDigits(e.clipboardData?.getData("text") ?? "");
      if (pasted === "") {
        valueEl.value = "";
        setInvalidUi(false);
        updateCategoryProgressBar(container, item.key, 0, total);
        updateBeginScanButtonState(container);
        return;
      }
      valueEl.value = pasted;
      setInvalidUi(isOverDenominator());
      const n = parseInt(valueEl.value.trim(), 10);
      updateCategoryProgressBar(container, item.key, Number.isFinite(n) ? n : 0, total);
      updateBeginScanButtonState(container);
    });
    valueWrap.append(valueEl, errorAsterisk);
    const denomInline = document.createElement("span");
    denomInline.className = "category-table-denom-inline";
    denomInline.textContent = `/ ${total}`;
    tdValue.append(valueWrap, denomInline);

    tr.append(tdIcon, tdName, tdValue, tdProgress);
    tbody.appendChild(tr);
  }

  const totalRow = document.createElement("tr");
  totalRow.className = "category-table-total-row";

  const totalIconCell = document.createElement("td");
  totalIconCell.className = "category-table-icon";

  const totalNameCell = document.createElement("td");
  totalNameCell.className = "category-table-name";
  totalNameCell.textContent = "Total";

  const totalValueCell = document.createElement("td");
  totalValueCell.className = "category-table-value";
  const totalValue = document.createElement("span");
  totalValue.className = "category-table-total-value";
  totalValue.dataset.totalNumerator = "true";
  totalValue.textContent = "0";
  const totalDenomInline = document.createElement("span");
  totalDenomInline.className = "category-table-denom-inline";
  totalDenomInline.textContent = `/ ${CATEGORY_TOTAL_DENOMINATOR}`;
  totalValueCell.append(totalValue, totalDenomInline);

  const totalProgressCell = document.createElement("td");
  totalProgressCell.className = "category-table-progress";
  const totalProgressInline = document.createElement("div");
  totalProgressInline.className = "category-progress-inline";
  const totalProgressPercentEl = document.createElement("span");
  totalProgressPercentEl.className = "category-progress-percent";
  totalProgressPercentEl.dataset.progressPctFor = "__total__";
  totalProgressPercentEl.textContent = "0%";
  const totalProgressEl = document.createElement("div");
  totalProgressEl.className = "category-progressbar";
  const totalProgressFillEl = document.createElement("div");
  totalProgressFillEl.className = "category-progressbar-fill";
  totalProgressFillEl.dataset.progressFor = "__total__";
  totalProgressEl.appendChild(totalProgressFillEl);
  totalProgressInline.append(totalProgressPercentEl, totalProgressEl);
  totalProgressCell.appendChild(totalProgressInline);

  totalRow.append(totalIconCell, totalNameCell, totalValueCell, totalProgressCell);
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  container.innerHTML = "";

  const categoryCompletionCollapsible = document.createElement("div");
  categoryCompletionCollapsible.className = "category-completion-collapsible";
  const collapsibleHeader = document.createElement("button");
  collapsibleHeader.type = "button";
  collapsibleHeader.className = "category-completion-collapsible-header";
  collapsibleHeader.setAttribute("aria-expanded", "true");
  const collapsibleHeaderText = document.createElement("span");
  collapsibleHeaderText.className = "category-completion-collapsible-title";
  collapsibleHeaderText.textContent = "Category completion";
  const collapsibleChevron = document.createElement("span");
  collapsibleChevron.className = "category-completion-collapsible-chevron";
  collapsibleChevron.textContent = "▼";
  collapsibleHeader.append(collapsibleHeaderText, collapsibleChevron);

  const categoryCompletionBody = document.createElement("div");
  categoryCompletionBody.className = "category-completion-collapsible-body";
  categoryCompletionBody.append(table, globalError);

  categoryCompletionCollapsible.append(collapsibleHeader, categoryCompletionBody);

  collapsibleHeader.addEventListener("click", () => {
    const collapsed = categoryCompletionCollapsible.classList.toggle("is-collapsed");
    collapsibleHeader.setAttribute("aria-expanded", String(!collapsed));
    collapsibleChevron.textContent = collapsed ? "▶" : "▼";
  });

  container.append(categoryCompletionCollapsible, actionsRow, selectionTool);

  let devMode = false;
  const updateExportButtonVisibility = async (): Promise<void> => {
    const name = profileState.currentProfileName;
    if (!name) {
      exportBtn.classList.add("is-hidden");
      return;
    }
    const profile = await getProfile(name);
    if (!profile) {
      exportBtn.classList.add("is-hidden");
      return;
    }
    const hasNonDefault = CATEGORY_PROGRESS_ITEMS.some((item) => {
      const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
      const val = profile.categoryCompletion[item.key];
      return val !== `null/${total}`;
    });
    exportBtn.classList.toggle("is-hidden", !hasNonDefault);
  };

  devModeBtn.addEventListener("click", () => {
    devMode = !devMode;
    container.classList.toggle("dev-mode", devMode);
    selectionTool.classList.toggle("dev-mode", devMode);
    devModeBtn.classList.toggle("is-active", devMode);
    const hasUnknowns = !!parseVerificationContent.querySelector(".parse-verification-unknown-section");
    parseVerificationPanel.classList.toggle("is-hidden", !devMode && !hasUnknowns);
  });
  const enterCaptureView = async (): Promise<void> => {
    const name = profileState.currentProfileName;
    // Do visual transition first (sync) so we never flash the category completion view
    beginScanButton.classList.add("is-hidden");
    selectionTool.classList.remove("is-hidden");
    void renderMacroProgressCards();
    refreshCapture();
    showCaptureOverlay();
    const app = document.getElementById("app");
    if (app) app.classList.add("capture-fullscreen");
    // Persist input values to profile (async, can run after paint)
    if (name) {
      const categoryCompletion: Record<string, string> = {};
      for (const item of CATEGORY_PROGRESS_ITEMS) {
        const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
        const valueEl = container.querySelector<HTMLInputElement>(
          `.category-table-value .category-table-input[data-category-key="${item.key}"]`
        );
        const raw = valueEl?.value.trim() ?? "";
        const n = raw === "" || raw.toLowerCase() === "x" ? 0 : parseInt(raw, 10);
        categoryCompletion[item.key] =
          Number.isFinite(n) && n >= 0 ? `${n}/${total}` : `null/${total}`;
      }
      await updateProfile(name, { categoryCompletion });
      updateExportButtonVisibility();
    }
  };
  beginScanButton.addEventListener("click", () => void enterCaptureView());
  exportBtn.addEventListener("click", async () => {
    const name = profileState.currentProfileName;
    if (!name) return;
    const profile = await getProfile(name);
    if (!profile) return;
    downloadProfileAsCsv(profile);
  });
  recaptureBtn.addEventListener("click", () => {
    refreshCapture();
  });
  overlayRecaptureBtn.addEventListener("click", () => {
    showCaptureOverlay();
    refreshCapture();
  });
  clearSelectionBtn.addEventListener("click", () => {
    selectionState.selectedRect = null;
    selectionState.dragStart = null;
    selectionState.dragCurrent = null;
    selectionState.dragging = false;
    showFullView = true;
    updateSelectionText();
    renderCanvas();
    showCaptureOverlay();
  });
  overlayClearBtn.addEventListener("click", () => {
    selectionState.selectedRect = null;
    selectionState.dragStart = null;
    selectionState.dragCurrent = null;
    selectionState.dragging = false;
    showFullView = true;
    updateSelectionText();
    renderCanvas();
    showCaptureOverlay();
  });
  overlaySwitchBtn.addEventListener("click", () => {
    hideCaptureOverlay();
    document.getElementById("switch-profile-btn")?.click();
  });
  parseBtn.addEventListener("click", () => {
    const rect =
      selectionState.selectedRect ??
      (selectionState.image
        ? { x: 0, y: 0, width: selectionState.image.width, height: selectionState.image.height }
        : null);
    if (!rect) {
      selectionLog.textContent = "No capture. Press Begin scanning process first.";
      inspectUrlRow.style.display = "none";
      return;
    }
    selectionLog.textContent = selectionState.selectedRect
      ? "Parsing selected achievement rows..."
      : "Parsing full capture...";
    inspectUrlRow.style.display = "none";
    void parseSelectedRegion(rect)
      .then(async (payload: string) => {
        lastFullPayload = payload;
        try {
          const parsed = JSON.parse(payload) as {
            lines?: string[];
            error?: string;
            debugFirstCrop?: { inspectUrl?: string };
            visibleAchievementsNow?: Array<{ id: string; title?: string }>;
          };
          if (parsed.error) {
            lastSummaryHtml = "";
            selectionLog.textContent = parsed.error;
            parseVerificationContent.innerHTML = "";
            return;
          }
          const url = parsed.debugFirstCrop?.inspectUrl;
          if (url) {
            inspectUrlInput.value = url;
            inspectUrlRow.style.display = "flex";
          }
          const lines = parsed.lines ?? [];
          const name = profileState.currentProfileName;
          const visibleAchievements = parsed.visibleAchievementsNow ?? [];
          const {
            map: knownMap,
            mapNoSpaces: knownMapNoSpaces,
            mapAlphanumeric: knownMapAlphanumeric,
            collisionKeys,
            collisionKeysAlphanumeric,
          } = buildKnownAchievementsMaps(ACHIEVEMENTS as Array<KnownAchievement>);

          const resolve = (parsedId: string) =>
            resolveParsedIdToCanonical(
              parsedId,
              knownMap,
              knownMapNoSpaces,
              knownMapAlphanumeric,
              collisionKeys,
              collisionKeysAlphanumeric,
            );

          const resolvedIds = new Set<string>();
          for (const a of visibleAchievements) {
            const canonical = resolve(a.id);
            if (canonical) resolvedIds.add(canonical);
          }
          const verified = visibleAchievements.filter((a) => resolve(a.id));
          const unknown = visibleAchievements.filter((a) => !verified.includes(a));

          const profile = name ? await getProfile(name) : null;
          const escapeHtml = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const lineStatuses: Array<{
            display: string;
            verified: boolean;
            profileStatus: string;
            success: boolean;
          }> = [];
          for (let i = 0; i < Math.max(lines.length, visibleAchievements.length); i++) {
            const va = visibleAchievements[i];
            const display = (lines[i] ?? va?.id ?? "").trim() || (va ? `[${va.id}]` : `[line ${i + 1}]`);
            const canonical = va ? resolve(va.id) : null;
            const isVerified = !!canonical;
            let profileStatus: string;
            let success: boolean;
            if (!isVerified) {
              profileStatus = "unverified";
              success = false;
            } else if (!profile) {
              profileStatus = "error";
              success = false;
            } else {
              const pa = profile.achievements.find(
                (a) => normalizeAchievementId(a.title) === canonical,
              );
              if (!pa) {
                profileStatus = "error";
                success = false;
              } else {
                const prev = pa.complete;
                if (prev === null || prev === undefined) {
                  profileStatus = "marked incomplete";
                  success = true;
                } else if (prev === false) {
                  profileStatus = "already marked incomplete";
                  success = true;
                } else {
                  profileStatus = "already complete";
                  success = true;
                }
              }
            }
            lineStatuses.push({ display, verified: isVerified, profileStatus, success });
          }

          const summary =
            lineStatuses.length === 0
              ? "No lines parsed."
              : lineStatuses
                  .map(
                    (s, i) =>
                      `${i + 1}. ${escapeHtml(s.display)} --- ${s.verified ? "verified" : "unverified"} --- ${s.profileStatus} <span class="${s.success ? "selection-log-success" : "selection-log-error"}">${s.success ? "✓" : "✗"}</span>`,
                  )
                  .join("\n");
          lastSummaryHtml = summary;
          selectionLog.innerHTML = summary;
          selectionLog.dataset.expanded = "false";
          expandLogBtn.textContent = "Expand";

          let profileUpdated = 0;
          let completionChanged: Array<{ id: number; title: string; prev: null | boolean }> = [];
          if (name && resolvedIds.size > 0 && profile) {
            const updated = profile.achievements.map((a) => {
              const normalizedTitle = normalizeAchievementId(a.title);
              if (!resolvedIds.has(normalizedTitle)) return a;
              const prevComplete = a.complete;
              if (prevComplete === true) return a;
              if (prevComplete !== false) {
                profileUpdated++;
                completionChanged.push({ id: a.id, title: a.title, prev: prevComplete });
              }
              return { ...a, complete: false as const };
            });
            await updateProfile(name, { achievements: updated });
            updateExportButtonVisibility();
            void renderMacroProgressCards();
          }

          const showVerification = devMode || unknown.length > 0;
          if (showVerification) {
            parseVerificationContent.innerHTML = "";
            const knownSection = document.createElement("div");
            knownSection.className = "parse-verification-section parse-verification-known";
            knownSection.dataset.verifiedCount = String(verified.length);
            knownSection.dataset.totalCount = String(visibleAchievements.length);
            knownSection.innerHTML = `<strong>Known achievements:</strong> ${verified.length}/${visibleAchievements.length} parsed`;
            parseVerificationContent.appendChild(knownSection);
            if (unknown.length > 0) {
              const unknownSection = document.createElement("div");
              unknownSection.className = "parse-verification-unknown-section";
              const achievementsList = ACHIEVEMENTS as Array<KnownAchievement>;
              for (const u of unknown) {
                const row = document.createElement("div");
                row.className = "parse-verification-unknown-row";
                row.dataset.parsedId = u.id;
                const headerLabel = document.createElement("span");
                headerLabel.className = "parse-verification-unknown-label";
                headerLabel.textContent = `Unknown (select match): ${u.title || u.id}`;
                const selectWrap = document.createElement("div");
                selectWrap.className = "parse-verification-unknown-select-wrap";
                const select = document.createElement("select");
                select.className = "parse-verification-unknown-select";
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = "Choose match...";
                select.appendChild(placeholder);
                const top5 = getTopNearestMatches(u.id, achievementsList, 5);
                for (const { achievement } of top5) {
                  const opt = document.createElement("option");
                  opt.value = String(achievement.id);
                  opt.textContent = `#${achievement.id} ${achievement.title}`;
                  opt.setAttribute("data-canonical", normalizeAchievementId(achievement.title));
                  select.appendChild(opt);
                }
                const submitBtn = document.createElement("button");
                submitBtn.type = "button";
                submitBtn.className = "parse-verification-unknown-submit";
                submitBtn.textContent = "Submit";
                submitBtn.style.display = "none";
                submitBtn.addEventListener("click", async () => {
                  const val = select.value;
                  if (!val || !name) return;
                  const opt = select.selectedOptions[0];
                  const canonical = opt?.getAttribute("data-canonical");
                  if (!canonical) return;
                  const profile = await getProfile(name);
                  if (!profile) return;
                  const achievement = profile.achievements.find(
                    (a) => normalizeAchievementId(a.title) === canonical,
                  );
                  if (!achievement) return;
                  const prevComplete = achievement.complete;
                  const updated = profile.achievements.map((a) => {
                    if (normalizeAchievementId(a.title) !== canonical) return a;
                    if (a.complete === true) return a;
                    return { ...a, complete: false as const };
                  });
                  try {
                    await updateProfile(name, { achievements: updated });
                  } catch {
                    return;
                  }
                  updateExportButtonVisibility();
                  void renderMacroProgressCards();

                  const lineIndex = visibleAchievements.findIndex((va) => va.id === u.id);
                  if (lineIndex >= 0 && selectionLog.dataset.expanded !== "true") {
                    const display = (lines[lineIndex] ?? u.id ?? "").trim() || u.id;
                    const profileStatus =
                      prevComplete === null || prevComplete === undefined
                        ? "marked incomplete"
                        : prevComplete === false
                          ? "already marked incomplete"
                          : "already complete";
                    const newLine = `${lineIndex + 1}. ${escapeHtml(display)} --- verified --- ${profileStatus} <span class="selection-log-success">✓</span>`;
                    const summaryLines = lastSummaryHtml.split("\n");
                    if (lineIndex < summaryLines.length) {
                      summaryLines[lineIndex] = newLine;
                      lastSummaryHtml = summaryLines.join("\n");
                      selectionLog.innerHTML = lastSummaryHtml;
                    }
                  }

                  const knownEl = parseVerificationContent.querySelector(".parse-verification-known") as HTMLElement | null;
                  if (knownEl) {
                    const current = parseInt(knownEl.dataset.verifiedCount ?? "0", 10) + 1;
                    const total = knownEl.dataset.totalCount ?? "0";
                    knownEl.dataset.verifiedCount = String(current);
                    knownEl.innerHTML = `<strong>Known achievements:</strong> ${current}/${total} parsed`;
                  }

                  row.remove();
                  const unknownSectionEl = parseVerificationContent.querySelector(
                    ".parse-verification-unknown-section",
                  );
                  if (
                    unknownSectionEl &&
                    !unknownSectionEl.querySelector(".parse-verification-unknown-row")
                  ) {
                    unknownSectionEl.remove();
                    if (!container.classList.contains("dev-mode")) {
                      parseVerificationPanel.classList.add("is-hidden");
                    }
                  }

                  const profileEl = parseVerificationContent.querySelector(".parse-verification-profile") as HTMLElement | null;
                  if (profileEl) {
                    const current = parseInt(profileEl.dataset.updatedCount ?? "0", 10) + 1;
                    profileEl.dataset.updatedCount = String(current);
                    profileEl.innerHTML = `<strong>Profile completion → false:</strong> ${current} achievements (checked vs "${name}")`;
                  }

                  const changedListEl = parseVerificationContent.querySelector(".parse-verification-changed");
                  if (changedListEl) {
                    const li = document.createElement("li");
                    li.textContent = `#${achievement.id} ${achievement.title} (was null)`;
                    changedListEl.appendChild(li);
                  }

                  select.disabled = true;
                  submitBtn.style.display = "none";
                });
                select.addEventListener("change", () => {
                  submitBtn.style.display = select.value ? "inline-block" : "none";
                });
                selectWrap.append(select, submitBtn);
                row.append(headerLabel, selectWrap);
                unknownSection.appendChild(row);
              }
              parseVerificationContent.appendChild(unknownSection);
            }
            const profileSection = document.createElement("div");
            profileSection.className = "parse-verification-section parse-verification-profile";
            profileSection.dataset.updatedCount = String(profileUpdated);
            const profileLabel = name
              ? `<strong>Profile completion → false:</strong> ${profileUpdated} achievements (checked vs "${name}")`
              : `<strong>Profile:</strong> No profile loaded`;
            profileSection.innerHTML = profileLabel;
            parseVerificationContent.appendChild(profileSection);
            const changedList = document.createElement("ul");
            changedList.className = "parse-verification-changed";
            for (const c of completionChanged) {
              const li = document.createElement("li");
              li.textContent = `#${c.id} ${c.title} (was ${c.prev === true ? "true" : "null"})`;
              changedList.appendChild(li);
            }
            parseVerificationContent.appendChild(changedList);
            parseVerificationPanel.classList.toggle("is-hidden", !showVerification);
          } else {
            parseVerificationPanel.classList.add("is-hidden");
          }
        } catch {
          lastSummaryHtml = "";
          selectionLog.textContent = payload;
        }
      })
      .catch((error) => {
        lastSummaryHtml = "";
        selectionLog.textContent = JSON.stringify(
          { error: `Parse failed: ${String(error)}` },
          null,
          2,
        );
      });
  });
  copyUrlBtn.addEventListener("click", () => {
    const url = inspectUrlInput.value.trim();
    if (!url) return;
    void copyToClipboard(url).then((ok) => {
      copyUrlBtn.textContent = ok ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        copyUrlBtn.textContent = "Copy URL";
      }, 1000);
    });
  });
  copyBtn.addEventListener("click", () => {
    void copyToClipboard(selectionLog.textContent || "").then((ok) => {
      copyBtn.textContent = ok ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1000);
    });
  });
  expandLogBtn.addEventListener("click", () => {
    if (!lastFullPayload) return;
    const isExpanded = selectionLog.dataset.expanded === "true";
    if (isExpanded) {
      selectionLog.innerHTML = lastSummaryHtml || "No lines parsed.";
      selectionLog.dataset.expanded = "false";
      expandLogBtn.textContent = "Expand";
    } else {
      try {
        const parsed = JSON.parse(lastFullPayload) as { debugFirstCrop?: { inspectUrl?: string } };
        const forDisplay = { ...parsed };
        if (forDisplay.debugFirstCrop && "inspectUrl" in forDisplay.debugFirstCrop) {
          const { inspectUrl: _, ...rest } = forDisplay.debugFirstCrop;
          forDisplay.debugFirstCrop = rest;
        }
        selectionLog.textContent = JSON.stringify(forDisplay, null, 2);
      } catch {
        selectionLog.textContent = lastFullPayload;
      }
      selectionLog.dataset.expanded = "true";
      expandLogBtn.textContent = "Collapse";
    }
  });
  updateCategoryErrorState(container);
  updateCategoryTotals(container);
  updateBeginScanButtonState(container);

  return { refreshExportButton: updateExportButtonVisibility, onEnterCaptureView: enterCaptureView };
}

function setCategoryProgressValues(container: HTMLElement, values: string[]): void {
  for (let i = 0; i < CATEGORY_PROGRESS_ITEMS.length; i++) {
    const key = CATEGORY_PROGRESS_ITEMS[i].key;
    const valueEl = container.querySelector<HTMLInputElement>(`.category-table-value .category-table-input[data-category-key="${key}"]`);
    if (!valueEl) continue;
    const v = values[i];
    if (!v || v === "Pending") {
      valueEl.value = "x";
      const total = EXPECTED_CATEGORY_TOTALS[key] ?? 0;
      updateCategoryProgressBar(container, key, 0, total);
      continue;
    }
    const slash = v.indexOf("/");
    const num = slash >= 0 ? v.slice(0, slash).trim() : v.trim();
    const n = parseInt(normalizeNumeratorDigits(num), 10);
    const total = EXPECTED_CATEGORY_TOTALS[key] ?? 0;
    const next = Number.isFinite(n) ? Math.max(0, n) : 0;
    valueEl.value = next > 0 ? String(next) : "x";
    valueEl.dataset.prevValidValue = next <= total ? (next > 0 ? String(next) : "x") : "x";
    valueEl.classList.remove("is-invalid");
    updateCategoryProgressBar(container, key, next, total);
    const asterisk = container.querySelector<HTMLElement>(`.category-table-error-asterisk[data-error-for="${key}"]`);
    if (asterisk) asterisk.classList.remove("is-visible");
  }
  updateCategoryErrorState(container);
  updateCategoryTotals(container);
}

function updateCategoryErrorState(container: HTMLElement): void {
  const anyInvalid = Boolean(container.querySelector(".category-table-value .category-table-input.is-invalid"));
  const globalError = container.querySelector<HTMLElement>(".category-table-error-global");
  if (globalError) {
    globalError.classList.toggle("is-visible", anyInvalid);
  }
}

function updateBeginScanButtonState(container: HTMLElement): void {
  const button = container.querySelector<HTMLButtonElement>(".scan-completion-btn");
  if (!button) return;
  const allValid = CATEGORY_PROGRESS_ITEMS.every((item) => {
    const valueEl = container.querySelector<HTMLInputElement>(
      `.category-table-value .category-table-input[data-category-key="${item.key}"]`,
    );
    if (!valueEl) return false;
    const raw = valueEl.value.trim();
    if (raw === "" || raw.toLowerCase() === "x") return false;
    if (!/^\d+$/.test(raw)) return false;
    const n = parseInt(raw, 10);
    const total = EXPECTED_CATEGORY_TOTALS[item.key] ?? 0;
    return Number.isFinite(n) && n >= 0 && n <= total;
  });
  button.classList.toggle("is-ready", allValid);
  button.disabled = !allValid;
}

function updateCategoryTotals(container: HTMLElement): void {
  let numeratorSum = 0;
  for (const item of CATEGORY_PROGRESS_ITEMS) {
    const valueEl = container.querySelector<HTMLInputElement>(
      `.category-table-value .category-table-input[data-category-key="${item.key}"]`,
    );
    const raw = (valueEl?.value ?? "").trim();
    const n = parseInt(raw, 10);
    const numerator = Number.isFinite(n) ? n : 0;
    if (item.key !== "runescore") numeratorSum += numerator;
    updateCategoryProgressBar(container, item.key, numerator, EXPECTED_CATEGORY_TOTALS[item.key] ?? 0);
  }
  const totalEl = container.querySelector<HTMLElement>('[data-total-numerator="true"]');
  if (totalEl) {
    totalEl.textContent = String(numeratorSum);
  }
  updateCategoryProgressBar(container, "__total__", numeratorSum, CATEGORY_TOTAL_DENOMINATOR);
  updateBeginScanButtonState(container);
}

function createUiRefs(): UiRefs {
  const instructionEl = document.getElementById("instruction");
  const profileSelectionCardEl = document.getElementById("profile-selection-card");
  const profileErrorEl = document.getElementById("profile-error");
  const profileListItemsEl = document.getElementById("profile-list-items");
  const profileCreateCardEl = document.getElementById("profile-create-card");
  const profileNameInputEl = document.getElementById("profile-name-input");
  const profileCreateBtnEl = document.getElementById("profile-create-btn");
  const profileCreateErrorEl = document.getElementById("profile-create-error");
  const categoryPropertiesCardEl = document.getElementById("category-properties-card");
  const categoryProgressEl = document.getElementById("category-progress");
  const profileWarningModalEl = document.getElementById("profile-warning-modal");
  const profileWarningMessageEl = document.getElementById("profile-warning-message");
  const profileWarningExportBtnEl = document.getElementById("profile-warning-export-btn");
  const profileWarningProceedBtnEl = document.getElementById("profile-warning-proceed-btn");
  const profileWarningCancelBtnEl = document.getElementById("profile-warning-cancel-btn");
  if (
    !instructionEl ||
    !profileSelectionCardEl ||
    !profileErrorEl ||
    !profileListItemsEl ||
    !profileCreateCardEl ||
    !profileNameInputEl ||
    !(profileNameInputEl instanceof HTMLInputElement) ||
    !profileCreateBtnEl ||
    !profileCreateErrorEl ||
    !categoryPropertiesCardEl ||
    !categoryProgressEl ||
    !profileWarningModalEl ||
    !profileWarningMessageEl ||
    !profileWarningExportBtnEl ||
    !profileWarningProceedBtnEl ||
    !profileWarningCancelBtnEl
  ) {
    throw new Error("Missing required UI elements in index.html");
  }
  return {
    instructionEl,
    profileSelectionCardEl,
    profileErrorEl,
    profileListItemsEl,
    profileCreateCardEl,
    profileNameInputEl,
    profileCreateBtnEl,
    profileCreateErrorEl,
    categoryPropertiesCardEl,
    categoryProgressEl,
    profileWarningModalEl,
    profileWarningMessageEl,
    profileWarningExportBtnEl,
    profileWarningProceedBtnEl,
    profileWarningCancelBtnEl,
  };
}

function runtimeStatusText(): string {
  if (!a1lib.hasAlt1) return "Not running inside Alt1 runtime.";
  if (!window.alt1?.permissionPixel) return "Alt1 pixel permission is required.";
  if (!window.alt1?.permissionOverlay) return "Alt1 overlay permission is required.";
  if (!window.alt1?.rsLinked) return "RuneScape window not linked. Focus RS and keep Alt1 attached.";
  return "Live capture connected.";
}

const ACHIEVEMENTS = (achievementsData as { achievements: Array<Record<string, unknown>> }).achievements;

export async function bootLivePluginApp(): Promise<void> {
  const refs = createUiRefs();
  const profileState: ProfileState = { currentProfileName: null };
  const { refreshExportButton, onEnterCaptureView } = renderCategoryProgressShell(
    refs.categoryProgressEl,
    profileState,
  );
  refs.refreshExportButton = refreshExportButton;
  refs.onEnterCaptureView = onEnterCaptureView;
  const schema = loadCategorySchema();

  const categoryLabels: Record<string, string> = {};
  for (const item of CATEGORY_PROGRESS_ITEMS) {
    if (item.key !== "runescore") categoryLabels[item.key] = item.label;
  }
  const categoryIcons: Record<string, string> = {};
  for (const item of CATEGORY_PROGRESS_ITEMS) {
    if (item.key !== "runescore") categoryIcons[item.key] = item.iconUrl;
  }
  const achievementsList = (achievementsData as { achievements: Array<Record<string, unknown>> })
    .achievements as Array<{
    id: number;
    title: string;
    category: string;
    subcategory: string;
    subsubcategory: string | null;
    runescore: number | null;
  }>;
  const hierarchy = buildHierarchy(achievementsList, schema, categoryLabels);

  const cardsContainer = document.getElementById("category-cards-container");
  const viewProgressBtn = document.getElementById("view-progress-btn");
  const viewBrowseBtn = document.getElementById("view-browse-btn");

  let profileAchievementsMap = new Map<number, { complete: null | boolean }>();
  const refreshProfileAchievementsMap = async (): Promise<void> => {
    profileAchievementsMap = new Map();
    const name = profileState.currentProfileName;
    if (!name) return;
    const profile = await getProfile(name);
    if (!profile) return;
    for (const a of profile.achievements) {
      profileAchievementsMap.set(a.id, { complete: a.complete });
    }
  };

  const switchToProgressView = (): void => {
    if (viewProgressBtn && viewBrowseBtn && refs.categoryProgressEl && cardsContainer) {
      viewProgressBtn.classList.add("is-active");
      viewBrowseBtn.classList.remove("is-active");
      refs.categoryProgressEl.classList.remove("is-hidden");
      cardsContainer.classList.add("is-hidden");
    }
  };

  const cardsView =
    cardsContainer &&
    createCategoryCardsView(
      cardsContainer,
      hierarchy,
      categoryIcons,
      () => profileAchievementsMap,
      switchToProgressView,
    );

  if (cardsView) {
    cardsView.render();
  }

  if (viewProgressBtn && viewBrowseBtn && refs.categoryProgressEl && cardsContainer) {
    viewProgressBtn.addEventListener("click", switchToProgressView);
    viewBrowseBtn.addEventListener("click", async () => {
      viewBrowseBtn.classList.add("is-active");
      viewProgressBtn.classList.remove("is-active");
      refs.categoryProgressEl.classList.add("is-hidden");
      cardsContainer.classList.remove("is-hidden");
      await refreshProfileAchievementsMap();
      if (cardsView) cardsView.render();
    });
  }
  const provider = new Alt1LiveFrameProvider();
  const runtime = new GuideRuntime({
    provider,
    schema,
    maxFps: 60,
  });

  setText(refs.instructionEl, runtimeStatusText());

  const welcomeLoadingEl = document.getElementById("welcome-loading");
  const savedProfiles = await listProfiles();
  const hasProfiles = savedProfiles.length > 0;

  if (hasProfiles) {
    if (welcomeLoadingEl) welcomeLoadingEl.remove();
    refs.profileSelectionCardEl.classList.remove("is-hidden");
    void renderProfileList(refs, profileState);
  } else if (welcomeLoadingEl) {
    window.setTimeout(() => {
      welcomeLoadingEl.classList.add("is-dismissed");
      welcomeLoadingEl.addEventListener(
        "animationend",
        () => welcomeLoadingEl.remove(),
        { once: true },
      );
    }, 3000);
  }

  const switchProfileBtn = document.getElementById("switch-profile-btn");
  if (switchProfileBtn) {
    switchProfileBtn.addEventListener("click", () => {
      document.getElementById("app")?.classList.remove("capture-fullscreen");
      refs.categoryPropertiesCardEl.classList.add("is-hidden");
      refs.profileSelectionCardEl.classList.remove("is-hidden");
      void renderProfileList(refs, profileState);
    });
  }

  type PendingAction = "load" | "fresh";
  let pendingProceed: (() => void | Promise<void>) | null = null;
  let pendingProfileNames: string[] = [];

  const hideProfileWarningModal = (): void => {
    refs.profileWarningModalEl.classList.add("is-hidden");
    pendingProceed = null;
    pendingProfileNames = [];
  };

  const showProfileWarningModal = (
    action: PendingAction,
    profileNames: string[],
    onProceed: () => void | Promise<void>,
  ): void => {
    const actionLabel = action === "load" ? "Load Profile" : "Start Fresh";
    const profileText =
      profileNames.length === 0
        ? "your saved profiles"
        : profileNames.length === 1
          ? profileNames[0]
          : `all profiles (${profileNames.join(", ")})`;
    refs.profileWarningMessageEl.textContent = `${actionLabel} will erase the progress on ${profileText}!`;
    refs.profileWarningModalEl.classList.remove("is-hidden");
    pendingProceed = onProceed;
    pendingProfileNames = [...profileNames];
  };

  refs.profileWarningExportBtnEl.addEventListener("click", async () => {
    const proceed = pendingProceed;
    if (!proceed) return;
    for (let i = 0; i < pendingProfileNames.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 100));
      const profile = await getProfile(pendingProfileNames[i]);
      if (profile) downloadProfileAsCsv(profile);
    }
    hideProfileWarningModal();
    await proceed();
  });
  refs.profileWarningProceedBtnEl.addEventListener("click", async () => {
    const proceed = pendingProceed;
    if (!proceed) return;
    hideProfileWarningModal();
    await proceed();
  });
  refs.profileWarningCancelBtnEl.addEventListener("click", () => {
    hideProfileWarningModal();
  });
  refs.profileWarningModalEl.querySelector(".modal-backdrop")?.addEventListener("click", () => {
    hideProfileWarningModal();
  });

  const doFreshFlow = async (): Promise<void> => {
    refs.profileSelectionCardEl.classList.add("is-hidden");
    refs.profileErrorEl.classList.add("is-hidden");
    refs.profileErrorEl.textContent = "";
    refs.profileCreateCardEl.classList.remove("is-hidden");
    refs.profileCreateErrorEl.classList.add("is-hidden");
    refs.profileCreateErrorEl.textContent = "";
    refs.profileNameInputEl.value = "";
    refs.profileNameInputEl.focus();
  };

  const loadBtn = document.getElementById("profile-load-btn");
  const freshBtn = document.getElementById("profile-fresh-btn");
  const profileCreateBtn = refs.profileCreateBtnEl;
  if (loadBtn && freshBtn) {
    freshBtn.addEventListener("click", async () => {
      const savedNames = await listProfiles();
      if (savedNames.length > 0) {
        showProfileWarningModal("fresh", savedNames, () => void doFreshFlow());
        return;
      }
      void doFreshFlow();
    });
    refs.profileNameInputEl.addEventListener("input", () => {
      const val = refs.profileNameInputEl.value;
      const filtered = val.replace(/[\\/:*?"<>|]/g, "").slice(0, 20);
      if (filtered !== val) refs.profileNameInputEl.value = filtered;
    });
    const profileCreateBackBtn = document.getElementById("profile-create-back-btn");
    if (profileCreateBackBtn) {
      profileCreateBackBtn.addEventListener("click", () => {
        refs.profileCreateCardEl.classList.add("is-hidden");
        refs.profileCreateErrorEl.classList.add("is-hidden");
        refs.profileCreateErrorEl.textContent = "";
        refs.profileNameInputEl.value = "";
        refs.profileSelectionCardEl.classList.remove("is-hidden");
        void renderProfileList(refs, profileState);
      });
    }
    profileCreateBtn.addEventListener("click", async () => {
      refs.profileCreateErrorEl.classList.add("is-hidden");
      refs.profileCreateErrorEl.textContent = "";
      const name = refs.profileNameInputEl.value.trim();
      const result = validateProfileName(name);
      if (!result.ok) {
        refs.profileCreateErrorEl.textContent = result.error;
        refs.profileCreateErrorEl.classList.remove("is-hidden");
        return;
      }
      try {
        await clearAllProfiles();
        await createProfile(name);
        profileState.currentProfileName = name;
        proceedToCategoryTable(refs);
      } catch (err) {
        refs.profileCreateErrorEl.textContent = `Failed to create profile: ${String(err)}`;
        refs.profileCreateErrorEl.classList.remove("is-hidden");
      }
    });
    const doLoadFlow = async (): Promise<void> => {
      refs.profileErrorEl.classList.add("is-hidden");
      refs.profileErrorEl.textContent = "";
      if (typeof showOpenFilePicker !== "function") {
        refs.profileErrorEl.textContent = "File picker not available in this browser.";
        refs.profileErrorEl.classList.remove("is-hidden");
        return;
      }
      try {
        const [fileHandle] = await showOpenFilePicker({
          types: [{ accept: { "text/csv": [".csv"] } }],
          multiple: false,
        });
        const file = await fileHandle.getFile();
        const fileName = file.name;
        const nameLower = fileName.toLowerCase();
        if (!nameLower.endsWith(".csv")) {
          refs.profileErrorEl.textContent = "File must be a CSV (.csv extension).";
          refs.profileErrorEl.classList.remove("is-hidden");
          return;
        }
        const profileName = fileName.slice(0, -4).trim() || "imported";
        const content = await file.text();
        const achievements = ACHIEVEMENTS as Array<{
          id: number;
          title: string;
          category: string;
          subcategory: string;
          subsubcategory: string | null;
          runescore: number | null;
          combat_mastery_tier: number | null;
          parent_id: number | null;
          secret: boolean;
        }>;
        const result = validateProfileCsv(content, achievements);
        if (!result.ok) {
          refs.profileErrorEl.textContent = result.errors.join(" ");
          refs.profileErrorEl.classList.remove("is-hidden");
          return;
        }
        await clearAllProfiles();
        await saveProfileFromCsvRows(profileName, result.rows);
        profileState.currentProfileName = profileName;
        const profile = await getProfile(profileName);
        if (profile) {
          const values = CATEGORY_PROGRESS_ITEMS.map(
            (item) =>
              profile.categoryCompletion[item.key] ??
              `null/${EXPECTED_CATEGORY_TOTALS[item.key] ?? 0}`,
          );
          setCategoryProgressValues(refs.categoryProgressEl, values);
        }
        proceedToCategoryTable(refs);
        await refs.refreshExportButton?.();
        if (profile && profileHasRecordedCategoryValues(profile)) {
          await refs.onEnterCaptureView?.();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        refs.profileErrorEl.textContent = `Failed to load: ${String(err)}`;
        refs.profileErrorEl.classList.remove("is-hidden");
      }
    };

    loadBtn.addEventListener("click", async () => {
      const savedNames = await listProfiles();
      if (savedNames.length > 0) {
        showProfileWarningModal("load", savedNames, () => void doLoadFlow());
        return;
      }
      await doLoadFlow();
    });
  }

  let stopped = false;
  let timer: number | null = null;
  let unsubscribe: (() => void) | null = null;

  const stopRuntimeLoop = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  if (!hasProfiles) {
    unsubscribe = runtime.subscribe((update) => {
      renderUpdate(refs, update, profileState);
      if (update.phase === "ready") {
        stopRuntimeLoop();
      }
    }, 50);

    timer = window.setInterval(() => {
      runtime.pollOnce().catch((err) => {
        setText(refs.instructionEl, `Runtime error: ${String(err)}`);
      });
    }, 16);
  }

  window.addEventListener("beforeunload", () => {
    stopRuntimeLoop();
    if (window.alt1?.permissionOverlay) {
      window.alt1.overLayClearGroup("rsripperv2-guide");
    }
  });
}


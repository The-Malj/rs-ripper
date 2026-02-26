import type { ProfileFile } from "./profile_types.js";
import { CATEGORY_TOTALS, ACHIEVEMENT_CATEGORY_TO_KEY } from "./profile_constants.js";

const CSV_HEADER =
  "id,title,category,subcategory,subsubcategory,runescore,combat_mastery_tier,parent_id,secret,complete";

function escapeCsvValue(val: string | number | boolean | null): string {
  if (val === null) return "N/A";
  const s = String(val);
  if (/[,\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const ACHIEVEMENT_CATEGORY_KEYS = new Set(Object.values(ACHIEVEMENT_CATEGORY_TO_KEY));

export function isScanComplete(profile: ProfileFile): boolean {
  for (const [key, total] of Object.entries(CATEGORY_TOTALS)) {
    if (!ACHIEVEMENT_CATEGORY_KEYS.has(key)) continue;
    const val = profile.categoryCompletion[key];
    if (!val) return false;
    const slash = val.indexOf("/");
    const numStr = slash >= 0 ? val.slice(0, slash).trim() : val.trim();
    const num = numStr === "null" ? 0 : parseInt(numStr, 10);
    const userClaimed = Number.isFinite(num) ? num : 0;
    const expectedNotComplete = total - userClaimed;

    const actualNotComplete = profile.achievements.filter((a) => {
      const catKey = ACHIEVEMENT_CATEGORY_TO_KEY[a.category];
      return catKey === key && a.complete === false;
    }).length;

    if (actualNotComplete !== expectedNotComplete) return false;
  }
  return true;
}

function getClaimedRunescore(profile: ProfileFile): number {
  const val = profile.categoryCompletion["runescore"];
  if (!val) return 0;
  const slash = val.indexOf("/");
  const numStr = slash >= 0 ? val.slice(0, slash).trim() : val.trim();
  if (numStr === "null") return 0;
  const n = parseInt(numStr, 10);
  return Number.isFinite(n) ? n : 0;
}

function sumRunescoreOfCompleted(achievements: Array<{ runescore: number | null; complete: boolean | null }>): number {
  return achievements
    .filter((a) => a.complete === true)
    .reduce((sum, a) => sum + ((a.runescore ?? 0) | 0), 0);
}

export function exportProfileToCsv(profile: ProfileFile, scanComplete: boolean): string {
  let achievements = profile.achievements;
  if (scanComplete) {
    const withConversion = profile.achievements.map((a) => ({
      ...a,
      complete: a.complete === null ? true : a.complete,
    }));
    const claimedRunescore = getClaimedRunescore(profile);
    const actualRunescore = sumRunescoreOfCompleted(withConversion);
    if (actualRunescore === claimedRunescore) {
      achievements = withConversion;
    } else {
      achievements = profile.achievements;
    }
  }

  const lines: string[] = [CSV_HEADER];
  for (const a of achievements) {
    const row = [
      a.id,
      a.title,
      a.category,
      a.subcategory,
      a.subsubcategory ?? "N/A",
      a.runescore ?? "N/A",
      a.combat_mastery_tier ?? "N/A",
      a.parent_id ?? "N/A",
      a.secret,
      a.complete === null ? "N/A" : a.complete,
    ].map(escapeCsvValue);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function downloadProfileAsCsv(profile: ProfileFile): void {
  const scanComplete = isScanComplete(profile);
  const csv = exportProfileToCsv(profile, scanComplete);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${profile.profileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

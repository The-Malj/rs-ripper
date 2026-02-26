import type { AchievementRecord, ProfileRow, ValidationResult } from "./profile_types.js";

const EXPECTED_HEADER_10 =
  "id,title,category,subcategory,subsubcategory,runescore,combat_mastery_tier,parent_id,secret,completed";
const EXPECTED_HEADER_11 =
  "id,title,category,subcategory,subsubcategory,runescore,combat_mastery_tier,parent_id,secret,completed,verified_not_completed";
const EXPECTED_HEADER_COMPLETE =
  "id,title,category,subcategory,subsubcategory,runescore,combat_mastery_tier,parent_id,secret,complete";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ",") {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function parseNum(val: string): number | null {
  const s = val.trim();
  if (s === "" || s === "N/A") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(val: string): boolean {
  const s = val.trim().toLowerCase();
  return s === "true" || s === "1";
}

export function validateProfileCsv(
  content: string,
  achievements: AchievementRecord[],
): ValidationResult {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { ok: false, errors: ["CSV must have a header row and at least one data row."] };
  }
  const header = lines[0].trim();
  const hasVerifiedCol = header === EXPECTED_HEADER_11;
  const hasCompleteCol = header === EXPECTED_HEADER_COMPLETE;
  if (header !== EXPECTED_HEADER_10 && !hasVerifiedCol && !hasCompleteCol) {
    return {
      ok: false,
      errors: [
        `Header must be exactly: ${EXPECTED_HEADER_10}, ${EXPECTED_HEADER_11}, or ${EXPECTED_HEADER_COMPLETE}`,
      ],
    };
  }
  const achievementMap = new Map(achievements.map((a) => [a.id, a]));
  const seenIds = new Set<number>();
  const rows: ProfileRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 10) {
      errors.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }
    const id = parseNum(cols[0]);
    if (id === null || !Number.isInteger(id) || id < 1) {
      errors.push(`Row ${i + 1}: invalid id "${cols[0]}"`);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`Row ${i + 1}: duplicate id ${id}`);
      continue;
    }
    seenIds.add(id);
    const dbAchievement = achievementMap.get(id);
    if (!dbAchievement) {
      errors.push(`Row ${i + 1}: id ${id} not found in achievements database`);
      continue;
    }
    const title = cols[1]?.trim() ?? "";
    if (title !== dbAchievement.title) {
      errors.push(`Row ${i + 1}: title mismatch for id ${id}`);
      continue;
    }
    const category = cols[2]?.trim() ?? "";
    const subcategory = cols[3]?.trim() ?? "";
    if (category !== dbAchievement.category || subcategory !== dbAchievement.subcategory) {
      errors.push(`Row ${i + 1}: category/subcategory mismatch for id ${id}`);
      continue;
    }
    const subsubRaw = cols[4]?.trim() ?? "";
    const subsubcategory =
      subsubRaw === "" || subsubRaw === "N/A" ? null : subsubRaw;
    const runescore = parseNum(cols[5] ?? "");
    const combat_mastery_tier = parseNum(cols[6] ?? "");
    const parent_id = parseNum(cols[7] ?? "");
    const secret = parseBool(cols[8] ?? "");
    let complete: null | boolean;
    if (hasCompleteCol && cols.length >= 10) {
      const raw = (cols[9] ?? "").trim().toLowerCase();
      if (raw === "" || raw === "n/a") complete = null;
      else if (raw === "true" || raw === "1") complete = true;
      else complete = false;
    } else if (hasVerifiedCol && cols.length >= 11) {
      const verified_not_completed = parseBool(cols[10] ?? "");
      const completed = parseBool(cols[9] ?? "");
      complete = verified_not_completed ? false : completed ? true : null;
    } else {
      const completed = parseBool(cols[9] ?? "");
      complete = completed ? true : null;
    }

    rows.push({
      id,
      title,
      category,
      subcategory,
      subsubcategory,
      runescore,
      combat_mastery_tier,
      parent_id,
      secret,
      complete,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, rows };
}

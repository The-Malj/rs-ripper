/**
 * One-off script: reads achievements_master.csv and populates achievements.json
 * and achievement_descriptions.json. Do not edit the master file.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const MASTER_PATH = join(DATA_DIR, "achievements_master.csv");
const DB_PATH = join(DATA_DIR, "achievements.json");
const DESCRIPTIONS_PATH = join(DATA_DIR, "achievement_descriptions.json");

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

const csv = readFileSync(MASTER_PATH, "utf-8");
const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = parseCSVLine(lines[0]);
const nameIdx = header.indexOf("name");
const descIdx = header.indexOf("description");
const catIdx = header.indexOf("category");
const subcatIdx = header.indexOf("subcategory");
const subsubcatIdx = header.indexOf("subsubcategory");
const combatIdx = header.indexOf("combatscore");
const runeIdx = header.indexOf("runescore");

if (
  nameIdx < 0 ||
  descIdx < 0 ||
  catIdx < 0 ||
  subcatIdx < 0 ||
  subsubcatIdx < 0 ||
  combatIdx < 0 ||
  runeIdx < 0
) {
  throw new Error("Missing expected columns in master CSV");
}

const achievements: Array<{
  id: number;
  title: string;
  category: string;
  subcategory: string;
  subsubcategory: string | null;
  runescore: number | null;
  combat_mastery_tier: number | null;
  parent_id: number | null;
  secret: boolean;
}> = [];
const descriptions: Record<string, string> = {};

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (cols.length < header.length) continue;
  const id = i; // 1-based, row 1 = id 1
  const title = cols[nameIdx]?.trim() ?? "";
  const subsub = cols[subsubcatIdx]?.trim();
  const runescore = parseNum(cols[runeIdx] ?? "");
  const combatTier = parseNum(cols[combatIdx] ?? "");

  achievements.push({
    id,
    title,
    category: cols[catIdx]?.trim() ?? "",
    subcategory: cols[subcatIdx]?.trim() ?? "",
    subsubcategory: subsub === "N/A" || subsub === "" ? null : subsub,
    runescore,
    combat_mastery_tier: combatTier,
    parent_id: null,
    secret: false,
  });

  const desc = cols[descIdx]?.trim() ?? "";
  if (desc) descriptions[String(id)] = desc;
}

const db = {
  _template: {
    id: null,
    title: null,
    category: null,
    subcategory: null,
    subsubcategory: null,
    runescore: null,
    combat_mastery_tier: null,
    parent_id: null,
    secret: false,
  },
  achievements,
};

const descDb = {
  _note:
    "Keys are achievement IDs from achievements.json. Values are in-game description text.",
  byId: descriptions,
};

writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
writeFileSync(DESCRIPTIONS_PATH, JSON.stringify(descDb, null, 2), "utf-8");

console.log(`Wrote ${achievements.length} achievements to ${DB_PATH}`);
console.log(`Wrote ${Object.keys(descriptions).length} descriptions to ${DESCRIPTIONS_PATH}`);

import type { ProfileRow, ProfileFile, ProfileAchievement } from "./profile_types.js";
import { CATEGORY_TOTALS, ACHIEVEMENT_CATEGORY_TO_KEY } from "./profile_constants.js";
import achievementsData from "../../data/achievements.json";

function normalizeComplete(c: null | boolean | undefined): null | boolean {
  return c === true || c === false ? c : null;
}

function normalizeAchievement(a: ProfileAchievement): ProfileAchievement {
  return { ...a, complete: normalizeComplete(a.complete) };
}

const DB_NAME = "rsripperv2";
const DB_VERSION = 2;
const STORE_NAME = "profile";
const PROFILES_STORE_NAME = "profiles";
const KEY = "profile";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(PROFILES_STORE_NAME)) {
        db.createObjectStore(PROFILES_STORE_NAME);
      }
    };
  });
}

export async function saveProfile(data: ProfileRow[]): Promise<void> {
  const normalized = data.map((row) => ({ ...row, complete: normalizeComplete(row.complete) }));
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(normalized, KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadProfile(): Promise<ProfileRow[] | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);
    req.onsuccess = () => {
      db.close();
      const val = req.result as ProfileRow[] | undefined;
      if (!Array.isArray(val)) {
        resolve(null);
        return;
      }
      resolve(val.map((row) => ({ ...row, complete: normalizeComplete(row.complete) })));
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function createProfile(profileName: string): Promise<void> {
  const raw = achievementsData as { achievements: Array<Record<string, unknown>> };
  const achievements: ProfileAchievement[] = raw.achievements.map((a) =>
    normalizeAchievement({
      id: a.id as number,
      title: a.title as string,
      category: a.category as string,
      subcategory: a.subcategory as string,
      subsubcategory: (a.subsubcategory as string | null) ?? null,
      runescore: (a.runescore as number | null) ?? null,
      combat_mastery_tier: (a.combat_mastery_tier as number | null) ?? null,
      parent_id: (a.parent_id as number | null) ?? null,
      secret: Boolean(a.secret),
      complete: null,
    }),
  );

  const categoryCompletion: Record<string, string> = {};
  for (const [key, total] of Object.entries(CATEGORY_TOTALS)) {
    categoryCompletion[key] = `null/${total}`;
  }

  const profile: ProfileFile = {
    profileName,
    categoryCompletion,
    achievements,
  };

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE_NAME, "readwrite");
    const store = tx.objectStore(PROFILES_STORE_NAME);
    store.put(profile, profileName);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveProfileFromCsvRows(profileName: string, rows: ProfileRow[]): Promise<void> {
  const raw = achievementsData as { achievements: Array<Record<string, unknown>> };
  const rowMap = new Map(rows.map((r) => [r.id, r]));
  const achievements: ProfileAchievement[] = raw.achievements.map((a) => {
    const row = rowMap.get(a.id as number);
    return normalizeAchievement({
      id: a.id as number,
      title: a.title as string,
      category: a.category as string,
      subcategory: a.subcategory as string,
      subsubcategory: (a.subsubcategory as string | null) ?? null,
      runescore: (a.runescore as number | null) ?? null,
      combat_mastery_tier: (a.combat_mastery_tier as number | null) ?? null,
      parent_id: (a.parent_id as number | null) ?? null,
      secret: Boolean(a.secret),
      complete: row ? normalizeComplete(row.complete) : null,
    });
  });

  const categoryCompletion: Record<string, string> = {};
  for (const [key, total] of Object.entries(CATEGORY_TOTALS)) {
    if (key === "runescore") {
      const sum = achievements
        .filter((a) => a.complete === true)
        .reduce((s, a) => s + ((a.runescore ?? 0) | 0), 0);
      categoryCompletion[key] = `${sum}/${total}`;
    } else {
      const catLabel = Object.entries(ACHIEVEMENT_CATEGORY_TO_KEY).find(([, v]) => v === key)?.[0];
      const count = catLabel
        ? achievements.filter((a) => a.category === catLabel && a.complete === true).length
        : 0;
      categoryCompletion[key] = `${count}/${total}`;
    }
  }

  const profile: ProfileFile = { profileName, categoryCompletion, achievements };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE_NAME, "readwrite");
    const store = tx.objectStore(PROFILES_STORE_NAME);
    store.put(profile, profileName);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearAllProfiles(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PROFILES_STORE_NAME, STORE_NAME], "readwrite");
    tx.objectStore(PROFILES_STORE_NAME).clear();
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function listProfiles(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE_NAME, "readonly");
    const store = tx.objectStore(PROFILES_STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      db.close();
      const keys = req.result as string[];
      resolve(keys ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getProfile(profileName: string): Promise<ProfileFile | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE_NAME, "readonly");
    const store = tx.objectStore(PROFILES_STORE_NAME);
    const req = store.get(profileName);
    req.onsuccess = () => {
      db.close();
      const val = req.result as ProfileFile | undefined;
      if (!val) {
        resolve(null);
        return;
      }
      const normalized: ProfileFile = {
        ...val,
        achievements: val.achievements.map(normalizeAchievement),
      };
      resolve(normalized);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function updateProfile(profileName: string, updates: Partial<ProfileFile>): Promise<void> {
  const existing = await getProfile(profileName);
  if (!existing) {
    throw new Error(`Profile "${profileName}" not found`);
  }
  const merged: ProfileFile = {
    ...existing,
    ...updates,
    profileName: existing.profileName,
  };
  const updated: ProfileFile = merged.achievements
    ? { ...merged, achievements: merged.achievements.map(normalizeAchievement) }
    : merged;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE_NAME, "readwrite");
    const store = tx.objectStore(PROFILES_STORE_NAME);
    store.put(updated, profileName);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

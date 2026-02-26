export type ProfileRow = {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  subsubcategory: string | null;
  runescore: number | null;
  combat_mastery_tier: number | null;
  parent_id: number | null;
  secret: boolean;
  complete: null | boolean;
};

export type ValidationResult =
  | { ok: true; rows: ProfileRow[] }
  | { ok: false; errors: string[] };

export type AchievementRecord = {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  subsubcategory: string | null;
  runescore: number | null;
  combat_mastery_tier: number | null;
  parent_id: number | null;
  secret: boolean;
};

/** Profile file template - extends achievement with profile-specific fields only */
export type ProfileAchievement = AchievementRecord & {
  complete: null | boolean;
};

export type ProfileFile = {
  profileName: string;
  categoryCompletion: Record<string, string>;
  achievements: ProfileAchievement[];
};

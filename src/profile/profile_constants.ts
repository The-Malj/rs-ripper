/** Category keys and denominators - must match plugin_app EXPECTED_CATEGORY_TOTALS */
export const CATEGORY_TOTALS: Record<string, number> = {
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

/** Maps achievement category string (from achievements.json) to our category key */
export const ACHIEVEMENT_CATEGORY_TO_KEY: Record<string, string> = {
  Skills: "skills",
  Exploration: "exploration",
  "Area Tasks": "area_tasks",
  Combat: "combat",
  Lore: "lore",
  Activities: "activities",
  Completionist: "completionist",
  Feats: "feats",
};

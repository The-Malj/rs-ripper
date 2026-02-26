import { ACHIEVEMENT_CATEGORY_TO_KEY } from "../profile/profile_constants.js";
import type { CategorySchema } from "../types.js";

export type AchievementRecord = {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  subsubcategory: string | null;
  runescore: number | null;
};

export type CategoryInfo = {
  key: string;
  label: string;
};

export type SubcategoryInfo = {
  key: string;
  label: string;
};

export type SubsubcategoryInfo = {
  key: string;
  label: string;
};

export type AchievementHierarchy = {
  categories: CategoryInfo[];
  subcategoriesByCategory: Map<string, SubcategoryInfo[]>;
  subsubcategoriesBySubcategory: Map<string, SubsubcategoryInfo[]>;
  achievementsByLeaf: Map<string, AchievementRecord[]>;
};

function schemaNameToKey(name: string): string {
  return name.replace(/\s+/g, "_");
}

export function buildHierarchy(
  achievements: AchievementRecord[],
  schema: CategorySchema,
  categoryLabels: Record<string, string>,
): AchievementHierarchy {
  const subcategoriesByCategory = new Map<string, SubcategoryInfo[]>();
  const subsubcategoriesBySubcategory = new Map<string, SubsubcategoryInfo[]>();
  const achievementsByLeaf = new Map<string, AchievementRecord[]>();

  const categoryKeySet = new Set<string>();
  const subcategoryOrder = new Map<string, string[]>();
  const subsubcategoryOrder = new Map<string, string[]>();

  for (const a of achievements) {
    const categoryKey = ACHIEVEMENT_CATEGORY_TO_KEY[a.category];
    if (!categoryKey) continue;

    categoryKeySet.add(categoryKey);

    const subKey = `${categoryKey}|${a.subcategory}`;
    if (!subcategoryOrder.has(categoryKey)) {
      subcategoryOrder.set(categoryKey, []);
    }
    const subList = subcategoryOrder.get(categoryKey)!;
    if (!subList.includes(a.subcategory)) {
      subList.push(a.subcategory);
    }

    if (a.subsubcategory) {
      const subsubKey = `${subKey}|${a.subsubcategory}`;
      if (!subsubcategoryOrder.has(subKey)) {
        subsubcategoryOrder.set(subKey, []);
      }
      const subsubList = subsubcategoryOrder.get(subKey)!;
      if (!subsubList.includes(a.subsubcategory)) {
        subsubList.push(a.subsubcategory);
      }
    }

    const leafKey = a.subsubcategory
      ? `${categoryKey}|${a.subcategory}|${a.subsubcategory}`
      : `${categoryKey}|${a.subcategory}`;
    if (!achievementsByLeaf.has(leafKey)) {
      achievementsByLeaf.set(leafKey, []);
    }
    achievementsByLeaf.get(leafKey)!.push(a);
  }

  const NA_VARIANTS = ["n/a", "na", "n.a."];
  const isPlaceholderSubcategory = (s: string) =>
    NA_VARIANTS.includes(s.toLowerCase().trim()) || s.trim() === "";

  for (const [catKey, subList] of subcategoryOrder) {
    const filtered = subList.filter((s) => !isPlaceholderSubcategory(s));
    subcategoriesByCategory.set(
      catKey,
      filtered.map((s) => ({ key: s, label: s })),
    );
  }

  for (const [subKey, subsubList] of subsubcategoryOrder) {
    subsubcategoriesBySubcategory.set(
      subKey,
      subsubList.map((s) => ({ key: s, label: s })),
    );
  }

  const categories: CategoryInfo[] = [];
  for (const schemaCat of schema.categories) {
    const key = schemaNameToKey(schemaCat.name);
    if (categoryKeySet.has(key)) {
      categories.push({
        key,
        label: categoryLabels[key] ?? schemaCat.name,
      });
    }
  }

  return {
    categories,
    subcategoriesByCategory,
    subsubcategoriesBySubcategory,
    achievementsByLeaf,
  };
}

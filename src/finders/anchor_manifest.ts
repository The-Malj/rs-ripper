import { PrimaryCategory } from "../types.js";

import optionsMenuUrl from "../../data/anchors/dev-samples/options_menu.png";
import heroButtonUrl from "../../data/anchors/dev-samples/hero_button.png";
import heroWindowUrl from "../../data/anchors/dev-samples/hero_window.png";
import achievementsTabSelectedUrl from "../../data/anchors/dev-samples/achievements_tab_selected.png";
import achievementsTabNotSelectedUrl from "../../data/anchors/dev-samples/achievements_tab_not_selected.png";
import achievementsSubtabSelectedUrl from "../../data/anchors/dev-samples/achievements_subtab_selected.png";
import achievementsSubtabNotSelectedUrl from "../../data/anchors/dev-samples/achievements_subtab_not_selected.png";
import allCategoriesClosedUrl from "../../data/anchors/dev-samples/all_categories_closed.png";
import allCategoriesClosed2Url from "../../data/anchors/dev-samples/all_categories_closed_2.png";
import expandedCategoryUrl from "../../data/anchors/dev-samples/expanded_category.png";
import skillsCategoryUrl from "../../data/anchors/dev-samples/skills_category.png";
import explorationCategoryUrl from "../../data/anchors/dev-samples/exploration_category.png";
import areaTasksCategoryUrl from "../../data/anchors/dev-samples/area_tasks_category.png";
import combatCategoryUrl from "../../data/anchors/dev-samples/combat_category.png";
import loreCategoryUrl from "../../data/anchors/dev-samples/lore_category.png";
import activitiesCategoryUrl from "../../data/anchors/dev-samples/activities_category.png";
import completionistCategoryUnselectedUrl from "../../data/anchors/dev-samples/completionist_category_unselected.png";
import completionistCategorySelectedUrl from "../../data/anchors/dev-samples/completionist_category_selected.png";
import featsCategoryUrl from "../../data/anchors/dev-samples/feats_category.png";
import skillsCategoryExpandedUrl from "../../data/anchors/dev-samples/skills_category_expanded.png";
import skillsCategoryExpanded2Url from "../../data/anchors/dev-samples/skills_category_expanded_2.png";
import skillsCategoryExpanded3Url from "../../data/anchors/dev-samples/skills_category_expanded_3.png";
import explorationCategoryExpandedUrl from "../../data/anchors/dev-samples/exploration_category_expanded.png";
import explorationCategoryExpanded2Url from "../../data/anchors/dev-samples/exploration_category_expanded_2.png";
import explorationCategoryExpanded3Url from "../../data/anchors/dev-samples/exploration_category_expanded_3.png";
import areaTasksCategoryExpandedUrl from "../../data/anchors/dev-samples/area_tasks_category_expanded.png";
import areaTasksCategoryExpanded2Url from "../../data/anchors/dev-samples/area_tasks_category_expanded_2.png";
import areaTasksCategoryExpanded3Url from "../../data/anchors/dev-samples/area_tasks_category_expanded_3.png";
import combatCategoryExpandedUrl from "../../data/anchors/dev-samples/combat_category_expanded.png";
import combatCategoryExpanded2Url from "../../data/anchors/dev-samples/combat_category_expanded_2.png";
import combatCategoryExpanded3Url from "../../data/anchors/dev-samples/combat_category_expanded_3.png";
import loreCategoryExpandedUrl from "../../data/anchors/dev-samples/lore_category_expanded.png";
import loreCategoryExpanded2Url from "../../data/anchors/dev-samples/lore_category_expanded_2.png";
import loreCategoryExpanded3Url from "../../data/anchors/dev-samples/lore_category_expanded_3.png";
import activitiesCategoryExpandedUrl from "../../data/anchors/dev-samples/activities_category_expanded.png";
import activitiesCategoryExpanded2Url from "../../data/anchors/dev-samples/activities_category_expanded_2.png";
import activitiesCategoryExpanded3Url from "../../data/anchors/dev-samples/activities_category_expanded_3.png";
import featsCategoryExpandedUrl from "../../data/anchors/dev-samples/feats_category_expanded.png";
import featsCategoryExpanded2Url from "../../data/anchors/dev-samples/feats_category_expanded_2.png";
import expandedCategoryColorUrl from "../../data/anchors/dev-samples/expanded_category_color.png";
import showLockedCheckedUrl from "../../data/anchors/dev-samples/show_locked_checked.png";
import showLockedUncheckedUrl from "../../data/anchors/dev-samples/show_locked_unchecked.png";
import showCompletedCheckedUrl from "../../data/anchors/dev-samples/show_completed_checked.png";
import showCompletedUncheckedUrl from "../../data/anchors/dev-samples/show_completed_unchecked.png";
import listModeCheckedUrl from "../../data/anchors/dev-samples/list_mode_checked.png";
import listModeUncheckedUrl from "../../data/anchors/dev-samples/list_mode_unchecked.png";

export type AnchorKey =
  | "options_menu"
  | "hero_button"
  | "hero_window"
  | "achievements_tab_selected"
  | "achievements_tab_not_selected"
  | "achievements_subtab_selected"
  | "achievements_subtab_not_selected"
  | "all_categories_closed"
  | "all_categories_closed_2"
  | "expanded_category"
  | "skills_category"
  | "exploration_category"
  | "area_tasks_category"
  | "combat_category"
  | "lore_category"
  | "activities_category"
  | "completionist_category_unselected"
  | "completionist_category_selected"
  | "feats_category"
  | "skills_category_expanded"
  | "skills_category_expanded_2"
  | "skills_category_expanded_3"
  | "exploration_category_expanded"
  | "exploration_category_expanded_2"
  | "exploration_category_expanded_3"
  | "area_tasks_category_expanded"
  | "area_tasks_category_expanded_2"
  | "area_tasks_category_expanded_3"
  | "combat_category_expanded"
  | "combat_category_expanded_2"
  | "combat_category_expanded_3"
  | "lore_category_expanded"
  | "lore_category_expanded_2"
  | "lore_category_expanded_3"
  | "activities_category_expanded"
  | "activities_category_expanded_2"
  | "activities_category_expanded_3"
  | "feats_category_expanded"
  | "feats_category_expanded_2"
  | "expanded_category_color"
  | "show_locked_checked"
  | "show_locked_unchecked"
  | "show_completed_checked"
  | "show_completed_unchecked"
  | "list_mode_checked"
  | "list_mode_unchecked";

export type AnchorDefinition = {
  key: AnchorKey;
  url: string;
  stage:
    | "wait_options_menu"
    | "wait_hero_window"
    | "wait_achievements_top_tab"
    | "wait_achievements_subtab"
    | "wait_display_preferences"
    | "wait_category_baseline";
  role: "required" | "optional";
  expectedConfidence: number;
  category?: PrimaryCategory;
  categoryState?: "collapsed" | "expanded";
};

export const ANCHOR_DEFINITIONS: AnchorDefinition[] = [
  {
    key: "options_menu",
    url: optionsMenuUrl,
    stage: "wait_options_menu",
    role: "required",
    expectedConfidence: 0.86,
  },
  {
    key: "hero_button",
    url: heroButtonUrl,
    stage: "wait_hero_window",
    role: "required",
    expectedConfidence: 0.86,
  },
  {
    key: "hero_window",
    url: heroWindowUrl,
    stage: "wait_hero_window",
    role: "required",
    expectedConfidence: 0.84,
  },
  {
    key: "achievements_tab_selected",
    url: achievementsTabSelectedUrl,
    stage: "wait_achievements_top_tab",
    role: "required",
    expectedConfidence: 0.86,
  },
  {
    key: "achievements_tab_not_selected",
    url: achievementsTabNotSelectedUrl,
    stage: "wait_achievements_top_tab",
    role: "required",
    expectedConfidence: 0.82,
  },
  {
    key: "achievements_subtab_selected",
    url: achievementsSubtabSelectedUrl,
    stage: "wait_achievements_subtab",
    role: "required",
    expectedConfidence: 0.86,
  },
  {
    key: "achievements_subtab_not_selected",
    url: achievementsSubtabNotSelectedUrl,
    stage: "wait_achievements_subtab",
    role: "optional",
    expectedConfidence: 0.8,
  },
  {
    key: "all_categories_closed",
    url: allCategoriesClosedUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.86,
  },
  {
    key: "all_categories_closed_2",
    url: allCategoriesClosed2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.86,
  },
  {
    key: "expanded_category",
    url: expandedCategoryUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "skills_category",
    url: skillsCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "skills",
    categoryState: "collapsed",
  },
  {
    key: "exploration_category",
    url: explorationCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "exploration",
    categoryState: "collapsed",
  },
  {
    key: "area_tasks_category",
    url: areaTasksCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "area tasks",
    categoryState: "collapsed",
  },
  {
    key: "combat_category",
    url: combatCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "combat",
    categoryState: "collapsed",
  },
  {
    key: "lore_category",
    url: loreCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "lore",
    categoryState: "collapsed",
  },
  {
    key: "activities_category",
    url: activitiesCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "activities",
    categoryState: "collapsed",
  },
  {
    key: "completionist_category_unselected",
    url: completionistCategoryUnselectedUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "completionist",
    categoryState: "collapsed",
  },
  {
    key: "feats_category",
    url: featsCategoryUrl,
    stage: "wait_category_baseline",
    role: "required",
    expectedConfidence: 0.82,
    category: "feats",
    categoryState: "collapsed",
  },
  {
    key: "completionist_category_selected",
    url: completionistCategorySelectedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "completionist",
    categoryState: "collapsed",
  },
  {
    key: "skills_category_expanded",
    url: skillsCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "skills",
    categoryState: "expanded",
  },
  {
    key: "skills_category_expanded_2",
    url: skillsCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "skills",
    categoryState: "expanded",
  },
  {
    key: "skills_category_expanded_3",
    url: skillsCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "skills",
    categoryState: "expanded",
  },
  {
    key: "exploration_category_expanded",
    url: explorationCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "exploration",
    categoryState: "expanded",
  },
  {
    key: "exploration_category_expanded_2",
    url: explorationCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "exploration",
    categoryState: "expanded",
  },
  {
    key: "exploration_category_expanded_3",
    url: explorationCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "exploration",
    categoryState: "expanded",
  },
  {
    key: "area_tasks_category_expanded",
    url: areaTasksCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "area tasks",
    categoryState: "expanded",
  },
  {
    key: "area_tasks_category_expanded_2",
    url: areaTasksCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "area tasks",
    categoryState: "expanded",
  },
  {
    key: "area_tasks_category_expanded_3",
    url: areaTasksCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "area tasks",
    categoryState: "expanded",
  },
  {
    key: "combat_category_expanded",
    url: combatCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "combat",
    categoryState: "expanded",
  },
  {
    key: "combat_category_expanded_2",
    url: combatCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "combat",
    categoryState: "expanded",
  },
  {
    key: "combat_category_expanded_3",
    url: combatCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "combat",
    categoryState: "expanded",
  },
  {
    key: "lore_category_expanded",
    url: loreCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "lore",
    categoryState: "expanded",
  },
  {
    key: "lore_category_expanded_2",
    url: loreCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "lore",
    categoryState: "expanded",
  },
  {
    key: "lore_category_expanded_3",
    url: loreCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "lore",
    categoryState: "expanded",
  },
  {
    key: "activities_category_expanded",
    url: activitiesCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "activities",
    categoryState: "expanded",
  },
  {
    key: "activities_category_expanded_2",
    url: activitiesCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "activities",
    categoryState: "expanded",
  },
  {
    key: "activities_category_expanded_3",
    url: activitiesCategoryExpanded3Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "activities",
    categoryState: "expanded",
  },
  {
    key: "feats_category_expanded_2",
    url: featsCategoryExpanded2Url,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "feats",
    categoryState: "expanded",
  },
  {
    key: "feats_category_expanded",
    url: featsCategoryExpandedUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.8,
    category: "feats",
    categoryState: "expanded",
  },
  {
    key: "show_locked_checked",
    url: showLockedCheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "show_locked_unchecked",
    url: showLockedUncheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "show_completed_checked",
    url: showCompletedCheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "show_completed_unchecked",
    url: showCompletedUncheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "list_mode_checked",
    url: listModeCheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "list_mode_unchecked",
    url: listModeUncheckedUrl,
    stage: "wait_display_preferences",
    role: "optional",
    expectedConfidence: 0.82,
  },
  {
    key: "expanded_category_color",
    url: expandedCategoryColorUrl,
    stage: "wait_category_baseline",
    role: "optional",
    expectedConfidence: 0.74,
  },
];

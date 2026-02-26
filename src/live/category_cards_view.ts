import type {
  AchievementHierarchy,
  AchievementRecord,
  CategoryInfo,
  SubcategoryInfo,
  SubsubcategoryInfo,
} from "./achievement_hierarchy.js";

const VIRTUAL_THRESHOLD = 80;
const PAGE_SIZE = 50;

export type BrowseState = {
  level: 1 | 2 | 3 | 4;
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
};

export type ProfileAchievement = { complete: null | boolean };

export function createCategoryCardsView(
  container: HTMLElement,
  hierarchy: AchievementHierarchy,
  categoryIcons: Record<string, string>,
  getProfileAchievements: () => Map<number, ProfileAchievement>,
  onBackToProgress?: () => void,
) {
  let state: BrowseState = { level: 1 };

  const breadcrumbEl = document.createElement("div");
  breadcrumbEl.className = "category-cards-breadcrumb";

  const contentEl = document.createElement("div");
  contentEl.className = "category-cards-content";

  container.append(breadcrumbEl, contentEl);

  function renderBreadcrumb(): void {
    breadcrumbEl.innerHTML = "";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "category-cards-breadcrumb-link category-cards-breadcrumb-back";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => {
      if (state.level === 1 && onBackToProgress) {
        onBackToProgress();
        return;
      }
      if (state.level === 2 && state.category) {
        state = { level: 1 };
      } else if (state.level === 3 && state.category && state.subcategory) {
        state = { level: 2, category: state.category };
      } else if (state.level === 4 && state.category && state.subcategory) {
        if (state.subsubcategory) {
          state = { level: 3, category: state.category, subcategory: state.subcategory };
        } else if (state.subcategory === "N/A") {
          state = { level: 1 };
        } else {
          state = { level: 2, category: state.category };
        }
      } else {
        return;
      }
      render();
    });
    if (state.level === 1 && !onBackToProgress) {
      breadcrumbEl.textContent = "Browse achievements";
      return;
    }
    breadcrumbEl.appendChild(backBtn);
  }

  function renderCategoryCards(): void {
    contentEl.innerHTML = "";
    contentEl.className = "category-cards-content category-cards-grid";
    for (const cat of hierarchy.categories) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "category-card";
      card.dataset.categoryKey = cat.key;
      const icon = categoryIcons[cat.key];
      if (icon) {
        const img = document.createElement("img");
        img.src = icon;
        img.alt = "";
        img.className = "category-card-icon";
        card.appendChild(img);
      }
      const label = document.createElement("span");
      label.className = "category-card-label";
      label.textContent = cat.label;
      card.appendChild(label);
      card.addEventListener("click", () => {
        state = { level: 2, category: cat.key };
        render();
      });
      contentEl.appendChild(card);
    }
  }

  function renderSubcategoryCards(): void {
    if (!state.category) return;
    const subs = [...(hierarchy.subcategoriesByCategory.get(state.category) ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    if (subs.length === 0) {
      const directLeafKey = `${state.category}|N/A`;
      if (hierarchy.achievementsByLeaf.has(directLeafKey)) {
        state = { level: 4, category: state.category, subcategory: "N/A" };
        renderAchievementList();
        return;
      }
    }
    contentEl.innerHTML = "";
    contentEl.className = "category-cards-content category-cards-grid";
    for (const sub of subs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "category-card category-card-sub";
      card.textContent = sub.label;
      card.addEventListener("click", () => {
        const subKey = `${state.category}|${sub.key}`;
        const hasSubsubs = (hierarchy.subsubcategoriesBySubcategory.get(subKey) ?? []).length > 0;
        if (hasSubsubs) {
          state = {
            level: 3,
            category: state.category,
            subcategory: sub.key,
          };
        } else {
          state = {
            level: 4,
            category: state.category,
            subcategory: sub.key,
          };
        }
        render();
      });
      contentEl.appendChild(card);
    }
  }

  function renderSubsubcategoryCards(): void {
    if (!state.category || !state.subcategory) return;
    const subKey = `${state.category}|${state.subcategory}`;
    const subsubs = hierarchy.subsubcategoriesBySubcategory.get(subKey) ?? [];
    contentEl.innerHTML = "";
    contentEl.className = "category-cards-content category-cards-grid";
    for (const subsub of subsubs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "category-card category-card-sub";
      card.textContent = subsub.label;
      card.addEventListener("click", () => {
        state = {
          level: 4,
          category: state.category,
          subcategory: state.subcategory,
          subsubcategory: subsub.key,
        };
        render();
      });
      contentEl.appendChild(card);
    }
  }

  function renderAchievementList(): void {
    if (!state.category || !state.subcategory) return;
    const leafKey = state.subsubcategory
      ? `${state.category}|${state.subcategory}|${state.subsubcategory}`
      : `${state.category}|${state.subcategory}`;
    const achievements = hierarchy.achievementsByLeaf.get(leafKey) ?? [];
    const profileMap = getProfileAchievements();

    contentEl.innerHTML = "";
    contentEl.className = "category-cards-content category-cards-achievement-list-wrap";

    if (achievements.length === 0) {
      const empty = document.createElement("p");
      empty.className = "category-cards-empty";
      empty.textContent = "No achievements in this section.";
      contentEl.appendChild(empty);
      return;
    }

    if (achievements.length < VIRTUAL_THRESHOLD) {
      const list = document.createElement("div");
      list.className = "category-cards-achievement-list";
      for (const a of achievements) {
        list.appendChild(createAchievementRow(a, profileMap));
      }
      contentEl.appendChild(list);
    } else {
      let page = 0;
      const totalPages = Math.ceil(achievements.length / PAGE_SIZE);

      const list = document.createElement("div");
      list.className = "category-cards-achievement-list category-cards-achievement-list-virtual";

      const renderPage = (): void => {
        list.innerHTML = "";
        const start = page * PAGE_SIZE;
        const slice = achievements.slice(start, start + PAGE_SIZE);
        for (const a of slice) {
          list.appendChild(createAchievementRow(a, profileMap));
        }
      };

      const pagination = document.createElement("div");
      pagination.className = "category-cards-pagination";
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "category-cards-pagination-btn";
      prevBtn.textContent = "← Previous";
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "category-cards-pagination-btn";
      nextBtn.textContent = "Next →";
      const pageInfo = document.createElement("span");
      pageInfo.className = "category-cards-pagination-info";

      const updatePagination = (): void => {
        const start = page * PAGE_SIZE;
        pageInfo.textContent = `${start + 1}-${Math.min(start + PAGE_SIZE, achievements.length)} of ${achievements.length}`;
        prevBtn.disabled = page <= 0;
        nextBtn.disabled = page >= totalPages - 1;
      };

      prevBtn.addEventListener("click", () => {
        if (page > 0) {
          page--;
          renderPage();
          updatePagination();
        }
      });
      nextBtn.addEventListener("click", () => {
        if (page < totalPages - 1) {
          page++;
          renderPage();
          updatePagination();
        }
      });

      renderPage();
      updatePagination();
      pagination.append(prevBtn, pageInfo, nextBtn);
      contentEl.append(list, pagination);
    }
  }

  function createAchievementRow(
    a: AchievementRecord,
    profileMap: Map<number, ProfileAchievement>,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "achievement-list-row";
    const pa = profileMap.get(a.id);
    const complete = pa?.complete;
    const statusClass =
      complete === true ? "achievement-list-complete" : complete === false ? "achievement-list-incomplete" : "achievement-list-unknown";
    const statusIcon = complete === true ? "✓" : complete === false ? "✗" : "—";

    const statusEl = document.createElement("span");
    statusEl.className = `achievement-list-status ${statusClass}`;
    statusEl.textContent = statusIcon;
    statusEl.title =
      complete === true ? "Complete" : complete === false ? "Incomplete" : "Unknown";

    const titleEl = document.createElement("span");
    titleEl.className = "achievement-list-title";
    titleEl.textContent = a.title;

    const runescoreEl = document.createElement("span");
    runescoreEl.className = "achievement-list-runescore";
    runescoreEl.textContent = a.runescore != null ? String(a.runescore) : "—";

    row.append(statusEl, titleEl, runescoreEl);
    return row;
  }

  function render(): void {
    renderBreadcrumb();
    if (state.level === 1) {
      renderCategoryCards();
    } else if (state.level === 2) {
      renderSubcategoryCards();
    } else if (state.level === 3) {
      renderSubsubcategoryCards();
    } else {
      renderAchievementList();
    }
  }

  return {
    render,
    setState(s: BrowseState) {
      state = s;
    },
    getState(): BrowseState {
      return { ...state };
    },
  };
}

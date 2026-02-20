class UiStore {
  showPalette = $state(true);
  showSidebar = $state(true);
  showTerraformPanel = $state(true);
  terraformPanelHeight = $state(200);

  /** Set of palette category IDs that are collapsed */
  collapsedCategories = $state<Set<string>>(new Set());

  toggleCategory(categoryId: string) {
    const next = new Set(this.collapsedCategories);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    this.collapsedCategories = next;
  }

  isCategoryCollapsed(categoryId: string): boolean {
    return this.collapsedCategories.has(categoryId);
  }
}

export const ui = new UiStore();

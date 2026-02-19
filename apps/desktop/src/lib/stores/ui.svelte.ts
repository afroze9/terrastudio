class UiStore {
  showPalette = $state(true);
  showSidebar = $state(true);
  showTerraformPanel = $state(true);
  terraformPanelHeight = $state(200);
}

export const ui = new UiStore();

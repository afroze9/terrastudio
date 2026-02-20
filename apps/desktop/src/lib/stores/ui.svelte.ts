import type { PaletteId } from '$lib/themes/types';
import { applyPalette, getPalette } from '$lib/themes/theme-engine';
import { DEFAULT_PALETTE_ID } from '$lib/themes/palettes';

export type SidebarView = 'explorer' | 'terraform' | 'settings' | 'app-settings';
export type EdgeStyle = 'default' | 'smoothstep' | 'step' | 'straight';
export type Theme = 'dark' | 'light';

export interface EditorTab {
  id: string;        // 'canvas' or filename
  label: string;     // 'Canvas' or 'main.tf'
  type: 'canvas' | 'file';
}

class UiStore {
  // --- Activity Bar + Side Panel ---
  activeView = $state<SidebarView>('explorer');
  showSidePanel = $state(true);
  sidePanelWidth = $state(280);

  // --- Editor Tabs ---
  tabs = $state<EditorTab[]>([{ id: 'canvas', label: 'Canvas', type: 'canvas' }]);
  activeTabId = $state('canvas');

  // --- Properties Panel (right) ---
  showPropertiesPanel = $state(true);

  // --- Terminal ---
  showTerminal = $state(false);
  terminalPanelHeight = $state(200);

  // --- Palette categories ---
  collapsedCategories = $state<Set<string>>(new Set());

  // --- Generated terraform file list ---
  generatedFiles = $state<string[]>([]);

  // --- SvelteFlow fitView (assigned by DnDFlow) ---
  fitView: (() => void) | null = $state(null);

  // --- Edge style ---
  edgeType = $state<EdgeStyle>((typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-edge-type') as EdgeStyle) || 'default');

  // --- Grid & Snap ---
  snapToGrid = $state(typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-snap') === 'true');
  gridSize = $state(typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-grid-size') ? Number(localStorage.getItem('terrastudio-grid-size')) : 20);

  // --- Theme ---
  theme = $state<Theme>((typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-theme') as Theme) || 'dark');

  // --- Palette ---
  paletteId = $state<PaletteId>((typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-palette') as PaletteId) || DEFAULT_PALETTE_ID);

  get palette() {
    return getPalette(this.paletteId);
  }

  // --- Palette categories ---
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

  toggleAllCategories(categoryIds: string[]) {
    const allCollapsed = categoryIds.every((id) => this.collapsedCategories.has(id));
    this.collapsedCategories = allCollapsed ? new Set() : new Set(categoryIds);
  }

  /** Toggle sidebar view; collapse if already showing the same view */
  setActiveView(view: SidebarView) {
    if (this.activeView === view && this.showSidePanel) {
      this.showSidePanel = false;
    } else {
      this.activeView = view;
      this.showSidePanel = true;
    }
  }

  /** Open a file tab (or focus it if already open) */
  openFileTab(filename: string) {
    const existing = this.tabs.find((t) => t.id === filename);
    if (existing) {
      this.activeTabId = existing.id;
    } else {
      const tab: EditorTab = { id: filename, label: filename, type: 'file' };
      this.tabs = [...this.tabs, tab];
      this.activeTabId = tab.id;
    }
  }

  /** Close a file tab */
  closeTab(tabId: string) {
    if (tabId === 'canvas') return;
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = 'canvas';
    }
  }

  /** Toggle terminal visibility */
  toggleTerminal() {
    this.showTerminal = !this.showTerminal;
  }

  /** Set snap to grid and persist */
  setSnapToGrid(enabled: boolean) {
    this.snapToGrid = enabled;
    localStorage.setItem('terrastudio-snap', String(enabled));
  }

  /** Set grid size and persist */
  setGridSize(size: number) {
    this.gridSize = size;
    localStorage.setItem('terrastudio-grid-size', String(size));
  }

  /** Set edge type and persist */
  setEdgeType(type: EdgeStyle) {
    this.edgeType = type;
    localStorage.setItem('terrastudio-edge-type', type);
  }

  /** Toggle dark/light theme */
  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('terrastudio-theme', this.theme);
    applyPalette(this.paletteId, this.theme);
  }

  /** Switch to a different palette */
  setPalette(id: PaletteId) {
    this.paletteId = id;
    localStorage.setItem('terrastudio-palette', id);
    applyPalette(this.paletteId, this.theme);
  }

  /** Apply saved theme + palette to DOM (call once on startup) */
  applyTheme() {
    applyPalette(this.paletteId, this.theme);
  }
}

export const ui = new UiStore();

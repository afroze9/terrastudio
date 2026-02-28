import type { PaletteId } from '$lib/themes/types';
import { applyPalette, getPalette } from '$lib/themes/theme-engine';
import { DEFAULT_PALETTE_ID } from '$lib/themes/palettes';
import type { ResourceTypeId, EdgeCategoryId } from '@terrastudio/types';
import type { LogLevel } from '$lib/logger';
import { broadcastSetting } from './settings-sync';

/** Which edge categories are currently visible on canvas */
export type EdgeCategoryVisibility = Record<EdgeCategoryId, boolean>;

const DEFAULT_EDGE_VISIBILITY: EdgeCategoryVisibility = {
  structural: true,
  binding: true,
  reference: true,
  annotation: true,
};

export type SidebarView = 'explorer' | 'terraform' | 'settings' | 'cost' | 'app-settings';
export type EdgeStyle = 'default' | 'smoothstep' | 'step' | 'straight';
export type Theme = 'dark' | 'light';

export interface DragFeedback {
  /** The resource type being dragged */
  typeId: ResourceTypeId;
  /** Container node IDs that are valid drop targets */
  validContainerIds: Set<string>;
  /** Container node IDs that are invalid (hovered but can't accept) */
  invalidContainerIds: Set<string>;
}

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

  // --- Edge category visibility ---
  edgeVisibility = $state<EdgeCategoryVisibility>(this.loadEdgeVisibility());

  // --- Grid & Snap ---
  snapToGrid = $state(typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-snap') === 'true');
  gridSize = $state(typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-grid-size') ? Number(localStorage.getItem('terrastudio-grid-size')) : 20);

  // --- Minimap ---
  showMinimap = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('terrastudio-minimap') !== 'false' : true);

  // --- Cost badges ---
  showCostBadges = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('terrastudio-cost-badges') === 'true' : false);

  // --- Log level ---
  logLevel = $state<LogLevel>((typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-log-level') as LogLevel) || 'info');

  // --- Theme ---
  theme = $state<Theme>((typeof localStorage !== 'undefined' && localStorage.getItem('terrastudio-theme') as Theme) || 'dark');

  // --- Drag feedback for container highlighting ---
  dragFeedback = $state<DragFeedback | null>(null);

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
    const next = new Set(this.collapsedCategories);
    const allCollapsed = categoryIds.every((id) => next.has(id));
    if (allCollapsed) {
      categoryIds.forEach((id) => next.delete(id));
    } else {
      categoryIds.forEach((id) => next.add(id));
    }
    this.collapsedCategories = next;
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

  /** Close all file tabs except the given one (canvas is always kept) */
  closeOtherTabs(keepTabId: string) {
    this.tabs = this.tabs.filter((t) => t.id === 'canvas' || t.id === keepTabId);
    if (this.activeTabId !== 'canvas' && this.activeTabId !== keepTabId) {
      this.activeTabId = keepTabId !== 'canvas' ? keepTabId : 'canvas';
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
    broadcastSetting('snapToGrid', enabled);
  }

  /** Set grid size and persist */
  setGridSize(size: number) {
    this.gridSize = size;
    localStorage.setItem('terrastudio-grid-size', String(size));
    broadcastSetting('gridSize', size);
  }

  /** Toggle minimap and persist */
  setShowMinimap(show: boolean) {
    this.showMinimap = show;
    localStorage.setItem('terrastudio-minimap', String(show));
    broadcastSetting('showMinimap', show);
  }

  /** Toggle cost badges on nodes and persist */
  setShowCostBadges(show: boolean) {
    this.showCostBadges = show;
    localStorage.setItem('terrastudio-cost-badges', String(show));
    broadcastSetting('showCostBadges', show);
  }

  /** Set log level and persist */
  setLogLevel(level: LogLevel) {
    this.logLevel = level;
    localStorage.setItem('terrastudio-log-level', level);
    broadcastSetting('logLevel', level);
  }

  /** Set edge type and persist */
  setEdgeType(type: EdgeStyle) {
    this.edgeType = type;
    localStorage.setItem('terrastudio-edge-type', type);
    broadcastSetting('edgeType', type);
  }

  /** Load edge visibility from localStorage */
  private loadEdgeVisibility(): EdgeCategoryVisibility {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_EDGE_VISIBILITY };
    const stored = localStorage.getItem('terrastudio-edge-visibility');
    if (!stored) return { ...DEFAULT_EDGE_VISIBILITY };
    try {
      return { ...DEFAULT_EDGE_VISIBILITY, ...JSON.parse(stored) };
    } catch {
      return { ...DEFAULT_EDGE_VISIBILITY };
    }
  }

  /** Toggle visibility of an edge category */
  toggleEdgeVisibility(category: EdgeCategoryId) {
    this.edgeVisibility = {
      ...this.edgeVisibility,
      [category]: !this.edgeVisibility[category],
    };
    localStorage.setItem('terrastudio-edge-visibility', JSON.stringify(this.edgeVisibility));
    broadcastSetting('edgeVisibility', this.edgeVisibility);
  }

  /** Set visibility of an edge category */
  setEdgeVisibility(category: EdgeCategoryId, visible: boolean) {
    this.edgeVisibility = {
      ...this.edgeVisibility,
      [category]: visible,
    };
    localStorage.setItem('terrastudio-edge-visibility', JSON.stringify(this.edgeVisibility));
    broadcastSetting('edgeVisibility', this.edgeVisibility);
  }

  /** Check if an edge category is visible */
  isEdgeCategoryVisible(category: EdgeCategoryId): boolean {
    return this.edgeVisibility[category] ?? true;
  }

  /** Set visibility for all edge categories at once */
  setAllEdgeVisibility(visible: boolean) {
    this.edgeVisibility = {
      structural: visible,
      binding: visible,
      reference: visible,
      annotation: visible,
    };
    localStorage.setItem('terrastudio-edge-visibility', JSON.stringify(this.edgeVisibility));
    broadcastSetting('edgeVisibility', this.edgeVisibility);
  }

  /** Toggle dark/light theme */
  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('terrastudio-theme', this.theme);
    applyPalette(this.paletteId, this.theme);
    broadcastSetting('theme', this.theme);
  }

  /** Switch to a different palette */
  setPalette(id: PaletteId) {
    this.paletteId = id;
    localStorage.setItem('terrastudio-palette', id);
    applyPalette(this.paletteId, this.theme);
    broadcastSetting('paletteId', id);
  }

  /** Apply saved theme + palette to DOM (call once on startup) */
  applyTheme() {
    applyPalette(this.paletteId, this.theme);
  }

  // --- Confirm dialog ---
  confirmDialog = $state<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  /** Show a confirm dialog and return a promise that resolves to true/false. */
  confirm(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmDialog = { ...opts, resolve };
    });
  }

  /** Called by ConfirmDialog component to close and resolve. */
  resolveConfirm(confirmed: boolean) {
    this.confirmDialog?.resolve(confirmed);
    this.confirmDialog = null;
  }

  // --- Unsaved changes dialog ---
  unsavedDialog = $state<{
    resolve: (result: 'save' | 'discard' | 'cancel') => void;
  } | null>(null);

  /** Show an unsaved changes dialog. Returns 'save', 'discard', or 'cancel'. */
  confirmUnsaved(): Promise<'save' | 'discard' | 'cancel'> {
    return new Promise((resolve) => {
      this.unsavedDialog = { resolve };
    });
  }

  /** Called by UnsavedChangesDialog to close and resolve. */
  resolveUnsaved(result: 'save' | 'discard' | 'cancel') {
    this.unsavedDialog?.resolve(result);
    this.unsavedDialog = null;
  }
}

export const ui = new UiStore();

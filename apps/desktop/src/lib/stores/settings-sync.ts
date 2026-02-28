/**
 * Cross-window settings synchronization.
 *
 * When a setting changes in one window, it broadcasts a Tauri event.
 * All other windows listen for these events and apply the change locally.
 * A guard flag prevents re-broadcast loops.
 */
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ui, type EdgeStyle, type Theme } from './ui.svelte';
import { cost } from './cost.svelte';
import { terraform } from './terraform.svelte';
import { applyPalette } from '$lib/themes/theme-engine';
import { initLogging } from '$lib/bootstrap';
import type { PaletteId } from '$lib/themes/types';
import type { LogLevel } from '$lib/logger';
import type { EdgeCategoryId } from '@terrastudio/types';
import type { EdgeCategoryVisibility } from './ui.svelte';
import type { UnlistenFn } from '@tauri-apps/api/event';

const EVENT_NAME = 'settings:sync';

interface SettingsSyncPayload {
  /** Which window originated the change */
  source: string;
  /** The setting key */
  key: string;
  /** The new value (JSON-serializable) */
  value: unknown;
}

/** Guard: when true, incoming sync events are applied without re-broadcasting */
let applying = false;

let unlisten: UnlistenFn | null = null;

/**
 * Broadcast a setting change to all windows.
 * No-op if we're currently applying an incoming change (prevents loops).
 */
export function broadcastSetting(key: string, value: unknown): void {
  if (applying) return;
  const source = getCurrentWindow().label;
  emit(EVENT_NAME, { source, key, value } satisfies SettingsSyncPayload).catch(() => {});
}

/**
 * Initialize the settings sync listener. Call once per window on mount.
 */
export function initSettingsSync(): void {
  if (unlisten) return;

  const windowLabel = getCurrentWindow().label;

  listen<SettingsSyncPayload>(EVENT_NAME, ({ payload }) => {
    // Ignore events from our own window
    if (payload.source === windowLabel) return;

    applying = true;
    try {
      applySettingLocally(payload.key, payload.value);
    } finally {
      applying = false;
    }
  }).then((fn) => {
    unlisten = fn;
  }).catch(() => {});
}

/** Clean up listener on window destroy */
export function destroySettingsSync(): void {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}

function applySettingLocally(key: string, value: unknown): void {
  switch (key) {
    case 'theme':
      ui.theme = value as Theme;
      localStorage.setItem('terrastudio-theme', value as string);
      applyPalette(ui.paletteId, ui.theme);
      break;

    case 'paletteId':
      ui.paletteId = value as PaletteId;
      localStorage.setItem('terrastudio-palette', value as string);
      applyPalette(ui.paletteId, ui.theme);
      break;

    case 'edgeType':
      ui.edgeType = value as EdgeStyle;
      localStorage.setItem('terrastudio-edge-type', value as string);
      break;

    case 'snapToGrid':
      ui.snapToGrid = value as boolean;
      localStorage.setItem('terrastudio-snap', String(value));
      break;

    case 'gridSize':
      ui.gridSize = value as number;
      localStorage.setItem('terrastudio-grid-size', String(value));
      break;

    case 'showMinimap':
      ui.showMinimap = value as boolean;
      localStorage.setItem('terrastudio-minimap', String(value));
      break;

    case 'showCostBadges':
      ui.showCostBadges = value as boolean;
      localStorage.setItem('terrastudio-cost-badges', String(value));
      break;

    case 'logLevel':
      ui.logLevel = value as LogLevel;
      localStorage.setItem('terrastudio-log-level', value as string);
      initLogging(value as LogLevel);
      break;

    case 'edgeVisibility':
      ui.edgeVisibility = value as EdgeCategoryVisibility;
      localStorage.setItem('terrastudio-edge-visibility', JSON.stringify(value));
      break;

    case 'costRegion':
      cost.region = value as string;
      localStorage.setItem('ts-cost-region', value as string);
      break;

    case 'autoRegenerate':
      terraform.autoRegenerate = value as boolean;
      localStorage.setItem('terrastudio-auto-regen', String(value));
      break;
  }
}

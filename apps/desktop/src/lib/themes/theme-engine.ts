import type { ThemePalette, ThemeVariables, CustomThemeFile, PaletteId } from './types';
import { THEME_VARIABLE_KEYS, THEME_REQUIRED_KEYS } from './types';
import { builtinPalettes, DEFAULT_PALETTE_ID } from './palettes';
import type { Theme } from '$lib/stores/ui.svelte';

const customPalettes = new Map<string, ThemePalette>();
const CUSTOM_PALETTES_STORAGE_KEY = 'terrastudio-custom-palettes';

function loadCustomPalettes(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
    if (!raw) return;
    const arr: ThemePalette[] = JSON.parse(raw);
    for (const p of arr) customPalettes.set(p.id, p);
  } catch {
    // corrupted storage — ignore
  }
}

if (typeof localStorage !== 'undefined') loadCustomPalettes();

function saveCustomPalettes(): void {
  localStorage.setItem(
    CUSTOM_PALETTES_STORAGE_KEY,
    JSON.stringify(Array.from(customPalettes.values())),
  );
}

export function getPalette(id: PaletteId): ThemePalette | undefined {
  return (builtinPalettes as Map<string, ThemePalette>).get(id) ?? customPalettes.get(id);
}

export function getAllPalettes(): ThemePalette[] {
  const builtin = [...builtinPalettes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const custom = [...customPalettes.values()].sort((a, b) => a.name.localeCompare(b.name));
  return [...builtin, ...custom];
}

export function applyPalette(paletteId: PaletteId, mode: Theme): void {
  let palette = getPalette(paletteId);
  if (!palette) palette = getPalette(DEFAULT_PALETTE_ID)!;

  const vars: ThemeVariables = mode === 'dark' ? palette.dark : palette.light;
  const root = document.documentElement;

  for (const key of THEME_VARIABLE_KEYS) {
    const value = vars[key];
    if (value !== undefined) {
      root.style.setProperty(`--${key}`, value);
    } else {
      root.style.removeProperty(`--${key}`);
    }
  }

  root.setAttribute('data-theme', mode);
}

export function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

export function validateCustomTheme(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return 'Theme file must be a JSON object';

  const theme = obj as Record<string, unknown>;
  if (typeof theme.name !== 'string' || theme.name.trim().length === 0) {
    return 'Theme must have a non-empty "name" string';
  }

  for (const modeKey of ['dark', 'light'] as const) {
    if (!theme[modeKey] || typeof theme[modeKey] !== 'object') {
      return `Theme must have a "${modeKey}" object`;
    }
    const vars = theme[modeKey] as Record<string, unknown>;
    for (const key of THEME_REQUIRED_KEYS) {
      if (typeof vars[key] !== 'string') {
        return `${modeKey}."${key}" must be a CSS color string`;
      }
    }
  }

  return null;
}

export function importCustomTheme(file: CustomThemeFile): PaletteId {
  const slug = file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id: PaletteId = `custom-${slug}-${Date.now()}`;
  const palette: ThemePalette = {
    id,
    name: file.name,
    previewAccent: file.dark['color-accent'],
    dark: { ...file.dark },
    light: { ...file.light },
  };

  customPalettes.set(id, palette);
  saveCustomPalettes();
  return id;
}

export function removeCustomTheme(id: PaletteId): boolean {
  const removed = customPalettes.delete(id);
  if (removed) saveCustomPalettes();
  return removed;
}

// --- WCAG 2.1 contrast utilities ---

/** Parse a hex color (#rgb or #rrggbb) into [r, g, b] in 0–255 range */
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** WCAG 2.1 relative luminance of a hex color. Returns a value in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two hex colors. Returns a value in [1, 21]. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastViolation {
  foreground: keyof ThemeVariables;
  background: keyof ThemeVariables;
  ratio: number;
  required: number;
}

/** Color pairs to audit — [foreground key, background key, required ratio] */
const CONTRAST_PAIRS: [keyof ThemeVariables, keyof ThemeVariables, number][] = [
  ['color-text', 'color-bg', 4.5],
  ['color-text', 'color-surface', 4.5],
  ['color-text-muted', 'color-bg', 4.5],
  ['color-text-muted', 'color-surface', 4.5],
  ['color-accent', 'color-bg', 3.0],
  ['color-accent', 'color-surface', 3.0],
  ['color-status-success', 'color-surface', 3.0],
  ['color-status-error', 'color-surface', 3.0],
  ['color-status-warning', 'color-surface', 3.0],
];

/**
 * Validate ThemeVariables pairs against WCAG AA thresholds.
 * Returns an array of violations (empty = all pass).
 * Skips pairs where either color is undefined (optional fields).
 */
export function auditThemeContrast(vars: ThemeVariables): ContrastViolation[] {
  const violations: ContrastViolation[] = [];
  for (const [fg, bg, required] of CONTRAST_PAIRS) {
    const fgColor = vars[fg];
    const bgColor = vars[bg];
    if (!fgColor || !bgColor) continue;
    // Skip non-hex colors (e.g. rgba values)
    if (!fgColor.startsWith('#') || !bgColor.startsWith('#')) continue;
    const ratio = contrastRatio(fgColor, bgColor);
    if (ratio < required) {
      violations.push({ foreground: fg, background: bg, ratio, required });
    }
  }
  return violations;
}

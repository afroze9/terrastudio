import type { ThemePalette, ThemeVariables, CustomThemeFile, PaletteId } from './types';
import { THEME_VARIABLE_KEYS } from './types';
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
  return [...builtinPalettes.values(), ...customPalettes.values()];
}

export function applyPalette(paletteId: PaletteId, mode: Theme): void {
  let palette = getPalette(paletteId);
  if (!palette) palette = getPalette(DEFAULT_PALETTE_ID)!;

  const vars: ThemeVariables = mode === 'dark' ? palette.dark : palette.light;
  const root = document.documentElement;

  for (const key of THEME_VARIABLE_KEYS) {
    root.style.setProperty(`--${key}`, vars[key]);
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
    for (const key of THEME_VARIABLE_KEYS) {
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

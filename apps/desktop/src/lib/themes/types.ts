export interface ThemeVariables {
  'color-bg': string;
  'color-surface': string;
  'color-surface-hover': string;
  'color-border': string;
  'color-text': string;
  'color-text-muted': string;
  'color-accent': string;
  'color-accent-hover': string;
  'color-accent-text': string;
  'color-shadow': string;
  'scrollbar-thumb': string;
  'scrollbar-thumb-hover': string;

  // Optional accessibility fields — CSS fallbacks in app.css when absent
  'color-status-success'?: string;
  'color-status-error'?: string;
  'color-status-warning'?: string;
  'color-status-neutral'?: string;
  'color-focus-ring'?: string;
  'edge-structural'?: string;
  'edge-binding'?: string;
  'edge-reference'?: string;
  'edge-annotation'?: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  previewAccent: string;
  dark: ThemeVariables;
  light: ThemeVariables;
}

export type BuiltinPaletteId =
  | 'azure-teal'
  | 'indigo-craft'
  | 'emerald-infra'
  | 'amber-studio'
  | 'rose-signal'
  | 'cyan-circuit'
  | 'violet-dusk'
  | 'slate-mono'
  | 'high-contrast'
  | 'solarized'
  | 'nord'
  | 'monokai'
  | 'github'
  | 'colorblind-deuteranopia'
  | 'colorblind-protanopia'
  | 'colorblind-tritanopia';

export type PaletteId = BuiltinPaletteId | `custom-${string}`;

export interface CustomThemeFile {
  name: string;
  dark: ThemeVariables;
  light: ThemeVariables;
}

export const THEME_REQUIRED_KEYS: (keyof ThemeVariables)[] = [
  'color-bg',
  'color-surface',
  'color-surface-hover',
  'color-border',
  'color-text',
  'color-text-muted',
  'color-accent',
  'color-accent-hover',
  'color-accent-text',
  'color-shadow',
  'scrollbar-thumb',
  'scrollbar-thumb-hover',
];

export const THEME_OPTIONAL_KEYS: (keyof ThemeVariables)[] = [
  'color-status-success',
  'color-status-error',
  'color-status-warning',
  'color-status-neutral',
  'color-focus-ring',
  'edge-structural',
  'edge-binding',
  'edge-reference',
  'edge-annotation',
];

export const THEME_VARIABLE_KEYS: (keyof ThemeVariables)[] = [
  ...THEME_REQUIRED_KEYS,
  ...THEME_OPTIONAL_KEYS,
];

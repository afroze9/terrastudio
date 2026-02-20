export interface ThemeVariables {
  'color-bg': string;
  'color-surface': string;
  'color-surface-hover': string;
  'color-border': string;
  'color-text': string;
  'color-text-muted': string;
  'color-accent': string;
  'color-accent-hover': string;
  'color-shadow': string;
  'scrollbar-thumb': string;
  'scrollbar-thumb-hover': string;
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
  | 'slate-mono';

export type PaletteId = BuiltinPaletteId | `custom-${string}`;

export interface CustomThemeFile {
  name: string;
  dark: ThemeVariables;
  light: ThemeVariables;
}

export const THEME_VARIABLE_KEYS: (keyof ThemeVariables)[] = [
  'color-bg',
  'color-surface',
  'color-surface-hover',
  'color-border',
  'color-text',
  'color-text-muted',
  'color-accent',
  'color-accent-hover',
  'color-shadow',
  'scrollbar-thumb',
  'scrollbar-thumb-hover',
];

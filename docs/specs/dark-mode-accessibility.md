# Dark Mode Refinement & Accessibility Specification

**Spec ID**: SPEC-002
**Status**: Draft
**Created**: 2026-03-07
**PRD Source**: Product requirement — Dark Mode Refinement & Accessibility feature brief
**Author**: AI Spec Writer

---

## 1. Overview

TerraStudio's existing theme engine provides palette switching and dark/light mode toggle, but the current implementation has no formal accessibility guarantees. Color contrast ratios are ad-hoc, there are no colorblind-safe palette options, focus indicators are inconsistent, status indicators (deployment, validation) are communicated by color alone, and the app has no accommodation for reduced-motion or system font-size preferences.

This specification defines the full scope of work to bring TerraStudio to WCAG 2.1 AA compliance, expand the palette library with six new built-in palettes (including dedicated high-contrast and colorblind-safe options), and wire up system-level accessibility preferences. The work touches the theme engine, types, the UI store, global CSS, Svelte node/edge components, and the settings panel.

The changes are additive — no existing palette values are removed, no breaking changes to the `ThemeVariables` contract are introduced for custom theme importers. New optional variables are added with safe fallbacks.

---

## 2. Goals & Non-Goals

### Goals

- Audit and fix every text/background color combination in the current eight built-in palettes to meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text and UI components).
- Introduce six new built-in palettes: Solarized, Nord, Monokai, GitHub, High Contrast Light, High Contrast Dark.
- Add a dedicated High Contrast mode that overrides the active palette's contrast ratios to their maximum values.
- Provide three colorblind-safe palette variants: deuteranopia-safe, protanopia-safe, tritanopia-safe.
- Enforce visible keyboard focus rings on all interactive elements (toolbar, palette, node selection, sidebar inputs).
- Differentiate the four edge categories (`structural`, `binding`, `reference`, `annotation`) by stroke pattern in addition to color, so the canvas remains readable for colorblind users.
- Ensure deployment status and validation error indicators use both color and a distinct icon or shape — never color alone.
- Honor `prefers-reduced-motion`: disable animated edge strokes, node pulse effects, sidebar slide transitions, and theme crossfades when the system preference is active.
- Respect `prefers-contrast: more` by activating High Contrast Dark/Light automatically.
- Allow users to scale UI font size independently of system font size via an in-app setting (75% – 150%, step 25%).
- Add ARIA labels to toolbar buttons, palette items, node label headings, and sidebar form fields.
- All changes must be backward-compatible with the existing custom theme JSON import format.

### Non-Goals

- Full WCAG AAA compliance (7:1 contrast ratio) — AA is sufficient for the target audience.
- Automated CI contrast-ratio regression testing (desirable future work; out of scope for this spec).
- Screen reader full-document narration of diagram content — TerraStudio is a graphical canvas tool; ARIA is scoped to chrome elements only.
- Right-to-left (RTL) layout support.
- Changing the palette export/import JSON schema in a way that breaks existing custom themes.
- Adding colorblind simulation overlays (a filter, not a palette; future feature).

---

## 3. Background & Context

### Current theme architecture

The theme system lives entirely in `apps/desktop/src/lib/themes/`:

| File | Role |
|------|------|
| `types.ts` | `ThemeVariables` interface (11 CSS custom properties), `ThemePalette`, `PaletteId`, `CustomThemeFile` |
| `palettes.ts` | Eight built-in `ThemePalette` objects exported as `builtinPalettes: Map<BuiltinPaletteId, ThemePalette>` |
| `theme-engine.ts` | `applyPalette()` writes CSS custom properties to `document.documentElement`; custom palette CRUD |

`applyPalette(paletteId, mode)` is called by `UiStore.toggleTheme()` and `UiStore.setPalette()`. The result is that `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`, `--color-shadow`, and two scrollbar variables are live CSS custom properties on `:root`.

### Known accessibility gaps

1. **Contrast**: Several muted-text values (e.g., `color-text-muted: #7d8590` on `color-bg: #0d1117` — the Azure Teal dark theme) pass 4.5:1 for normal text only marginally or fail for small text. No systematic audit exists.
2. **Color-only status**: Deployment status dots are green/grey/red/yellow SVG circles. Validation error highlights are red borders. Both communicate solely via color.
3. **Focus rings**: Many Tailwind-styled buttons use `outline: none` or Tauri's default which is insufficient. Custom focus styles are absent.
4. **Edge categories**: All four categories have distinct default colors but identical solid stroke and arrowhead styles, making them indistinguishable without color vision.
5. **Reduced motion**: Animated edges (the `animated` flag on `EdgeLineStyle`), pulse keyframes on creating/updating nodes, and CSS transitions on panel slides are not gated by `prefers-reduced-motion`.
6. **Font scaling**: All font sizes are hardcoded px values scattered across Svelte component `<style>` blocks. No CSS variable controls them.
7. **ARIA**: Toolbar buttons have tooltips but no `aria-label`. Palette items have no accessible names. Node labels are plain `<div>` text.

---

## 4. Detailed Design

### 4.1 Architecture

```mermaid
graph TB
    subgraph "Theme System (extended)"
        TV[ThemeVariables\nextended interface]
        PAL[palettes.ts\n+6 new palettes\n+3 colorblind variants]
        TE[theme-engine.ts\napplyPalette()\ncheckContrast()\napplyFontScale()\napplyReducedMotion()]
    end

    subgraph "UI Store"
        US[ui.svelte.ts\n+highContrast: boolean\n+fontScale: number\n+reducedMotion: 'auto'|'on'|'off']
    end

    subgraph "Global CSS"
        AC[app.css\n--font-scale var\n@media prefers-reduced-motion\nfocus-visible ring]
    end

    subgraph "Canvas Components"
        DN[DefaultResourceNode.svelte\nARIA label on heading\nstatus icon+color]
        CN[ContainerResourceNode.svelte\nARIA label]
        EE[Edge components\nstroke-dasharray by category]
    end

    subgraph "Settings Panel"
        SP[AppSettings.svelte\nfont scale slider\nHC toggle\ncolorblind palette picker]
    end

    US --> TE
    TE --> AC
    TV --> PAL
    PAL --> TE
    TE --> DN
    TE --> EE
    US --> SP
```

### 4.2 Data Models / Interfaces

#### 4.2.1 Extended `ThemeVariables`

Add optional fields to `ThemeVariables`. Existing fields are untouched; new fields have safe CSS fallbacks when absent.

```typescript
// packages/types/src is not the right location for this — it lives in
// apps/desktop/src/lib/themes/types.ts

export interface ThemeVariables {
  // --- existing 11 fields ---
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

  // --- new optional fields (Phase 2) ---
  /** Color for "success / deployed" status — must have 3:1+ contrast on color-surface */
  'color-status-success'?: string;
  /** Color for "error / failed" status — must have 3:1+ contrast on color-surface */
  'color-status-error'?: string;
  /** Color for "in-progress" status — must have 3:1+ contrast on color-surface */
  'color-status-warning'?: string;
  /** Color for "destroyed / neutral" status */
  'color-status-neutral'?: string;
  /** Focus ring color — defaults to color-accent if absent */
  'color-focus-ring'?: string;
  /** Structural edge stroke color */
  'edge-structural'?: string;
  /** Binding edge stroke color */
  'edge-binding'?: string;
  /** Reference edge stroke color */
  'edge-reference'?: string;
  /** Annotation edge stroke color */
  'edge-annotation'?: string;
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
  // New optional keys (written when present):
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
```

The `applyPalette` function must skip optional keys that are `undefined` (they will fall back to CSS `:root` defaults set in `app.css`).

#### 4.2.2 Extended `BuiltinPaletteId`

```typescript
export type BuiltinPaletteId =
  | 'azure-teal'
  | 'indigo-craft'
  | 'emerald-infra'
  | 'amber-studio'
  | 'rose-signal'
  | 'cyan-circuit'
  | 'violet-dusk'
  | 'slate-mono'
  // New in this spec:
  | 'solarized'
  | 'nord'
  | 'monokai'
  | 'github'
  | 'high-contrast-light'
  | 'high-contrast-dark'
  | 'colorblind-deuteranopia'
  | 'colorblind-protanopia'
  | 'colorblind-tritanopia';
```

#### 4.2.3 Accessibility settings in `UiStore`

```typescript
// apps/desktop/src/lib/stores/ui.svelte.ts — additions

export type ReducedMotionPreference = 'auto' | 'on' | 'off';
export type FontScale = 75 | 100 | 125 | 150;

// New state fields on UiStore:
highContrast = $state<boolean>(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('terrastudio-high-contrast') === 'true'
    : false
);

fontScale = $state<FontScale>(
  typeof localStorage !== 'undefined'
    ? (Number(localStorage.getItem('terrastudio-font-scale')) as FontScale) || 100
    : 100
);

reducedMotionPref = $state<ReducedMotionPreference>(
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem('terrastudio-reduced-motion') as ReducedMotionPreference) || 'auto'
    : 'auto'
);

// Derived: true if motion should be suppressed
get reducedMotion(): boolean {
  if (this.reducedMotionPref === 'on') return true;
  if (this.reducedMotionPref === 'off') return false;
  // 'auto': respect OS preference
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
```

New methods:

```typescript
setHighContrast(enabled: boolean): void;
setFontScale(scale: FontScale): void;
setReducedMotionPref(pref: ReducedMotionPreference): void;
```

Each persists to `localStorage` and calls the appropriate `broadcastSetting(...)` call (following existing pattern).

#### 4.2.4 Edge category stroke patterns

The four categories get distinct `strokeDasharray` values used in edge rendering, independent of color. These are constants — not theme variables — ensuring pattern differentiation even in custom themes.

```typescript
// apps/desktop/src/lib/diagram/edge-category-styles.ts (new file)

import type { EdgeCategoryId } from '@terrastudio/types';

export interface EdgeCategoryVisualDefaults {
  /** SVG stroke-dasharray value. undefined = solid line. */
  dashArray: string | undefined;
  /** Default stroke width */
  strokeWidth: number;
  /** Default arrowhead at target */
  markerEnd: 'arrowClosed' | 'dot' | 'none';
}

export const EDGE_CATEGORY_VISUAL_DEFAULTS: Record<EdgeCategoryId, EdgeCategoryVisualDefaults> = {
  structural: { dashArray: undefined,  strokeWidth: 2, markerEnd: 'arrowClosed' },
  binding:    { dashArray: '6 3',      strokeWidth: 1.5, markerEnd: 'arrowClosed' },
  reference:  { dashArray: '2 3',      strokeWidth: 1.5, markerEnd: 'dot' },
  annotation: { dashArray: '8 4 2 4', strokeWidth: 1, markerEnd: 'none' },
};
```

Edge rendering components must use `dashArray` from this constant as the baseline, then allow `EdgeStyleSettings.lineStyle` overrides to replace it (existing user override behavior is preserved).

#### 4.2.5 Deployment status icon map

```typescript
// apps/desktop/src/lib/diagram/deployment-status-icons.ts (new file)

import type { DeploymentStatus } from '@terrastudio/types';

export interface StatusVisual {
  /** Tailwind/CSS color class or CSS variable name for the color indicator */
  colorVar: string;
  /** Lucide icon name (or inline SVG identifier) */
  icon: string;
  /** ARIA label for screen reader announcement */
  ariaLabel: string;
}

export const DEPLOYMENT_STATUS_VISUALS: Record<DeploymentStatus, StatusVisual> = {
  pending:   { colorVar: 'var(--color-status-neutral)',  icon: 'clock',           ariaLabel: 'Pending' },
  creating:  { colorVar: 'var(--color-status-warning)',  icon: 'loader-circle',   ariaLabel: 'Creating' },
  updating:  { colorVar: 'var(--color-status-warning)',  icon: 'refresh-cw',      ariaLabel: 'Updating' },
  created:   { colorVar: 'var(--color-status-success)',  icon: 'check-circle',    ariaLabel: 'Created' },
  failed:    { colorVar: 'var(--color-status-error)',    icon: 'x-circle',        ariaLabel: 'Failed' },
  destroyed: { colorVar: 'var(--color-status-neutral)',  icon: 'trash-2',         ariaLabel: 'Destroyed' },
};
```

### 4.3 Component Breakdown

#### 4.3.1 `app.css` — global accessibility foundations

Add the following sections to `apps/desktop/src/app.css`:

**Font scale CSS variable:**
```css
:root {
  --font-scale: 1;          /* set by theme-engine.applyFontScale() */
  --font-xs:  calc(0.625rem * var(--font-scale));  /* ~10px at 1x */
  --font-sm:  calc(0.75rem  * var(--font-scale));  /* ~12px */
  --font-base: calc(0.8125rem * var(--font-scale)); /* ~13px */
  --font-lg:  calc(0.875rem * var(--font-scale));  /* ~14px */
}
```

All hardcoded `font-size: Npx` values in component `<style>` blocks are migrated to use these variables (Phase 3 work).

**Focus ring:**
```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-accent));
  outline-offset: 2px;
  border-radius: 3px;
}

/* Remove outline for mouse users (pointer events) */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

When `ui.reducedMotion` is `true` via manual override (not OS media query), `theme-engine.ts` adds a `data-reduced-motion` attribute to `document.documentElement` and a matching CSS rule suppresses animations:

```css
[data-reduced-motion] *, [data-reduced-motion] *::before, [data-reduced-motion] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

**High contrast mode:**
When `ui.highContrast` is `true`, `theme-engine.ts` adds `data-high-contrast` to `:root`. A CSS rule boosts border visibility:
```css
[data-high-contrast] {
  --color-border: var(--color-text);
}
[data-high-contrast] *:focus-visible {
  outline-width: 3px;
}
```

#### 4.3.2 `theme-engine.ts` — new exports

```typescript
/**
 * Write --font-scale CSS variable based on the UiStore fontScale value.
 * Called by UiStore.setFontScale().
 */
export function applyFontScale(scale: FontScale): void {
  document.documentElement.style.setProperty('--font-scale', String(scale / 100));
}

/**
 * Sync reduced-motion and high-contrast data attributes.
 * Called on init and whenever either preference changes.
 */
export function applyAccessibilityAttributes(opts: {
  reducedMotion: boolean;
  highContrast: boolean;
}): void {
  const root = document.documentElement;
  root.toggleAttribute('data-reduced-motion', opts.reducedMotion);
  root.toggleAttribute('data-high-contrast', opts.highContrast);
}

/**
 * Compute the WCAG 2.1 relative luminance of a hex color.
 * Returns a value in [0, 1].
 */
export function relativeLuminance(hex: string): number { /* ... */ }

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value in [1, 21].
 */
export function contrastRatio(fg: string, bg: string): number { /* ... */ }

/**
 * Validate all ThemeVariables pairs against WCAG AA thresholds.
 * Returns an array of violations (empty = all pass).
 */
export function auditThemeContrast(vars: ThemeVariables): ContrastViolation[] { /* ... */ }

export interface ContrastViolation {
  foreground: keyof ThemeVariables;
  background: keyof ThemeVariables;
  ratio: number;
  required: number; // 4.5 for normal text, 3.0 for large/UI
}
```

The pairs to audit against are:

| Foreground | Background | Required ratio |
|---|---|---|
| `color-text` | `color-bg` | 4.5 |
| `color-text` | `color-surface` | 4.5 |
| `color-text-muted` | `color-bg` | 4.5 |
| `color-text-muted` | `color-surface` | 4.5 |
| `color-accent` | `color-bg` | 3.0 (large/UI) |
| `color-accent` | `color-surface` | 3.0 |
| `color-status-success` | `color-surface` | 3.0 |
| `color-status-error` | `color-surface` | 3.0 |
| `color-status-warning` | `color-surface` | 3.0 |

#### 4.3.3 `palettes.ts` — new palettes

**Solarized** — Ethan Schoonover's canonical Solarized palette, widely respected for low eye-strain:

```typescript
const solarized: ThemePalette = {
  id: 'solarized',
  name: 'Solarized',
  previewAccent: '#268bd2',
  dark: {
    'color-bg':             '#002b36',  // base03
    'color-surface':        '#073642',  // base02
    'color-surface-hover':  '#094656',
    'color-border':         '#586e75',  // base01
    'color-text':           '#839496',  // base0
    'color-text-muted':     '#657b83',  // base00  — VERIFY 4.5:1 on bg
    'color-accent':         '#268bd2',  // blue
    'color-accent-hover':   '#2176ae',
    'color-shadow':         'rgba(0, 0, 0, 0.4)',
    'scrollbar-thumb':      'rgba(38, 139, 210, 0.15)',
    'scrollbar-thumb-hover':'rgba(38, 139, 210, 0.3)',
    'color-status-success': '#859900',  // green
    'color-status-error':   '#dc322f',  // red
    'color-status-warning': '#b58900',  // yellow
    'color-status-neutral': '#586e75',
    'edge-structural':      '#268bd2',
    'edge-binding':         '#2aa198',
    'edge-reference':       '#859900',
    'edge-annotation':      '#586e75',
  },
  light: {
    'color-bg':             '#fdf6e3',  // base3
    'color-surface':        '#eee8d5',  // base2
    'color-surface-hover':  '#e5dfc8',
    'color-border':         '#93a1a1',  // base1
    'color-text':           '#657b83',  // base00
    'color-text-muted':     '#839496',  // base0  — VERIFY
    'color-accent':         '#268bd2',
    'color-accent-hover':   '#2176ae',
    'color-shadow':         'rgba(0, 0, 0, 0.08)',
    'scrollbar-thumb':      'rgba(38, 139, 210, 0.2)',
    'scrollbar-thumb-hover':'rgba(38, 139, 210, 0.35)',
    'color-status-success': '#859900',
    'color-status-error':   '#dc322f',
    'color-status-warning': '#b58900',
    'color-status-neutral': '#93a1a1',
    'edge-structural':      '#268bd2',
    'edge-binding':         '#2aa198',
    'edge-reference':       '#859900',
    'edge-annotation':      '#93a1a1',
  },
};
```

**Nord** — Arctic, north-bluish color palette by Arctic Ice Studio:

```typescript
const nord: ThemePalette = {
  id: 'nord',
  name: 'Nord',
  previewAccent: '#88c0d0',
  dark: {
    'color-bg':             '#2e3440',  // nord0
    'color-surface':        '#3b4252',  // nord1
    'color-surface-hover':  '#434c5e',  // nord2
    'color-border':         '#4c566a',  // nord3
    'color-text':           '#eceff4',  // nord6
    'color-text-muted':     '#d8dee9',  // nord4
    'color-accent':         '#88c0d0',  // nord8
    'color-accent-hover':   '#81a1c1',  // nord9
    'color-shadow':         'rgba(0, 0, 0, 0.35)',
    'scrollbar-thumb':      'rgba(136, 192, 208, 0.15)',
    'scrollbar-thumb-hover':'rgba(136, 192, 208, 0.3)',
    'color-status-success': '#a3be8c',  // nord14
    'color-status-error':   '#bf616a',  // nord11
    'color-status-warning': '#ebcb8b',  // nord13
    'color-status-neutral': '#4c566a',
    'edge-structural':      '#88c0d0',
    'edge-binding':         '#a3be8c',
    'edge-reference':       '#b48ead',
    'edge-annotation':      '#4c566a',
  },
  light: {
    'color-bg':             '#eceff4',  // nord6
    'color-surface':        '#e5e9f0',  // nord5
    'color-surface-hover':  '#d8dee9',  // nord4
    'color-border':         '#aebac8',
    'color-text':           '#2e3440',  // nord0
    'color-text-muted':     '#4c566a',  // nord3
    'color-accent':         '#5e81ac',  // nord10 — darker for light bg contrast
    'color-accent-hover':   '#4c6f96',
    'color-shadow':         'rgba(0, 0, 0, 0.08)',
    'scrollbar-thumb':      'rgba(94, 129, 172, 0.2)',
    'scrollbar-thumb-hover':'rgba(94, 129, 172, 0.35)',
    'color-status-success': '#558040',
    'color-status-error':   '#a8303a',
    'color-status-warning': '#8c6a00',
    'color-status-neutral': '#aebac8',
    'edge-structural':      '#5e81ac',
    'edge-binding':         '#558040',
    'edge-reference':       '#8b607e',
    'edge-annotation':      '#aebac8',
  },
};
```

**Monokai** — classic Sublime Text Monokai aesthetic:

```typescript
const monokai: ThemePalette = {
  id: 'monokai',
  name: 'Monokai',
  previewAccent: '#f92672',
  dark: {
    'color-bg':             '#272822',
    'color-surface':        '#3e3d32',
    'color-surface-hover':  '#49483e',
    'color-border':         '#75715e',
    'color-text':           '#f8f8f2',
    'color-text-muted':     '#ccc',    // lighten from #75715e to pass AA
    'color-accent':         '#f92672',
    'color-accent-hover':   '#d91f5e',
    'color-shadow':         'rgba(0, 0, 0, 0.5)',
    'scrollbar-thumb':      'rgba(249, 38, 114, 0.15)',
    'scrollbar-thumb-hover':'rgba(249, 38, 114, 0.3)',
    'color-status-success': '#a6e22e',
    'color-status-error':   '#f92672',
    'color-status-warning': '#e6db74',
    'color-status-neutral': '#75715e',
    'edge-structural':      '#66d9e8',
    'edge-binding':         '#a6e22e',
    'edge-reference':       '#ae81ff',
    'edge-annotation':      '#75715e',
  },
  light: {
    'color-bg':             '#fafaf8',
    'color-surface':        '#f0f0ea',
    'color-surface-hover':  '#e4e4da',
    'color-border':         '#ccc9b8',
    'color-text':           '#272822',
    'color-text-muted':     '#5a5848',
    'color-accent':         '#c4004e',  // darkened for light-bg contrast
    'color-accent-hover':   '#a0003e',
    'color-shadow':         'rgba(0, 0, 0, 0.08)',
    'scrollbar-thumb':      'rgba(196, 0, 78, 0.2)',
    'scrollbar-thumb-hover':'rgba(196, 0, 78, 0.35)',
    'color-status-success': '#5a8a00',
    'color-status-error':   '#c4004e',
    'color-status-warning': '#967200',
    'color-status-neutral': '#aaa89a',
    'edge-structural':      '#007396',
    'edge-binding':         '#5a8a00',
    'edge-reference':       '#6a3eb8',
    'edge-annotation':      '#ccc9b8',
  },
};
```

**GitHub** — GitHub's Primer design system colors, highly readable:

```typescript
const github: ThemePalette = {
  id: 'github',
  name: 'GitHub',
  previewAccent: '#0969da',
  dark: {
    'color-bg':             '#0d1117',
    'color-surface':        '#161b22',
    'color-surface-hover':  '#1c2128',
    'color-border':         '#30363d',
    'color-text':           '#e6edf3',
    'color-text-muted':     '#8b949e',
    'color-accent':         '#388bfd',  // blue.400 — lighter for dark bg
    'color-accent-hover':   '#58a6ff',
    'color-shadow':         'rgba(0, 0, 0, 0.4)',
    'scrollbar-thumb':      'rgba(56, 139, 253, 0.15)',
    'scrollbar-thumb-hover':'rgba(56, 139, 253, 0.3)',
    'color-status-success': '#3fb950',  // success.fg
    'color-status-error':   '#f85149',  // danger.fg
    'color-status-warning': '#d29922',  // attention.fg
    'color-status-neutral': '#8b949e',
    'edge-structural':      '#388bfd',
    'edge-binding':         '#3fb950',
    'edge-reference':       '#bc8cff',
    'edge-annotation':      '#8b949e',
  },
  light: {
    'color-bg':             '#ffffff',
    'color-surface':        '#f6f8fa',
    'color-surface-hover':  '#eaeef2',
    'color-border':         '#d0d7de',
    'color-text':           '#1f2328',
    'color-text-muted':     '#636c76',
    'color-accent':         '#0969da',
    'color-accent-hover':   '#0550ae',
    'color-shadow':         'rgba(0, 0, 0, 0.08)',
    'scrollbar-thumb':      'rgba(9, 105, 218, 0.2)',
    'scrollbar-thumb-hover':'rgba(9, 105, 218, 0.35)',
    'color-status-success': '#1a7f37',
    'color-status-error':   '#cf222e',
    'color-status-warning': '#9a6700',
    'color-status-neutral': '#636c76',
    'edge-structural':      '#0969da',
    'edge-binding':         '#1a7f37',
    'edge-reference':       '#8250df',
    'edge-annotation':      '#d0d7de',
  },
};
```

**High Contrast Light** — maximum-contrast light palette (WCAG AAA targets where possible):

```typescript
const highContrastLight: ThemePalette = {
  id: 'high-contrast-light',
  name: 'High Contrast Light',
  previewAccent: '#0000ee',
  dark: { /* mirror of dark variant below but with light backgrounds */ /* ... */ },
  light: {
    'color-bg':             '#ffffff',
    'color-surface':        '#f0f0f0',
    'color-surface-hover':  '#e0e0e0',
    'color-border':         '#000000',
    'color-text':           '#000000',
    'color-text-muted':     '#333333',  // 10:1 on white
    'color-accent':         '#0000ee',  // classic accessible blue
    'color-accent-hover':   '#0000bb',
    'color-shadow':         'rgba(0, 0, 0, 0.3)',
    'scrollbar-thumb':      'rgba(0, 0, 238, 0.3)',
    'scrollbar-thumb-hover':'rgba(0, 0, 238, 0.5)',
    'color-status-success': '#007700',
    'color-status-error':   '#cc0000',
    'color-status-warning': '#885500',
    'color-status-neutral': '#555555',
    'color-focus-ring':     '#ff6600',  // high-vis orange focus ring
    'edge-structural':      '#000000',
    'edge-binding':         '#007700',
    'edge-reference':       '#0000ee',
    'edge-annotation':      '#888888',
  },
};
```

**High Contrast Dark** — maximum-contrast dark palette:

```typescript
const highContrastDark: ThemePalette = {
  id: 'high-contrast-dark',
  name: 'High Contrast Dark',
  previewAccent: '#ffff00',
  dark: {
    'color-bg':             '#000000',
    'color-surface':        '#0a0a0a',
    'color-surface-hover':  '#1a1a1a',
    'color-border':         '#ffffff',
    'color-text':           '#ffffff',
    'color-text-muted':     '#dddddd',  // 15:1 on black
    'color-accent':         '#ffff00',  // high-vis yellow on black: 19.6:1
    'color-accent-hover':   '#e6e600',
    'color-shadow':         'rgba(255, 255, 255, 0.15)',
    'scrollbar-thumb':      'rgba(255, 255, 0, 0.3)',
    'scrollbar-thumb-hover':'rgba(255, 255, 0, 0.5)',
    'color-status-success': '#00ff88',
    'color-status-error':   '#ff4444',
    'color-status-warning': '#ffcc00',
    'color-status-neutral': '#888888',
    'color-focus-ring':     '#ff6600',
    'edge-structural':      '#ffffff',
    'edge-binding':         '#00ff88',
    'edge-reference':       '#ffff00',
    'edge-annotation':      '#888888',
  },
  light: { /* light variant of HC dark — same bg/fg reversed */ /* ... */ },
};
```

**Colorblind palettes** use the Okabe-Ito palette for accent and edge colors, which is the scientific community standard for colorblind-safe data visualization. Only the accent and edge colors differ from a base (GitHub) palette — backgrounds and text are unchanged to avoid overwhelming users who are not used to purely academic color schemes.

```typescript
// Deuteranopia-safe (red-green confusion — most common, ~6% of males)
const colorblindDeuteranopia: ThemePalette = {
  id: 'colorblind-deuteranopia',
  name: 'Colorblind Safe (Deuteranopia)',
  previewAccent: '#0072b2',  // Okabe-Ito blue
  // Same bg/text as GitHub dark/light, but:
  // accent: #0072b2 (blue, unambiguous for deuteranopia)
  // edge-structural: #0072b2
  // edge-binding:    #e69f00  (orange, distinguishable)
  // edge-reference:  '#56b4e9' (sky blue)
  // edge-annotation: '#999999'
  // status-success:  '#009e73' (bluish green — safe for deutan)
  // status-error:    '#cc79a7' (pink/magenta — distinguishable)
  // status-warning:  '#e69f00' (orange)
  // ... full definitions in implementation
};

// Protanopia-safe (red-blind — ~1% of males)
const colorblindProtanopia: ThemePalette = {
  id: 'colorblind-protanopia',
  name: 'Colorblind Safe (Protanopia)',
  previewAccent: '#0072b2',
  // Protan-safe: avoid red entirely; use blue/yellow/orange family
  // Similar to deuteranopia palette; primary difference is avoiding
  // any hue that collapses to grey for protanopes
};

// Tritanopia-safe (blue-yellow confusion — rare, ~0.003%)
const colorblindTritanopia: ThemePalette = {
  id: 'colorblind-tritanopia',
  name: 'Colorblind Safe (Tritanopia)',
  previewAccent: '#cc79a7',
  // Tritan-safe: avoid blue/yellow confusion; use red/green/magenta family
};
```

Full Okabe-Ito color values to use: `#000000`, `#e69f00`, `#56b4e9`, `#009e73`, `#f0e442`, `#0072b2`, `#d55e00`, `#cc79a7`.

#### 4.3.4 Node component ARIA

`DefaultResourceNode.svelte` and `ContainerResourceNode.svelte` changes:

```html
<!-- Before -->
<div class="node-title">{data.label}</div>

<!-- After -->
<div class="node-title" role="heading" aria-level="3" aria-label="{data.label} ({schema.name})">
  {data.label}
</div>
```

Deployment status badge:

```html
<!-- Before: color-only dot -->
<span class="status-dot" style="background: {statusColor}"></span>

<!-- After: icon + color + aria-label -->
<span
  class="status-badge"
  aria-label="{DEPLOYMENT_STATUS_VISUALS[deploymentStatus].ariaLabel}"
  title="{DEPLOYMENT_STATUS_VISUALS[deploymentStatus].ariaLabel}"
>
  <svelte:component this={getStatusIcon(deploymentStatus)} size={10}
    style="color: {DEPLOYMENT_STATUS_VISUALS[deploymentStatus].colorVar}" />
</span>
```

Validation error indicator:

```html
<!-- Before: red border only -->

<!-- After: border + warning icon in node header -->
{#if data.validationErrors.length > 0}
  <span class="validation-indicator" aria-label="{data.validationErrors.length} validation error(s)">
    <AlertTriangle size={10} aria-hidden="true" />
    <span class="sr-only">{data.validationErrors.length} validation error(s)</span>
  </span>
{/if}
```

#### 4.3.5 Toolbar and palette ARIA

Toolbar buttons (in `Toolbar.svelte` or equivalent) gain `aria-label` attributes matching their tooltip text. Example:

```html
<button aria-label="Export diagram as PNG" title="Export diagram as PNG">
  <Download size={16} aria-hidden="true" />
</button>
```

Palette picker items:

```html
<button
  role="radio"
  aria-checked={paletteId === palette.id}
  aria-label="Select {palette.name} palette"
>
  ...
</button>
```

#### 4.3.6 Font size in settings panel

In `apps/desktop/src/lib/components/AppSettings.svelte` (or the settings view), add a font scale control:

```html
<label for="font-scale-select">UI Font Size</label>
<select id="font-scale-select" bind:value={fontScale} on:change={() => ui.setFontScale(fontScale)}>
  <option value={75}>Small (75%)</option>
  <option value={100}>Default (100%)</option>
  <option value={125}>Large (125%)</option>
  <option value={150}>Extra Large (150%)</option>
</select>
```

### 4.4 API / Contract Changes

- `ThemeVariables` gains optional fields — backward-compatible. Custom theme importers that omit the new fields will use CSS fallback defaults from `app.css`.
- `THEME_VARIABLE_KEYS` array grows; `applyPalette` must skip `undefined` optional entries.
- `BuiltinPaletteId` union grows — additive, not breaking.
- `UiStore` gains three new state fields and three new methods — additive.
- `validateCustomTheme()` in `theme-engine.ts` must **not** require the new optional keys so existing custom themes remain importable.

---

## 5. Implementation Plan

### 5.1 Phases

**Phase 1 — Contrast Audit & Type Foundation (1–2 days)**

Audit all existing eight palettes against the pair matrix defined in §4.3.2. Fix any failing values. Extend `ThemeVariables` with the optional fields. Update `THEME_VARIABLE_KEYS`. Update `applyPalette` to skip `undefined` optional keys. Update `validateCustomTheme` to not require optional fields. Add `relativeLuminance`, `contrastRatio`, `auditThemeContrast` to `theme-engine.ts`.

**Phase 2 — New Palettes (1–2 days)**

Add all nine new palettes to `palettes.ts` (Solarized, Nord, Monokai, GitHub, HC Light, HC Dark, three colorblind). Extend `BuiltinPaletteId`. Wire new palettes into `builtinPalettes` Map. Fill in all optional color fields for each new palette using the specifications in §4.3.3 and verified Okabe-Ito values for colorblind palettes.

**Phase 3 — CSS Foundation & Font Scale (1 day)**

Add font scale custom properties to `app.css`. Add `focus-visible` CSS rule. Add reduced-motion media query. Add `data-high-contrast` and `data-reduced-motion` attribute rules. Add `applyFontScale` and `applyAccessibilityAttributes` to `theme-engine.ts`. Add `highContrast`, `fontScale`, `reducedMotionPref` state and their setters/getters to `UiStore`. Wire `applyTheme()` call to also invoke `applyFontScale` and `applyAccessibilityAttributes`.

**Phase 4 — Edge Pattern Differentiation (0.5 days)**

Create `apps/desktop/src/lib/diagram/edge-category-styles.ts` with `EDGE_CATEGORY_VISUAL_DEFAULTS`. Update edge rendering components to read `dashArray` from this constant as the baseline (before applying user overrides). Verify all four categories are distinguishable in both dark and light mode by inspection.

**Phase 5 — Status Indicators (1 day)**

Create `apps/desktop/src/lib/diagram/deployment-status-icons.ts`. Update `DefaultResourceNode.svelte` and `ContainerResourceNode.svelte` to render the icon+color badge instead of a color-only dot. Add the validation error icon indicator in node headers. Update `app.css` with CSS variable defaults for `--color-status-*` so nodes are correct even on palettes that don't define the new optional fields (fallback: success=green, error=red, warning=amber, neutral=grey).

**Phase 6 — ARIA & Focus (1 day)**

Add `aria-label` to all toolbar buttons. Update palette picker items with `role="radio"` and `aria-checked`. Add `role="heading"` and `aria-label` to node label elements. Add `aria-label` to sidebar form fields that lack `<label>` associations. Add `.sr-only` CSS utility class to `app.css` for screen-reader-only text.

**Phase 7 — Settings UI (0.5 days)**

Add font scale selector, high contrast toggle, and reduced motion preference dropdown to the App Settings panel. Wire all three to the new `UiStore` methods. Verify changes persist across app restarts via `localStorage`.

**Phase 8 — Font Size Migration (1–2 days)**

Replace hardcoded `font-size: Npx` values in Svelte component `<style>` blocks with `var(--font-xs)` / `var(--font-sm)` / `var(--font-base)` / `var(--font-lg)` as appropriate. This is a broad sweep across node components, edge label components, sidebar form elements, and toolbar items. Visual regression testing required.

### 5.2 File Changes

| Action | File |
|--------|------|
| Modify | `apps/desktop/src/lib/themes/types.ts` — extend `ThemeVariables`, `BuiltinPaletteId`, `THEME_VARIABLE_KEYS` |
| Modify | `apps/desktop/src/lib/themes/palettes.ts` — add 9 new palette objects, extend `builtinPalettes` map |
| Modify | `apps/desktop/src/lib/themes/theme-engine.ts` — add contrast utils, `applyFontScale`, `applyAccessibilityAttributes`, update `applyPalette` for optional vars |
| Modify | `apps/desktop/src/lib/stores/ui.svelte.ts` — add `highContrast`, `fontScale`, `reducedMotionPref` state + setters |
| Modify | `apps/desktop/src/app.css` — font scale vars, focus-visible ring, reduced-motion query, sr-only utility, data-attr rules |
| Create | `apps/desktop/src/lib/diagram/edge-category-styles.ts` |
| Create | `apps/desktop/src/lib/diagram/deployment-status-icons.ts` |
| Modify | `apps/desktop/src/lib/components/DefaultResourceNode.svelte` — ARIA, status icon badge |
| Modify | `apps/desktop/src/lib/components/ContainerResourceNode.svelte` — ARIA, status icon badge |
| Modify | `apps/desktop/src/lib/components/ModuleInstanceNode.svelte` — ARIA |
| Modify | Edge rendering component(s) — add stroke-dasharray from category defaults |
| Modify | Toolbar component — add `aria-label` to all buttons |
| Modify | Palette picker component — add `role`, `aria-checked`, `aria-label` |
| Modify | App Settings component — add font scale, HC toggle, reduced motion preference |
| Modify | Sidebar form fields — add missing `<label>` for associations |

### 5.3 Dependencies

No new npm packages are required. Lucide icons (already a dependency via `lucide-svelte`) provide the status icons. The contrast ratio math is pure arithmetic — no external library needed.

If a contrast audit helper for development is desired (Phase 1), the developer can use the browser-based [APCA Contrast Calculator](https://www.myndex.com/APCA/) or install the `color-contrast` npm package locally for verification scripts only (not bundled).

---

## 6. Edge Cases & Error Handling

**Custom themes missing optional fields**: `applyPalette` iterates `THEME_VARIABLE_KEYS` and calls `root.style.setProperty` only when `vars[key] !== undefined`. CSS fallback values in `app.css` ensure status and edge colors are always defined. No runtime error occurs.

**`prefers-reduced-motion` OS preference changes at runtime**: The derived `ui.reducedMotion` getter evaluates `window.matchMedia(...)` at call time. For runtime OS preference changes to be reflected without a full re-render, a `MediaQueryList` event listener should be added in `bootstrap.ts` that calls `ui.applyTheme()` when the preference changes. This is a known limitation if not wired; the setting will correct itself on the next explicit palette/theme change.

**High contrast + colorblind palette combination**: If a user selects a colorblind palette and also toggles High Contrast, the `data-high-contrast` attribute CSS boost (`--color-border: var(--color-text)`) overrides border color but does not affect the colorblind-safe accent/edge colors, which is correct — the palette's edge colors remain pattern+color differentiated. No special handling needed.

**Font scale + compact node mode**: Compact nodes use icon-only display. Font scale affects label text only. In compact mode with 150% font scale, the label is hidden anyway — no layout conflict. In non-compact mode, labels may overflow at 150%. The node containers should use `overflow: hidden; text-overflow: ellipsis` to clamp text, which should already be the case.

**Validation errors + deployment status badge overlap**: If a node has both validation errors and a deployment status, the header area may become crowded. The design should place the validation indicator (triangle) on the left of the header and the deployment badge on the right, which avoids overlap. If compact mode is active, the node body is small — both indicators should be 10px icons maximum.

**`color-text-muted` in Solarized dark**: Solarized's base00 (`#657b83`) on base03 (`#002b36`) yields approximately 4.1:1 contrast — slightly below WCAG AA 4.5:1. This value must be adjusted during implementation (e.g., to `#7b939d`) to pass the audit. The spec values above are reference points; the Phase 1 audit will produce the final corrected values.

---

## 7. Testing Strategy

**Manual contrast audit (Phase 1)**: For each of the 8 existing palettes × 2 modes × 4 color pairs = 64 contrast checks. Use `auditThemeContrast()` in the browser console by temporarily exporting it. Log violations and fix palette values.

**New palette visual review**: After Phase 2, open the palette picker and step through all 17 palettes in both dark and light modes. Verify nodes, edges, status badges, and text are all legible at each palette.

**Colorblind simulation**: Use the Chrome DevTools Rendering panel (Emulate vision deficiencies) to validate the three colorblind palettes — deuteranopia, protanopia, tritanopia. Verify that edge categories remain distinguishable by stroke pattern alone when color perception is simulated.

**Keyboard navigation walkthrough**: With the mouse disconnected, Tab through the full app: toolbar buttons, activity bar, palette items, canvas (node selection via keyboard), sidebar form fields. Verify every interactive element shows a visible focus ring. Verify no keyboard traps exist.

**Reduced motion**: Enable `prefers-reduced-motion` in OS settings (or via Chrome DevTools), open the app, add nodes and edges. Verify: no CSS transitions on panel open/close, no animated edge strokes, no pulsing/spinning on "creating" status nodes. Then set `reducedMotionPref` to 'on' in settings and verify same behavior without OS change.

**Font scale**: Set font scale to 150% and 75%. Verify no layout breakages in the sidebar, toolbar, palette, and node labels. Verify canvas node text is legible.

**Status icons**: Trigger each `DeploymentStatus` state on a node (using the MCP `set_deployment_status` tool or directly mutating `diagram.svelte.ts` in dev). Verify the correct icon and color appear, and that the `aria-label` is present (inspect via browser accessibility tree).

**Screen reader spot-check**: Use Windows Narrator or NVDA (available on the dev machine) to navigate the toolbar. Verify each button is announced with its `aria-label`. Verify selected palette item is announced as "checked".

---

## 8. Security & Performance Considerations

**Performance**: `auditThemeContrast()` is a development-time utility only. It performs 9 simple arithmetic contrast ratio calculations and should not be called in production hot paths. `applyPalette()` already runs on every theme toggle — the new optional-key loop adds at most 8 extra `setProperty` calls, which is negligible.

**Font scale**: CSS custom property `--font-scale` multiplied into `calc()` expressions is handled entirely by the browser layout engine. No JavaScript measurement or layout thrashing occurs.

**Palette count growth**: The `builtinPalettes` Map grows from 8 to 17 entries. All palette objects are plain JSON-serializable objects. Memory impact is negligible (< 5 KB additional).

**Custom theme validation**: The `validateCustomTheme` function must continue to accept themes missing the new optional fields. Do not add required validation for the new keys. This prevents breakage for any user-shared custom themes in the wild.

**No external requests**: All palette data is bundled. No CDN or external font requests are introduced by this feature.

**Color value sanitization**: `ThemeVariables` values are written directly to `document.documentElement.style.setProperty`. While this is a trusted context (Tauri WebView with no user-controlled HTML injection path), the `validateCustomTheme` function should remain the gatekeeper for externally imported theme files. Optionally, a regex check (`/^(#[0-9a-f]{3,8}|rgba?\(.*\)|hsla?\(.*\)|[a-z]+)$/i`) can be added to `validateCustomTheme` to prevent injection of malformed CSS, but this is hardening-level, not blocking.

---

## 9. Open Questions

**Q1 — Solarized `color-text-muted` contrast**: Solarized dark's base00 on base03 is approximately 4.1:1 — below AA for normal text. Should the muted text value be lightened (breaking strict Solarized fidelity) or should the Solarized palette be labeled as "not AA compliant" with a warning in the picker? **Recommend**: Lighten by 10–15% and keep the Solarized name; users care more about accessibility than strict fidelity. Decision needed from design/product.

**Q2 — Colorblind palette completeness**: The spec describes colorblind palettes as variants of GitHub (same bg/text, different accent/edges). An alternative is to build them as fully independent palettes. Which approach better serves users? Full independence gives more visual differentiation but is more maintenance. Recommend GitHub-base variant approach; revisit in a future iteration if users request more differentiated aesthetics.

**Q3 — `prefers-contrast: more` auto-activation**: Should selecting a High Contrast palette automatically happen when the OS media query `(prefers-contrast: more)` is active on launch? This would be ergonomic but could override a user's explicit palette choice. Recommend: activate HC Dark/Light automatically only on first launch if preference is detected; thereafter, respect the stored `terrastudio-palette` localStorage key.

**Q4 — Phase 8 scope**: The font-size migration touches every Svelte component with hardcoded `font-size: Npx`. This is broad and carries risk of visual regressions. Should Phase 8 be a separate minor version (0.x.0) or bundled with the accessibility work? Recommend: ship Phases 1–7 as one release, then Phase 8 as a follow-up patch release with focused visual review.

**Q5 — `high-contrast-light` dark variant**: The `highContrastLight` palette spec above marks the `dark` variant as `/* ... */`. High contrast palettes are typically designed for one mode. Should `high-contrast-light` expose a dark variant at all, or should selecting it always force light mode? Similarly for `high-contrast-dark`. Recommend: force mode — `high-contrast-light` always applies in light mode; `high-contrast-dark` always applies in dark mode. This requires `applyPalette` or `UiStore.setPalette` to also set `ui.theme` when a HC palette is chosen.

---

## 10. References

- [WCAG 2.1 AA Success Criterion 1.4.3 — Contrast (Minimum)](https://www.w3.org/TR/WCAG21/#contrast-minimum)
- [WCAG 2.1 AA Success Criterion 1.4.1 — Use of Color](https://www.w3.org/TR/WCAG21/#use-of-color)
- [WCAG 2.1 AA Success Criterion 2.4.7 — Focus Visible](https://www.w3.org/TR/WCAG21/#focus-visible)
- [WCAG 2.1 AA Success Criterion 1.4.13 — Content on Hover or Focus](https://www.w3.org/TR/WCAG21/#content-on-hover-or-focus)
- [Okabe-Ito colorblind-safe palette](https://jfly.uni-koeln.de/color/) — the scientific standard for colorblind-safe data visualization
- [Solarized palette specification](https://ethanschoonover.com/solarized/) — canonical color values
- [Nord palette specification](https://www.nordtheme.com/docs/colors-and-palettes) — canonical color values
- [GitHub Primer color system](https://primer.style/foundations/color/overview) — Primer design token values
- [Monokai color reference](https://monokai.pro/themes) — Sublime Text Monokai Pro values
- [prefers-reduced-motion MDN reference](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- `apps/desktop/src/lib/themes/types.ts` — current `ThemeVariables` interface
- `apps/desktop/src/lib/themes/palettes.ts` — current eight built-in palettes
- `apps/desktop/src/lib/themes/theme-engine.ts` — `applyPalette`, custom palette CRUD
- `apps/desktop/src/lib/stores/ui.svelte.ts` — `UiStore`, theme/palette state
- `packages/types/src/edge.ts` — `EdgeCategoryId`, `EdgeStyleDefinition`
- `packages/types/src/node.ts` — `DeploymentStatus`

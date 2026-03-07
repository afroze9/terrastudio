/**
 * BCP 47 locale tag. Extend the union as new locales are added.
 */
export type LocaleCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'zh-CN';

/**
 * Flat or nested translation dictionary.
 * Keys use dot-notation at access time: "menu.file.save"
 * but the JSON files use nested objects for readability.
 */
export interface TranslationDict {
  [key: string]: string | TranslationDict;
}

/**
 * A plugin's locale contribution: maps LocaleCode to a flat/nested dict
 * that will be merged under a plugin-specific namespace key.
 */
export interface PluginLocaleBundle {
  /** Namespace prefix, e.g. "plugin.azurerm" — auto-derived from plugin.id */
  readonly namespace: string;
  /** Map of locale code -> translations for that namespace */
  readonly locales: Partial<Record<LocaleCode, TranslationDict>>;
}

/**
 * Interpolation variables passed to t() for dynamic string segments.
 * e.g. t('status.running', { command: 'plan' }) -> "Running terraform plan..."
 */
export type InterpolationVars = Record<string, string | number>;

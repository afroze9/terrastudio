import type { LocaleCode, TranslationDict, PluginLocaleBundle, InterpolationVars } from '@terrastudio/types';
import { broadcastSetting } from '$lib/stores/settings-sync';

const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'es', 'fr', 'de', 'ja', 'zh-CN'];

class I18nStore {
  locale = $state<LocaleCode>('en');

  /**
   * Merged flat translation table for the active locale.
   * Keys are dot-separated, e.g. "menu.file.save".
   * Rebuilt whenever locale changes or plugin bundles are added.
   */
  private _translations = $state<Record<string, string>>({});

  /** English fallback — always loaded; never evicted */
  private _fallback: Record<string, string> = {};

  /** Accumulated plugin locale bundles (registered at plugin load time) */
  private _pluginBundles: PluginLocaleBundle[] = [];

  /** True once the first locale load completes */
  ready = $state(false);

  /**
   * Initialize: detect locale, load base JSON, apply.
   * Called once from bootstrap.ts.
   */
  async init(): Promise<void> {
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem('terrastudio-locale') as LocaleCode | null
      : null;
    const detected = this.detectOsLocale();
    const locale: LocaleCode = saved ?? detected ?? 'en';

    await this.loadBaseLocale('en');
    this._fallback = { ...this._translations };

    if (locale !== 'en') {
      await this.loadBaseLocale(locale);
    }

    this.locale = locale;
    this.ready = true;
  }

  /** Set locale, persist, reload translations, broadcast to other windows */
  async setLocale(code: LocaleCode): Promise<void> {
    await this.loadBaseLocale(code);
    this.locale = code;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('terrastudio-locale', code);
    }
    broadcastSetting('locale', code);
  }

  /** Called by pluginRegistry after each plugin loads */
  registerPluginLocales(bundle: PluginLocaleBundle): void {
    this._pluginBundles.push(bundle);
    this.applyPluginBundle(bundle);
  }

  /** Main translation function — reactive because it reads _translations ($state) */
  t(key: string, vars?: InterpolationVars): string {
    const raw = this._translations[key] ?? this._fallback[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  }

  /** Locale-aware number formatting */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.locale, options).format(value);
  }

  /** Locale-aware currency formatting */
  formatCurrency(value: number, currency = 'USD'): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Locale-aware relative time (e.g. "3 days ago") */
  formatRelativeTime(ms: number): string {
    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });
    const diff = ms - Date.now();
    const seconds = Math.round(diff / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    if (Math.abs(days) >= 1) return rtf.format(days, 'day');
    if (Math.abs(hours) >= 1) return rtf.format(hours, 'hour');
    if (Math.abs(minutes) >= 1) return rtf.format(minutes, 'minute');
    return rtf.format(seconds, 'second');
  }

  private async loadBaseLocale(code: LocaleCode): Promise<void> {
    try {
      const module = await import(`./locales/${code}.json`);
      const flat = flattenDict(module.default as TranslationDict);
      // Merge: plugin bundle keys persist; base keys update
      this._translations = { ...flat, ...this.buildPluginTranslations(code) };
    } catch (e) {
      console.warn(`[i18n] Failed to load locale "${code}", keeping current translations`, e);
    }
  }

  private applyPluginBundle(bundle: PluginLocaleBundle): void {
    const dict = bundle.locales[this.locale] ?? bundle.locales['en'] ?? {};
    const flat = flattenDict(dict, bundle.namespace);
    this._translations = { ...this._translations, ...flat };
  }

  private buildPluginTranslations(code: LocaleCode): Record<string, string> {
    const result: Record<string, string> = {};
    for (const bundle of this._pluginBundles) {
      const dict = bundle.locales[code] ?? bundle.locales['en'] ?? {};
      Object.assign(result, flattenDict(dict, bundle.namespace));
    }
    return result;
  }

  private detectOsLocale(): LocaleCode | null {
    const lang = typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
    // Exact match first
    if (SUPPORTED_LOCALES.includes(lang as LocaleCode)) return lang as LocaleCode;
    // Prefix match (e.g. 'en-GB' → 'en')
    const prefix = lang.split('-')[0];
    return SUPPORTED_LOCALES.find((l) => l.startsWith(prefix)) ?? null;
  }
}

/** Flatten nested dict to dot-notation keys with optional prefix */
function flattenDict(
  obj: TranslationDict,
  prefix = '',
  result: Record<string, string> = {},
): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else {
      flattenDict(value, fullKey, result);
    }
  }
  return result;
}

export const i18n = new I18nStore();

/** Convenience shorthand — import { t } from '$lib/i18n' */
export const t = (key: string, vars?: InterpolationVars) => i18n.t(key, vars);

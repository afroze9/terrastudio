import { i18n } from './store.svelte.js';
import type { ResourceSchema, PropertySchema } from '@terrastudio/types';

/** Resolve the localized display name for a resource schema */
export function getResourceDisplayName(schema: ResourceSchema): string {
  const key = `plugin.${schema.provider}.resources.${schema.typeId.replace(/\//g, '_')}.displayName`;
  const translated = i18n.t(key);
  return translated === key ? schema.displayName : translated;
}

/** Resolve the localized description for a resource schema */
export function getResourceDescription(schema: ResourceSchema): string {
  const key = `plugin.${schema.provider}.resources.${schema.typeId.replace(/\//g, '_')}.description`;
  const translated = i18n.t(key);
  return translated === key ? schema.description : translated;
}

/** Resolve the localized label for a property schema */
export function getPropertyLabel(schema: ResourceSchema, prop: PropertySchema): string {
  const typeKey = schema.typeId.replace(/\//g, '_');
  const key = `plugin.${schema.provider}.resources.${typeKey}.properties.${prop.key}.label`;
  const translated = i18n.t(key);
  return translated === key ? prop.label : translated;
}

/** Resolve the localized placeholder for a property schema */
export function getPropertyPlaceholder(schema: ResourceSchema, prop: PropertySchema): string | undefined {
  if (!prop.placeholder) return undefined;
  const typeKey = schema.typeId.replace(/\//g, '_');
  const key = `plugin.${schema.provider}.resources.${typeKey}.properties.${prop.key}.placeholder`;
  const translated = i18n.t(key);
  return translated === key ? prop.placeholder : translated;
}

/** Resolve a palette category label contributed by a plugin */
export function getCategoryLabel(pluginId: string, categoryId: string, fallback: string): string {
  const key = `plugin.${pluginId}.categories.${categoryId}`;
  const translated = i18n.t(key);
  return translated === key ? fallback : translated;
}

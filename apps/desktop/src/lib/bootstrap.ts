import { pluginRegistry } from '@terrastudio/core';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import ContainerResourceNode from '$lib/components/ContainerResourceNode.svelte';
import ModuleNode from '$lib/components/ModuleNode.svelte';
import ModuleInstanceNode from '$lib/components/ModuleInstanceNode.svelte';
import StickyNoteNode from '$lib/components/StickyNoteNode.svelte';
import { TerraStudioEdge } from '$lib/components/edges';
import { checkTerraform } from '$lib/services/terraform-service';
import { logger, setLoggerLevel, type LogLevel } from '$lib/logger';
import { i18n } from '$lib/i18n';
import { validation } from '$lib/stores/validation.svelte';
import type { Component } from 'svelte';
import type { EdgeTypes } from '@xyflow/svelte';
import type { ProviderId } from '@terrastudio/types';

/**
 * The reactive plugin registry. Exported as `registry` for backward compatibility
 * with all existing callers: registry.getResourceSchema(), registry.getIcon(), etc.
 */
export const registry = pluginRegistry;

let declared = false;

/**
 * Register lazy plugin factories for each cloud provider.
 * Call once at app startup — synchronous and instant.
 * No plugin modules are imported or evaluated here.
 */
export function declarePlugins(): void {
  if (declared) return;
  declared = true;

  // Wire up i18n plugin locale registration
  pluginRegistry.inner.setPluginLoadedCallback((plugin) => {
    if (plugin.locales) {
      i18n.registerPluginLocales({
        namespace: `plugin.${plugin.id}`,
        locales: plugin.locales,
      });
    }
  });

  // Annotations — always available regardless of active cloud providers
  pluginRegistry.registerLazyPlugin('_annotation', () => import('@terrastudio/plugin-annotations'));

  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-networking'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-compute'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-storage'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-database'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-monitoring'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-security'));
  // AWS
  pluginRegistry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-networking'));
  pluginRegistry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-compute'));
  // Future providers:
  // pluginRegistry.registerLazyPlugin('google', () => import('@terrastudio/plugin-gcp-compute'));
  logger.debug('[bootstrap] Plugin factories declared');
}

/**
 * Load plugins for the given provider IDs.
 * Called by project-service.ts before opening a project.
 * Idempotent — already-loaded providers are skipped.
 */
export async function loadPluginsForProject(providerIds: ProviderId[]): Promise<void> {
  // Always load annotation plugin alongside cloud providers
  const allProviders = providerIds.includes('_annotation') ? providerIds : ['_annotation', ...providerIds];
  logger.info(`[bootstrap] Loading plugins for providers: [${allProviders.join(', ')}]`);
  const t0 = performance.now();
  await pluginRegistry.loadPluginsForProviders(allProviders);
  logger.info(`[bootstrap] Plugins loaded in ${Math.round(performance.now() - t0)}ms`);
}

/** Apply the persisted log level to both the JS logger and Rust backend. */
export function initLogging(level: LogLevel): void {
  setLoggerLevel(level);
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('set_log_level', { level }).catch(console.warn);
  }).catch(console.warn);
}

export function initializeTerraformCheck(): void {
  checkTerraform();
}

/** Start background validation (reactive watcher on diagram changes). */
export function initValidation(): void {
  validation.init();
}

/**
 * Builds the Svelte Flow nodeTypes map from currently-loaded plugins.
 * Container resources get ContainerResourceNode, others get DefaultResourceNode.
 * Canvas.svelte only mounts after project.open() which awaits plugin load,
 * so all relevant plugins are guaranteed loaded before this is called.
 */
export function buildNodeTypes(): Record<string, Component<any>> {
  const map: Record<string, Component<any>> = {};
  for (const typeId of pluginRegistry.inner.getResourceTypeIds()) {
    if (typeId === '_annotation/general/sticky_note') {
      map[typeId] = StickyNoteNode;
      continue;
    }
    const schema = pluginRegistry.inner.getResourceSchema(typeId);
    map[typeId] = schema?.isContainer ? ContainerResourceNode : DefaultResourceNode;
  }
  // Synthetic node type for collapsed modules
  map['_terrastudio/module'] = ModuleNode;
  // Synthetic node type for module template instances
  map['_terrastudio/module_instance'] = ModuleInstanceNode;
  return map;
}

/**
 * Builds the Svelte Flow edgeTypes map.
 * All edge types use TerraStudioEdge which handles category-based styling.
 */
export const edgeTypes = {
  default: TerraStudioEdge,
  smoothstep: TerraStudioEdge,
  step: TerraStudioEdge,
  straight: TerraStudioEdge,
} as EdgeTypes;

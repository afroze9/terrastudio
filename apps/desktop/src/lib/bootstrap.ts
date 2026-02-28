import { pluginRegistry } from '@terrastudio/core';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import ContainerResourceNode from '$lib/components/ContainerResourceNode.svelte';
import { TerraStudioEdge } from '$lib/components/edges';
import { checkTerraform } from '$lib/services/terraform-service';
import { setLoggerLevel, type LogLevel } from '$lib/logger';
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

  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-networking'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-compute'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-storage'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-database'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-monitoring'));
  pluginRegistry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-security'));
  // Future providers:
  // pluginRegistry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-compute'));
  // pluginRegistry.registerLazyPlugin('google', () => import('@terrastudio/plugin-gcp-compute'));
}

/**
 * Load plugins for the given provider IDs.
 * Called by project-service.ts before opening a project.
 * Idempotent — already-loaded providers are skipped.
 */
export async function loadPluginsForProject(providerIds: ProviderId[]): Promise<void> {
  await pluginRegistry.loadPluginsForProviders(providerIds);
  // Initialize MCP sync after plugins are loaded (lazy + non-blocking)
  initMcpLazy();
}

let mcpStarted = false;

/** Lazy-init MCP: wire up per-window sync + listeners on every window.
 *  Only the main window starts the IPC bridge + sidecar process. */
function initMcpLazy(): void {
  if (mcpStarted) return;
  mcpStarted = true;

  // Every window: diagram sync + bridge listener (per-window targeted)
  import('$lib/mcp/diagram-sync.svelte').then((m) => m.initDiagramSync()).catch(console.warn);
  import('$lib/mcp/bridge-listener').then((m) => m.initBridgeListener()).catch(console.warn);

  // Only the main window starts the IPC bridge + Node sidecar
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    if (getCurrentWindow().label === 'main') {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('mcp_start').catch(console.warn);
      }).catch(console.warn);
    }
  }).catch(console.warn);
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

/**
 * Builds the Svelte Flow nodeTypes map from currently-loaded plugins.
 * Container resources get ContainerResourceNode, others get DefaultResourceNode.
 * Canvas.svelte only mounts after project.open() which awaits plugin load,
 * so all relevant plugins are guaranteed loaded before this is called.
 */
export function buildNodeTypes(): Record<string, Component<any>> {
  const map: Record<string, Component<any>> = {};
  for (const typeId of pluginRegistry.inner.getResourceTypeIds()) {
    const schema = pluginRegistry.inner.getResourceSchema(typeId);
    map[typeId] = schema?.isContainer ? ContainerResourceNode : DefaultResourceNode;
  }
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

import { PluginRegistry } from '@terrastudio/core';
import networkingPlugin from '@terrastudio/plugin-azure-networking';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import type { ResourceTypeId } from '@terrastudio/types';

export const registry = new PluginRegistry();

export function initializePlugins(): void {
  registry.registerPlugin(networkingPlugin);
  registry.finalize();
}

/**
 * Builds the Svelte Flow nodeTypes map.
 * Uses DefaultResourceNode for all types that don't have a custom component.
 */
export function buildNodeTypes(): Record<string, typeof DefaultResourceNode> {
  const map: Record<string, typeof DefaultResourceNode> = {};
  for (const typeId of registry.getResourceTypeIds()) {
    map[typeId] = DefaultResourceNode;
  }
  return map;
}

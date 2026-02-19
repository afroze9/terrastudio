import { PluginRegistry } from '@terrastudio/core';
import networkingPlugin from '@terrastudio/plugin-azure-networking';
import computePlugin from '@terrastudio/plugin-azure-compute';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import ContainerResourceNode from '$lib/components/ContainerResourceNode.svelte';
import type { Component } from 'svelte';

export const registry = new PluginRegistry();

export function initializePlugins(): void {
  registry.registerPlugin(networkingPlugin);
  registry.registerPlugin(computePlugin);
  registry.finalize();
}

/**
 * Builds the Svelte Flow nodeTypes map.
 * Container resources get ContainerResourceNode, others get DefaultResourceNode.
 */
export function buildNodeTypes(): Record<string, Component<any>> {
  const map: Record<string, Component<any>> = {};
  for (const typeId of registry.getResourceTypeIds()) {
    const schema = registry.getResourceSchema(typeId);
    map[typeId] = schema?.isContainer ? ContainerResourceNode : DefaultResourceNode;
  }
  return map;
}

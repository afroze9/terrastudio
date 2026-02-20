import { PluginRegistry, EdgeRuleValidator } from '@terrastudio/core';
import networkingPlugin from '@terrastudio/plugin-azure-networking';
import computePlugin from '@terrastudio/plugin-azure-compute';
import storagePlugin from '@terrastudio/plugin-azure-storage';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import ContainerResourceNode from '$lib/components/ContainerResourceNode.svelte';
import { checkTerraform } from '$lib/services/terraform-service';
import type { Component } from 'svelte';

export const registry = new PluginRegistry();
export let edgeValidator: EdgeRuleValidator;

export function initializePlugins(): void {
  registry.registerPlugin(networkingPlugin);
  registry.registerPlugin(computePlugin);
  registry.registerPlugin(storagePlugin);
  registry.finalize();
  edgeValidator = new EdgeRuleValidator(registry.getConnectionRules());
}

export function initializeTerraformCheck(): void {
  checkTerraform();
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

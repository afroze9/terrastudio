import { PluginRegistry, EdgeRuleValidator, type OutputAcceptingHandle } from '@terrastudio/core';
import networkingPlugin from '@terrastudio/plugin-azure-networking';
import computePlugin from '@terrastudio/plugin-azure-compute';
import storagePlugin from '@terrastudio/plugin-azure-storage';
import databasePlugin from '@terrastudio/plugin-azure-database';
import monitoringPlugin from '@terrastudio/plugin-azure-monitoring';
import securityPlugin from '@terrastudio/plugin-azure-security';
import DefaultResourceNode from '$lib/components/DefaultResourceNode.svelte';
import ContainerResourceNode from '$lib/components/ContainerResourceNode.svelte';
import { TerraStudioEdge } from '$lib/components/edges';
import { checkTerraform } from '$lib/services/terraform-service';
import type { Component } from 'svelte';
import type { EdgeTypes } from '@xyflow/svelte';

export let registry = new PluginRegistry();
export let edgeValidator: EdgeRuleValidator;
let initialized = false;

export function initializePlugins(): void {
  if (initialized) return;
  initialized = true;

  registry.registerPlugin(networkingPlugin);
  registry.registerPlugin(computePlugin);
  registry.registerPlugin(storagePlugin);
  registry.registerPlugin(databasePlugin);
  registry.registerPlugin(monitoringPlugin);
  registry.registerPlugin(securityPlugin);
  registry.finalize();

  // Collect handles that accept any dynamic output
  const outputAcceptingHandles: OutputAcceptingHandle[] = [];
  for (const typeId of registry.getResourceTypeIds()) {
    const schema = registry.getResourceSchema(typeId);
    for (const handle of schema?.handles ?? []) {
      if (handle.acceptsOutputs) {
        outputAcceptingHandles.push({ targetType: typeId, targetHandle: handle.id });
      }
    }
  }

  edgeValidator = new EdgeRuleValidator(registry.getConnectionRules(), outputAcceptingHandles);
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

/**
 * Builds the Svelte Flow edgeTypes map.
 * All edge types use TerraStudioEdge which handles category-based styling.
 * Type assertion needed because TerraStudioEdge uses typed props.
 */
export const edgeTypes = {
  default: TerraStudioEdge,
  smoothstep: TerraStudioEdge,
  step: TerraStudioEdge,
  straight: TerraStudioEdge,
} as EdgeTypes;

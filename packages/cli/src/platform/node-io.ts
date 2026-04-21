/**
 * CLI-specific platform utilities.
 *
 * Project file I/O is handled by NodeProjectStorage from @terrastudio/platform-node.
 * This module provides the shared storage instance and CLI-only utilities such as
 * loadRegistry / loadValidator (plugin loading — desktop uses a reactive registry instead).
 */
import { NodeProjectStorage } from '@terrastudio/platform-node';
import { PluginRegistry, EdgeRuleValidator } from '@terrastudio/core';
import type { ProviderId, ResourceTypeId, StoredProjectData } from '@terrastudio/types';
import type { ProjectValidatorContext, LoadedProject } from '@terrastudio/project';

/** Shared storage instance for all CLI commands. */
export const storage = new NodeProjectStorage();

/**
 * Convert a StoredProjectData (from IProjectStorage) to LoadedProject (for Project.fromLoaded).
 * The projectConfig field is cast — the CLI trusts that on-disk data matches the expected shape.
 */
export function toLoadedProject(stored: StoredProjectData): LoadedProject {
  return stored as unknown as LoadedProject;
}

/**
 * Register lazy plugin loaders for the given provider IDs onto a PluginRegistry.
 */
function registerPlugins(registry: PluginRegistry, providerIds: ProviderId[]): void {
  // Annotations plugin is always available (matches desktop bootstrap behavior).
  registry.registerLazyPlugin('_annotation', () => import('@terrastudio/plugin-annotations'));

  for (const providerId of providerIds) {
    if (providerId === 'azurerm') {
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-networking'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-compute'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-storage'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-database'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-monitoring'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-security'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-ai'));
    } else if (providerId === 'aws') {
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-networking'));
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-compute'));
    }
  }
}

/**
 * Load plugins for the given providers and return the fully loaded PluginRegistry.
 * Use this when you need the registry for HCL generation (connectionRules, schemas, pipeline).
 */
export async function loadRegistry(providerIds: ProviderId[]): Promise<PluginRegistry> {
  const registry = new PluginRegistry();
  registerPlugins(registry, providerIds);
  // Always load annotations alongside cloud providers (matches desktop bootstrap).
  const allProviders: ProviderId[] = providerIds.includes('_annotation' as ProviderId)
    ? providerIds
    : (['_annotation' as ProviderId, ...providerIds]);
  await registry.loadPluginsForProviders(allProviders);
  return registry;
}

/**
 * Load plugins for the given providers and return a ProjectValidatorContext.
 * Use this for mutation validation (addNode, addEdge, moveNode).
 */
export async function loadValidator(providerIds: ProviderId[]): Promise<ProjectValidatorContext> {
  const registry = await loadRegistry(providerIds);
  const rules = registry.getConnectionRules();
  const edgeValidator = new EdgeRuleValidator(rules);
  return {
    getSchema: (typeId: ResourceTypeId) => registry.getResourceSchema(typeId),
    edgeValidator,
  };
}

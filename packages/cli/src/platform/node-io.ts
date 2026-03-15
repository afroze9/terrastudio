/**
 * CLI-specific platform utilities.
 *
 * Project file I/O is handled by NodeProjectStorage from @terrastudio/platform-node.
 * This module provides the shared storage instance and CLI-only utilities such as
 * loadValidator (plugin loading — desktop uses a reactive registry instead).
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
 * Load plugins for the given providers and return a ProjectValidatorContext.
 * This enables containment and connection validation in Project mutations.
 * Call once per command invocation — plugin loading is idempotent.
 */
export async function loadValidator(providerIds: ProviderId[]): Promise<ProjectValidatorContext> {
  const registry = new PluginRegistry();

  // Register lazy loaders for known providers
  for (const providerId of providerIds) {
    if (providerId === 'azurerm') {
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-networking'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-compute'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-storage'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-database'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-monitoring'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-security'));
    } else if (providerId === 'aws') {
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-networking'));
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-compute'));
    }
  }

  await registry.loadPluginsForProviders(providerIds);

  const rules = registry.getConnectionRules();
  const edgeValidator = new EdgeRuleValidator(rules);

  return {
    getSchema: (typeId: ResourceTypeId) => registry.getResourceSchema(typeId),
    edgeValidator,
  };
}

import { PluginRegistry } from '@terrastudio/core';
import networkingPlugin from '@terrastudio/plugin-azure-networking';

export const registry = new PluginRegistry();

export function initializePlugins(): void {
  registry.registerPlugin(networkingPlugin);
  registry.finalize();
}

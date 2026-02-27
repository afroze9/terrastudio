import { invoke } from '@tauri-apps/api/core';
import { diagram } from '$lib/stores/diagram.svelte';
import { registry } from '$lib/bootstrap';
import { logger } from '$lib/logger';
import type { ResourceTypeId } from '@terrastudio/types';

let syncInitialized = false;

/**
 * Initialize diagram → Rust sync for MCP reads.
 * Watches diagram.nodes and diagram.edges, debounced to 100ms,
 * and pushes serialized snapshots to the Rust MCP state cache.
 * Also syncs available resource types from the plugin registry on init.
 */
export function initDiagramSync(): void {
  if (syncInitialized) return;
  syncInitialized = true;

  // Sync resource types from registry (one-time after plugins loaded)
  syncResourceTypes();

  // Watch diagram changes with debounced sync.
  // Uses $effect.root() because this runs outside component initialization.
  $effect.root(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
      // Access reactive state to establish dependency tracking
      const nodes = diagram.nodes;
      const edges = diagram.edges;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        syncDiagram(nodes, edges);
      }, 100);
    });
  });
}

async function syncDiagram(nodes: unknown[], edges: unknown[]): Promise<void> {
  try {
    await invoke('mcp_sync_diagram', {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
  } catch (e) {
    // Silently ignore — MCP sync is best-effort
    logger.warn(`[mcp] diagram sync failed: ${e}`);
  }
}

async function syncResourceTypes(): Promise<void> {
  try {
    const typeIds = registry.inner.getResourceTypeIds();
    const types = typeIds.map((typeId: ResourceTypeId) => {
      const schema = registry.getResourceSchema(typeId);
      if (!schema) return null;

      return {
        typeId,
        displayName: schema.displayName,
        category: schema.category,
        provider: schema.provider,
        description: schema.description ?? '',
        isContainer: schema.isContainer ?? false,
        canBeChildOf: schema.canBeChildOf ?? [],
        handles: (schema.handles ?? []).map((h) => ({
          id: h.id,
          type: h.type,
          label: h.label ?? h.id,
          position: h.position,
        })),
        properties: schema.properties
          .filter((p) => p.type !== 'reference')
          .map((p) => ({
            key: p.key,
            label: p.label,
            type: p.type,
            required: p.required ?? false,
            description: p.description,
            defaultValue: p.defaultValue,
          })),
      };
    }).filter(Boolean);

    await invoke('mcp_sync_resource_types', { types: JSON.parse(JSON.stringify(types)) });
  } catch (e) {
    logger.warn(`[mcp] resource types sync failed: ${e}`);
  }
}

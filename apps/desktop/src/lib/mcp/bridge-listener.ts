import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { diagram } from '$lib/stores/diagram.svelte';
import type { DiagramNode, DiagramEdge } from '$lib/stores/diagram.svelte';
import type { ResourceNodeData } from '@terrastudio/types';

interface McpMutationAddNode {
  op: 'add_node';
  payload: DiagramNode;
}

interface McpMutationUpdateNodeData {
  op: 'update_node_data';
  instanceId: string;
  data: Partial<ResourceNodeData>;
}

interface McpMutationRemoveNode {
  op: 'remove_node';
  instanceId: string;
}

interface McpMutationAddEdge {
  op: 'add_edge';
  payload: DiagramEdge;
}

interface McpMutationRemoveEdge {
  op: 'remove_edge';
  edgeId: string;
}

type McpMutation =
  | McpMutationAddNode
  | McpMutationUpdateNodeData
  | McpMutationRemoveNode
  | McpMutationAddEdge
  | McpMutationRemoveEdge;

const unlisteners: UnlistenFn[] = [];

/**
 * Initialize the bridge listener that receives MCP mutation events from Rust
 * and dispatches them to the diagram store's skip-history methods.
 */
export async function initBridgeListener(): Promise<void> {
  // Listen for diagram mutations from the MCP bridge
  const unlistenMutation = await listen<McpMutation>('diagram:mcp_mutated', (event) => {
    const mutation = event.payload;

    switch (mutation.op) {
      case 'add_node':
        diagram.addNodeSkipHistory(mutation.payload);
        break;
      case 'update_node_data':
        diagram.updateNodeDataSkipHistory(mutation.instanceId, mutation.data);
        break;
      case 'remove_node':
        diagram.removeNodeSkipHistory(mutation.instanceId);
        break;
      case 'add_edge':
        diagram.addEdgeSkipHistory(mutation.payload);
        break;
      case 'remove_edge':
        diagram.removeEdgeSkipHistory(mutation.edgeId);
        break;
    }
  });
  unlisteners.push(unlistenMutation);

  // Listen for project save requests from MCP
  const unlistenSave = await listen('mcp:save_project', async () => {
    try {
      const { saveDiagram } = await import('$lib/services/project-service');
      await saveDiagram();
    } catch (e) {
      console.error('[mcp] save_project failed:', e);
    }
  });
  unlisteners.push(unlistenSave);

  // Listen for HCL generation requests from MCP
  const unlistenGenerate = await listen('mcp:generate_hcl', async () => {
    try {
      const { generateAndWrite } = await import('$lib/services/terraform-service');
      const files = await generateAndWrite();
      // Sync generated HCL files back to Rust cache so MCP bridge can return them
      await invoke('mcp_sync_hcl_files', { files });
    } catch (e) {
      console.error('[mcp] generate_hcl failed:', e);
      // Sync error result so the bridge doesn't hang waiting
      await invoke('mcp_sync_hcl_files', { files: { error: String(e) } }).catch(() => {});
    }
  });
  unlisteners.push(unlistenGenerate);

  // Listen for terraform run requests from MCP
  const unlistenTerraform = await listen<{ command: string }>('mcp:run_terraform', async (event) => {
    try {
      const { runTerraformCommand } = await import('$lib/services/terraform-service');
      await runTerraformCommand(event.payload.command as 'init' | 'validate' | 'plan' | 'apply' | 'destroy');
    } catch (e) {
      console.error('[mcp] run_terraform failed:', e);
    }
  });
  unlisteners.push(unlistenTerraform);
}

/**
 * Clean up all bridge listeners.
 */
export function destroyBridgeListener(): void {
  for (const unlisten of unlisteners) {
    unlisten();
  }
  unlisteners.length = 0;
}

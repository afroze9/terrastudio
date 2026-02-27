import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import { GetDiagramSchema, ListResourcesSchema, GetAvailableResourceTypesSchema } from '../schemas.js';

export function registerQueryTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'get_diagram',
    'Get the current canvas diagram with all nodes (resources) and edges (connections)',
    GetDiagramSchema.shape,
    async () => {
      const result = await bridge.request('mcp_get_diagram_snapshot');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'list_resources',
    'List all resources currently on the canvas with their properties and positions',
    ListResourcesSchema.shape,
    async () => {
      const result = await bridge.request('mcp_get_diagram_snapshot') as any;
      // Extract resource-oriented view from nodes
      const resources = (result?.nodes ?? []).map((node: any) => ({
        instanceId: node.id,
        typeId: node.type,
        label: node.data?.label,
        terraformName: node.data?.terraformName,
        properties: node.data?.properties ?? {},
        references: node.data?.references ?? {},
        parentId: node.parentId,
        position: node.position,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(resources, null, 2) }],
      };
    }
  );

  server.tool(
    'get_available_resource_types',
    'Get all registered resource types with their schemas, handles, and properties',
    GetAvailableResourceTypesSchema.shape,
    async () => {
      const result = await bridge.request('mcp_get_resource_types');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}

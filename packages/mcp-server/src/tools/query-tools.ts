import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import { GetDiagramSchema, ListResourcesSchema, GetAvailableResourceTypesSchema, ListProjectsSchema } from '../schemas.js';

export function registerQueryTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'list_projects',
    'List all open TerraStudio projects with their names, paths, and window labels. Use this to discover available projects before targeting one with the project parameter.',
    ListProjectsSchema.shape,
    async () => {
      const result = await bridge.request('mcp_list_projects');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_diagram',
    'Get the current canvas diagram with all nodes (resources) and edges (connections)',
    GetDiagramSchema.shape,
    async (params) => {
      const result = await bridge.request('mcp_get_diagram_snapshot', params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'list_resources',
    'List all resources currently on the canvas with their properties and positions',
    ListResourcesSchema.shape,
    async (params) => {
      const result = await bridge.request('mcp_get_diagram_snapshot', params) as any;
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

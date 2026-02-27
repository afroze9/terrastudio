import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import {
  AddResourceSchema,
  UpdateResourceSchema,
  RemoveResourceSchema,
  ConnectResourcesSchema,
  DisconnectResourcesSchema,
} from '../schemas.js';

export function registerResourceTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'add_resource',
    'Add a new infrastructure resource to the canvas. Use get_available_resource_types to see valid typeIds.',
    AddResourceSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_add_resource', params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}${err.details ? '\nDetails: ' + JSON.stringify(err.details) : ''}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'update_resource',
    'Update properties of an existing resource on the canvas',
    UpdateResourceSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_update_resource', params);
        return {
          content: [{ type: 'text' as const, text: 'Resource updated successfully' }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'remove_resource',
    'Remove a resource from the canvas. If the resource is a container, all children are also removed.',
    RemoveResourceSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_remove_resource', params);
        return {
          content: [{ type: 'text' as const, text: 'Resource removed successfully' }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'connect_resources',
    'Create a connection (edge) between two resources using their handles',
    ConnectResourcesSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_connect_resources', params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'disconnect_resources',
    'Remove a connection (edge) between resources',
    DisconnectResourcesSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_disconnect_resources', params);
        return {
          content: [{ type: 'text' as const, text: 'Connection removed successfully' }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

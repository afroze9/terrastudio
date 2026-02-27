import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import {
  OpenProjectSchema,
  NewProjectSchema,
  SaveProjectSchema,
  GetProjectConfigSchema,
  SetProjectConfigSchema,
} from '../schemas.js';

export function registerProjectTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'open_project',
    'Open an existing TerraStudio project by path',
    OpenProjectSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_open_project', params);
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
    'new_project',
    'Create a new TerraStudio project',
    NewProjectSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_new_project', params);
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
    'save_project',
    'Save the current project (diagram + config) to disk',
    SaveProjectSchema.shape,
    async () => {
      try {
        await bridge.request('mcp_save_project');
        return {
          content: [{ type: 'text' as const, text: 'Project saved successfully' }],
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
    'get_project_config',
    'Get the current project configuration (sensitive fields are redacted)',
    GetProjectConfigSchema.shape,
    async () => {
      try {
        const result = await bridge.request('mcp_get_project_config');
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
    'set_project_config',
    'Update project configuration (partial merge)',
    SetProjectConfigSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_set_project_config', params);
        return {
          content: [{ type: 'text' as const, text: 'Project config updated' }],
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

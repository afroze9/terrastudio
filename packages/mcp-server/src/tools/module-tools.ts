import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import {
  CreateModuleSchema,
  DeleteModuleSchema,
  ListModulesSchema,
  RenameModuleSchema,
  AddToModuleSchema,
  RemoveFromModuleSchema,
  ToggleModuleCollapsedSchema,
} from '../schemas.js';

export function registerModuleTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'create_module',
    'Create a Terraform module from selected resources. Groups them logically for HCL generation into modules/{name}/ directory.',
    CreateModuleSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_create_module', params);
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
    'delete_module',
    'Delete a module. Resources are kept but removed from the module grouping.',
    DeleteModuleSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_delete_module', params);
        return {
          content: [{ type: 'text' as const, text: 'Module deleted successfully' }],
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
    'list_modules',
    'List all modules in the project with their member resource IDs.',
    ListModulesSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_list_modules', params);
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
    'rename_module',
    'Rename a module. Name must be lowercase alphanumeric with hyphens (valid Terraform module name).',
    RenameModuleSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_rename_module', params);
        return {
          content: [{ type: 'text' as const, text: 'Module renamed successfully' }],
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
    'add_to_module',
    'Add resources to an existing module.',
    AddToModuleSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_add_to_module', params);
        return {
          content: [{ type: 'text' as const, text: 'Resources added to module successfully' }],
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
    'remove_from_module',
    'Remove resources from their module (resources are kept, only the module assignment is cleared).',
    RemoveFromModuleSchema.shape,
    async (params) => {
      try {
        await bridge.request('mcp_remove_from_module', params);
        return {
          content: [{ type: 'text' as const, text: 'Resources removed from module successfully' }],
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
    'toggle_module_collapsed',
    'Toggle a module between collapsed (single card node) and expanded (individual resources visible) on the canvas.',
    ToggleModuleCollapsedSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_toggle_module_collapsed', params);
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
}

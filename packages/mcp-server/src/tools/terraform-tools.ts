import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import { GenerateHclSchema, GetHclFilesSchema, RunTerraformSchema, GetDeploymentStatusSchema } from '../schemas.js';

export function registerTerraformTools(server: McpServer, bridge: BridgeClient): void {
  server.tool(
    'generate_hcl',
    'Generate Terraform HCL files from the current diagram. Returns a map of filename → HCL content.',
    GenerateHclSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_generate_hcl', params) as Record<string, string>;

        // Check if result contains an error from the frontend
        if (result && typeof result === 'object' && 'error' in result) {
          return {
            content: [{ type: 'text' as const, text: `Generation failed: ${result.error}` }],
            isError: true,
          };
        }

        // Format as readable output: filename headers + HCL content
        const files = Object.entries(result);
        if (files.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No HCL files were generated (empty diagram?).' }],
          };
        }

        const output = files.map(([name, content]) =>
          `## ${name}\n\`\`\`hcl\n${content}\n\`\`\``
        ).join('\n\n');

        return {
          content: [{ type: 'text' as const, text: output }],
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
    'get_hcl_files',
    'Get the last generated HCL files without re-generating. Returns cached files from the most recent generate_hcl call.',
    GetHclFilesSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_get_hcl_files', params) as Record<string, string>;
        const files = Object.entries(result);
        if (files.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No cached HCL files. Call generate_hcl first.' }],
          };
        }

        const output = files.map(([name, content]) =>
          `## ${name}\n\`\`\`hcl\n${content}\n\`\`\``
        ).join('\n\n');

        return {
          content: [{ type: 'text' as const, text: output }],
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
    'run_terraform',
    'Run a Terraform command (init, validate, plan, apply, destroy). For apply/destroy, set confirmed: true.',
    RunTerraformSchema.shape,
    async (params) => {
      // Guard destructive commands
      const cmd = params.command;
      if ((cmd === 'apply' || cmd === 'destroy') && params.confirmed !== true) {
        return {
          content: [{
            type: 'text' as const,
            text: `CONFIRMATION_REQUIRED: "${cmd}" is a destructive operation. Set confirmed: true to proceed.`,
          }],
          isError: true,
        };
      }

      try {
        const result = await bridge.request('mcp_run_terraform', { ...params, command: cmd });
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
    'get_deployment_status',
    'Get the deployment status of each resource (pending, created, failed, etc.)',
    GetDeploymentStatusSchema.shape,
    async (params) => {
      try {
        const result = await bridge.request('mcp_get_deployment_status', params);
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

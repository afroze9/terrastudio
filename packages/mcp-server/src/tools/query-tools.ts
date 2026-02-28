import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge.js';
import { GetDiagramSchema, ListResourcesSchema, GetAvailableResourceTypesSchema, ListProjectsSchema } from '../schemas.js';

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports * (matches within a path segment) and ** (matches across segments).
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${escaped}$`);
}

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
    'Get the current canvas diagram with nodes and edges. Use detail: "summary" to reduce payload size. Set includeEdges: false to omit edges.',
    GetDiagramSchema.shape,
    async (params) => {
      const result = await bridge.request('mcp_get_diagram_snapshot', params) as any;

      let snapshot = result;

      if (params.detail === 'summary') {
        snapshot = {
          ...snapshot,
          nodes: (snapshot?.nodes ?? []).map((node: any) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            parentId: node.parentId,
            data: {
              label: node.data?.label,
              terraformName: node.data?.terraformName,
            },
          })),
        };
      }

      if (params.includeEdges === false) {
        const { edges: _edges, ...rest } = snapshot;
        snapshot = rest;
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(snapshot, null, 2) }],
      };
    }
  );

  server.tool(
    'list_resources',
    'List resources on the canvas. Supports filtering by typeId, typePattern (glob), parentId, label. Supports pagination (limit/offset) and detail levels (summary/full).',
    ListResourcesSchema.shape,
    async (params) => {
      const result = await bridge.request('mcp_get_diagram_snapshot', params) as any;
      let resources = (result?.nodes ?? []).map((node: any) => ({
        instanceId: node.id,
        typeId: node.type,
        label: node.data?.label,
        terraformName: node.data?.terraformName,
        properties: node.data?.properties ?? {},
        references: node.data?.references ?? {},
        enabledOutputs: node.data?.enabledOutputs ?? [],
        parentId: node.parentId,
        position: node.position,
      }));

      // --- Filtering ---
      if (params.typeId) {
        resources = resources.filter((r: any) => r.typeId === params.typeId);
      }
      if (params.typePattern) {
        try {
          const regex = globToRegex(params.typePattern);
          resources = resources.filter((r: any) => regex.test(r.typeId));
        } catch {
          // Invalid pattern — skip filtering
        }
      }
      if (params.parentId) {
        resources = resources.filter((r: any) => r.parentId === params.parentId);
      }
      if (params.label) {
        const needle = params.label.toLowerCase();
        resources = resources.filter((r: any) =>
          r.label?.toLowerCase().includes(needle)
        );
      }

      // --- Total count (after filtering, before pagination) ---
      const total = resources.length;

      // --- Pagination ---
      const offset = params.offset ?? 0;
      if (params.limit) {
        resources = resources.slice(offset, offset + params.limit);
      } else if (offset > 0) {
        resources = resources.slice(offset);
      }

      // --- Detail level ---
      if (params.detail === 'summary') {
        resources = resources.map((r: any) => ({
          instanceId: r.instanceId,
          typeId: r.typeId,
          label: r.label,
          terraformName: r.terraformName,
          parentId: r.parentId,
        }));
      }

      // --- Response ---
      const usedNewParams = params.typeId || params.typePattern || params.parentId ||
        params.label || params.detail || params.limit !== undefined ||
        params.offset !== undefined;

      if (!usedNewParams) {
        // Backward compat: flat array when no new params used
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(resources, null, 2) }],
        };
      }

      const response: Record<string, unknown> = { resources };
      if (params.limit !== undefined || params.offset !== undefined) {
        response.pagination = { total, offset, count: resources.length };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
      };
    }
  );

  server.tool(
    'get_available_resource_types',
    'Get registered resource types with schemas. Filter by provider/category, use detail: "summary" for compact output.',
    GetAvailableResourceTypesSchema.shape,
    async (params) => {
      const result = await bridge.request('mcp_get_resource_types') as any;
      let types = Array.isArray(result) ? result : [];

      // --- Filtering ---
      if (params.provider) {
        types = types.filter((t: any) => t.provider === params.provider);
      }
      if (params.category) {
        types = types.filter((t: any) => t.category === params.category);
      }

      // --- Detail level ---
      if (params.detail === 'summary') {
        types = types.map((t: any) => ({
          typeId: t.typeId,
          displayName: t.displayName,
          category: t.category,
          provider: t.provider,
          isContainer: t.isContainer,
          description: t.description,
        }));
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(types, null, 2) }],
      };
    }
  );
}

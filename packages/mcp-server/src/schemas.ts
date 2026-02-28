import { z } from 'zod';

// Shared optional project targeting parameter
const projectParam = z.string().optional().describe(
  'Target project by name, window label, or path. If omitted, targets the most recently active project. Use list_projects to discover open projects.'
);

// Discovery
export const ListProjectsSchema = z.object({});

// Query tools
export const GetDiagramSchema = z.object({
  project: projectParam,
  detail: z.enum(['summary', 'full']).optional().describe(
    'Detail level: "summary" strips node properties/references. "full" (default) returns everything.'
  ),
  includeEdges: z.boolean().optional().describe(
    'Whether to include edges in the response (default: true)'
  ),
});

export const ListResourcesSchema = z.object({
  project: projectParam,
  typeId: z.string().optional().describe(
    'Filter by exact resource type ID, e.g. "azurerm/networking/virtual_network"'
  ),
  typePattern: z.string().optional().describe(
    'Filter by type glob pattern, e.g. "azurerm/networking/*" or "azurerm/**"'
  ),
  parentId: z.string().optional().describe(
    'Filter to resources inside a specific container (by instance ID)'
  ),
  label: z.string().optional().describe(
    'Filter by label substring (case-insensitive)'
  ),
  detail: z.enum(['summary', 'full']).optional().describe(
    'Detail level: "summary" returns id/type/label/terraformName/parentId only. "full" (default) includes properties, references, position.'
  ),
  limit: z.number().int().min(1).max(500).optional().describe(
    'Maximum number of resources to return (default: all)'
  ),
  offset: z.number().int().min(0).optional().describe(
    'Number of resources to skip (default: 0). Use with limit for pagination.'
  ),
});

export const GetAvailableResourceTypesSchema = z.object({
  provider: z.string().optional().describe(
    'Filter by provider, e.g. "azurerm"'
  ),
  category: z.string().optional().describe(
    'Filter by category, e.g. "networking", "compute"'
  ),
  detail: z.enum(['summary', 'full']).optional().describe(
    'Detail level: "summary" returns typeId/displayName/category/provider/isContainer/description only. "full" (default) includes properties, handles, canBeChildOf.'
  ),
});

// Resource tools
export const AddResourceSchema = z.object({
  project: projectParam,
  typeId: z.string().describe('Resource type ID, e.g. "azurerm/core/resource_group"'),
  properties: z.record(z.unknown()).optional().describe('Initial property values (reference-type properties are auto-routed to references)'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional().describe('Canvas position. Auto-positioned if omitted.'),
  parentId: z.string().optional().describe('Parent container instance ID (e.g., place VM inside a Subnet)'),
  enabledOutputs: z.array(z.string()).optional().describe('Output keys to enable at creation time. Use set_enabled_outputs to change later.'),
});

export const UpdateResourceSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Instance ID of the resource to update'),
  properties: z.record(z.unknown()).describe('Properties to merge/update'),
});

export const RemoveResourceSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Instance ID of the resource to remove. Cascades to children.'),
});

export const SetEnabledOutputsSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Instance ID of the resource'),
  enabledOutputs: z.array(z.string()).describe(
    'Output keys to enable (e.g. ["primary_connection_string", "primary_key"]). Use get_available_resource_types to see available outputs per type. Set to [] to disable all.'
  ),
});

export const ConnectResourcesSchema = z.object({
  project: projectParam,
  sourceInstanceId: z.string().describe('Source node instance ID'),
  sourceHandle: z.string().describe('Source handle ID (e.g., "nsg-out")'),
  targetInstanceId: z.string().describe('Target node instance ID'),
  targetHandle: z.string().describe('Target handle ID (e.g., "nsg-in")'),
});

export const DisconnectResourcesSchema = z.object({
  project: projectParam,
  edgeId: z.string().describe('Edge ID to remove'),
});

export const MoveResourceSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Instance ID of the resource to move'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).describe('New canvas position { x, y }'),
  parentId: z.string().nullable().optional().describe(
    'Optional: set to reparent the node into a container (validated against canBeChildOf rules). Set to null to unparent.'
  ),
});

export const ResizeResourceSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Instance ID of the resource to resize'),
  width: z.number().min(1).describe('New width in pixels'),
  height: z.number().min(1).describe('New height in pixels'),
});

// Project tools
export const OpenProjectSchema = z.object({
  projectPath: z.string().describe('Absolute path to project directory (containing *.tstudio file)'),
});

export const NewProjectSchema = z.object({
  name: z.string().describe('Project name'),
  directoryPath: z.string().describe('Parent directory path where project folder will be created'),
});

export const SaveProjectSchema = z.object({ project: projectParam });

export const GetProjectConfigSchema = z.object({ project: projectParam });

export const SetProjectConfigSchema = z.object({
  project: projectParam,
  config: z.record(z.unknown()).describe('Partial config to merge'),
});

// Terraform tools
export const GenerateHclSchema = z.object({
  project: projectParam,
  file: z.string().optional().describe(
    'Return only a specific file, e.g. "main.tf". If omitted, returns all files.'
  ),
});
export const GetHclFilesSchema = z.object({
  project: projectParam,
  file: z.string().optional().describe(
    'Return only a specific file, e.g. "main.tf". If omitted, returns all files.'
  ),
});

export const RunTerraformSchema = z.object({
  project: projectParam,
  command: z.enum(['init', 'validate', 'plan', 'apply', 'destroy']).describe('Terraform command to run'),
  confirmed: z.boolean().optional().describe('Required for apply/destroy. Must be true to proceed.'),
});

export const GetDeploymentStatusSchema = z.object({ project: projectParam });

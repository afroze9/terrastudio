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
  moduleId: z.string().optional().describe(
    'Filter to resources belonging to a specific module (by module ID)'
  ),
  detail: z.enum(['summary', 'full']).optional().describe(
    'Detail level: "summary" returns id/type/label/terraformName/parentId/moduleId only. "full" (default) includes properties, references, position.'
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

// Module tools
export const CreateModuleSchema = z.object({
  project: projectParam,
  name: z.string().describe('Module name (lowercase, alphanumeric + hyphens, valid Terraform module name)'),
  nodeIds: z.array(z.string()).min(1).describe('Instance IDs of resources to include in the module'),
});

export const DeleteModuleSchema = z.object({
  project: projectParam,
  moduleId: z.string().describe('Module ID to delete. Resources are kept but removed from the module.'),
});

export const ListModulesSchema = z.object({
  project: projectParam,
});

export const RenameModuleSchema = z.object({
  project: projectParam,
  moduleId: z.string().describe('Module ID to rename'),
  name: z.string().describe('New module name'),
});

export const AddToModuleSchema = z.object({
  project: projectParam,
  moduleId: z.string().describe('Module ID to add resources to'),
  nodeIds: z.array(z.string()).min(1).describe('Instance IDs of resources to add'),
});

export const RemoveFromModuleSchema = z.object({
  project: projectParam,
  nodeIds: z.array(z.string()).min(1).describe('Instance IDs of resources to remove from their module'),
});

export const ToggleModuleCollapsedSchema = z.object({
  project: projectParam,
  moduleId: z.string().describe('Module ID to toggle collapsed/expanded'),
});

// Module template / instance tools
export const ConvertToTemplateSchema = z.object({
  project: projectParam,
  moduleId: z.string().describe('Module ID to convert into a reusable template'),
});

export const CreateModuleInstanceSchema = z.object({
  project: projectParam,
  templateId: z.string().describe('Template module ID to instantiate'),
  name: z.string().describe('Instance name (lowercase alphanumeric + underscores, valid Terraform module block name)'),
});

export const DeleteModuleInstanceSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Module instance ID to delete'),
});

export const UpdateInstanceVariableSchema = z.object({
  project: projectParam,
  instanceId: z.string().describe('Module instance ID'),
  varName: z.string().describe('Variable name to set'),
  value: z.unknown().describe('Value for the variable (string, number, boolean, or null to clear)'),
});

export const ListInstancesSchema = z.object({
  project: projectParam,
  templateId: z.string().optional().describe('Filter instances by template module ID. If omitted, returns all instances.'),
});

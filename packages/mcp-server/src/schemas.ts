import { z } from 'zod';

// Shared optional project targeting parameter
const projectParam = z.string().optional().describe(
  'Target project by name, window label, or path. If omitted, targets the most recently active project. Use list_projects to discover open projects.'
);

// Discovery
export const ListProjectsSchema = z.object({});

// Query tools
export const GetDiagramSchema = z.object({ project: projectParam });
export const ListResourcesSchema = z.object({ project: projectParam });
export const GetAvailableResourceTypesSchema = z.object({});

// Resource tools
export const AddResourceSchema = z.object({
  project: projectParam,
  typeId: z.string().describe('Resource type ID, e.g. "azurerm/core/resource_group"'),
  properties: z.record(z.unknown()).optional().describe('Initial property values'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional().describe('Canvas position. Auto-positioned if omitted.'),
  parentId: z.string().optional().describe('Parent container instance ID (e.g., place VM inside a Subnet)'),
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
export const GenerateHclSchema = z.object({ project: projectParam });
export const GetHclFilesSchema = z.object({ project: projectParam });

export const RunTerraformSchema = z.object({
  project: projectParam,
  command: z.enum(['init', 'validate', 'plan', 'apply', 'destroy']).describe('Terraform command to run'),
  confirmed: z.boolean().optional().describe('Required for apply/destroy. Must be true to proceed.'),
});

export const GetDeploymentStatusSchema = z.object({ project: projectParam });

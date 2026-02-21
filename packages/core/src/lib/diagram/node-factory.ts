import type {
  ResourceSchema,
  ResourceNodeData,
  ResourceTypeId,
} from '@terrastudio/types';

let nodeCounter = 0;

/**
 * Creates a new ResourceNodeData from a schema with default property values.
 */
export function createNodeData(
  schema: ResourceSchema,
  overrides?: Partial<ResourceNodeData>,
): ResourceNodeData {
  nodeCounter++;

  const properties: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    if (prop.defaultValue !== undefined) {
      properties[prop.key] = prop.defaultValue;
    }
  }

  const terraformName = overrides?.terraformName ?? generateTerraformName(schema, nodeCounter);

  return {
    typeId: schema.typeId,
    properties,
    references: {},
    terraformName,
    label: overrides?.label ?? schema.displayName,
    validationErrors: [],
    enabledOutputs: [],
    ...overrides,
  };
}

/**
 * Generates a unique-ish Terraform resource name from the schema.
 * e.g., "virtual_network" schema -> "vnet_1"
 */
function generateTerraformName(
  schema: ResourceSchema,
  counter: number,
): string {
  // Extract last segment of typeId: "azurerm/networking/virtual_network" -> "virtual_network"
  const parts = schema.typeId.split('/');
  const resourcePart = parts[parts.length - 1] ?? 'resource';

  // Abbreviate common patterns
  const abbreviations: Record<string, string> = {
    virtual_network: 'vnet',
    subnet: 'subnet',
    network_security_group: 'nsg',
    virtual_machine: 'vm',
    resource_group: 'rg',
    storage_account: 'storage',
  };

  const abbr = abbreviations[resourcePart] ?? resourcePart;
  return `${abbr}_${counter}`;
}

/**
 * Generates a unique Svelte Flow node ID.
 */
export function generateNodeId(typeId: ResourceTypeId): string {
  return `${typeId.replace(/\//g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Given a base terraform name and a set of existing names, returns a unique name.
 * e.g., "vm_1" with existing {"vm_1", "vm_1_2"} → "vm_1_3"
 */
export function generateUniqueTerraformName(
  baseName: string,
  existingNames: Set<string>,
): string {
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName}_${counter}`)) counter++;
  return `${baseName}_${counter}`;
}

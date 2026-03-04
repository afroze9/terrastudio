import type {
  ResourceSchema,
  ResourceInstance,
  HclGenerationContext,
  TerraformVariable,
  TerraformOutput,
  ResourceTypeRegistration,
} from '@terrastudio/types';

export interface MockHclContext extends HclGenerationContext {
  readonly variables: TerraformVariable[];
  readonly outputs: TerraformOutput[];
}

/**
 * Build a valid ResourceInstance from a schema's defaults.
 * Auto-populates properties from defaultValue, sets standard mock IDs,
 * and adds _resource_group reference if requiresResourceGroup.
 */
export function createMockResourceInstance(
  schema: ResourceSchema,
  overrides?: Partial<ResourceInstance>,
): ResourceInstance {
  const properties: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    if (prop.defaultValue !== undefined) {
      properties[prop.key] = prop.defaultValue;
    } else if (prop.type === 'string' || prop.type === 'cidr') {
      properties[prop.key] = 'mock-value';
    } else if (prop.type === 'number') {
      properties[prop.key] = 1;
    } else if (prop.type === 'boolean') {
      properties[prop.key] = false;
    } else if (prop.type === 'select' && prop.options && prop.options.length > 0) {
      properties[prop.key] = prop.options[0]!.value;
    } else if (prop.type === 'array') {
      properties[prop.key] = [];
    }
  }

  const references: Record<string, string> = {};
  if (schema.requiresResourceGroup) {
    references['_resource_group'] = 'mock-rg-instance';
  }

  return {
    instanceId: `mock-${schema.typeId.replace(/\//g, '-')}`,
    typeId: schema.typeId,
    properties,
    references,
    terraformName: 'mock_resource',
    ...overrides,
  };
}

/**
 * Build a mock ResourceInstance from a ResourceTypeRegistration.
 * Convenience wrapper around createMockResourceInstance.
 */
export function createMockFromRegistration(
  registration: ResourceTypeRegistration,
  overrides?: Partial<ResourceInstance>,
): ResourceInstance {
  return createMockResourceInstance(registration.schema, overrides);
}

/**
 * Create a mock HclGenerationContext with all 8 methods stubbed.
 * The returned object exposes `variables` and `outputs` arrays
 * so tests can assert what was registered during generation.
 */
export function createMockHclContext(options?: {
  resources?: Map<string, ResourceInstance>;
}): MockHclContext {
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];
  const resources = options?.resources ?? new Map<string, ResourceInstance>();

  return {
    variables,
    outputs,

    getResource(instanceId: string) {
      return resources.get(instanceId);
    },

    getTerraformAddress(_instanceId: string) {
      return 'mock_type.mock_name';
    },

    getAttributeReference(_instanceId: string, attribute: string) {
      return `mock_type.mock_name.${attribute}`;
    },

    addVariable(variable: TerraformVariable) {
      variables.push(variable);
    },

    addOutput(output: TerraformOutput) {
      outputs.push(output);
    },

    getProviderConfig(_providerId: string) {
      return {};
    },

    getResourceGroupExpression(_resource: ResourceInstance) {
      return 'azurerm_resource_group.mock_rg.name';
    },

    getLocationExpression(_resource: ResourceInstance) {
      return 'azurerm_resource_group.mock_rg.location';
    },

    getPropertyExpression(
      _resource: ResourceInstance,
      _propertyKey: string,
      value: unknown,
    ) {
      if (Array.isArray(value)) {
        const items = value.map((v) => `"${String(v)}"`).join(', ');
        return `[${items}]`;
      }
      if (typeof value === 'boolean') {
        return String(value);
      }
      if (typeof value === 'number') {
        return String(value);
      }
      return `"${String(value ?? 'mock_value')}"`;
    },
  };
}

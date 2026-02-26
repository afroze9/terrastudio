import type {
  ResourceInstance,
  ValidationError,
  ResourceTypeId,
} from '@terrastudio/types';
import type { PluginRegistry } from '../registry/plugin-registry.js';
import { validateResourceProperties, validateRequiredReferences } from './resource-validator.js';

export interface DiagramValidationResult {
  valid: boolean;
  errors: DiagramError[];
}

export interface DiagramError {
  instanceId: string;
  typeId: ResourceTypeId;
  label: string;
  errors: ValidationError[];
}

/**
 * Validates an entire diagram before HCL generation.
 * Checks all resource instances against their schemas.
 */
export function validateDiagram(
  resources: ResourceInstance[],
  registry: PluginRegistry,
): DiagramValidationResult {
  const diagramErrors: DiagramError[] = [];

  for (const resource of resources) {
    const schema = registry.getResourceSchema(resource.typeId);
    if (!schema) {
      diagramErrors.push({
        instanceId: resource.instanceId,
        typeId: resource.typeId,
        label: resource.terraformName,
        errors: [
          {
            propertyKey: '_type',
            message: `Unknown resource type: ${resource.typeId}`,
            severity: 'error',
          },
        ],
      });
      continue;
    }

    const propertyErrors = validateResourceProperties(
      schema,
      resource.properties,
      resource.variableOverrides,
    );

    // Validate required reference properties have values
    const requiredRefErrors = validateRequiredReferences(schema, resource.references);

    // Validate that existing references point to valid resources
    const referenceErrors = validateReferences(resource, resources);

    const allErrors = [...propertyErrors, ...requiredRefErrors, ...referenceErrors];
    if (allErrors.length > 0) {
      diagramErrors.push({
        instanceId: resource.instanceId,
        typeId: resource.typeId,
        label: resource.terraformName,
        errors: allErrors,
      });
    }
  }

  return {
    valid: diagramErrors.length === 0,
    errors: diagramErrors,
  };
}

/**
 * Validates that all references point to existing resources.
 */
function validateReferences(
  resource: ResourceInstance,
  allResources: ResourceInstance[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const instanceIds = new Set(allResources.map((r) => r.instanceId));

  for (const [key, targetId] of Object.entries(resource.references)) {
    if (!instanceIds.has(targetId)) {
      errors.push({
        propertyKey: key,
        message: `Reference "${key}" points to non-existent resource: ${targetId}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

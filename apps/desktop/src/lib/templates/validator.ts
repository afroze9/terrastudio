import type { PluginRegistry } from '@terrastudio/core';
import type { ResourceTypeId } from '@terrastudio/types';
import type { TemplateValidationResult } from './types';

export function validateTemplate(
  data: unknown,
  registry: PluginRegistry,
): TemplateValidationResult {
  const errors: string[] = [];

  // 1. Structural checks
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Template must be an object'] };
  }

  const t = data as Record<string, unknown>;

  if (typeof t.templateVersion !== 'number') {
    errors.push('Missing or invalid templateVersion');
  }

  const meta = t.metadata as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') {
    errors.push('Missing metadata object');
  } else {
    if (!meta.id || typeof meta.id !== 'string') errors.push('Missing metadata.id');
    if (!meta.name || typeof meta.name !== 'string') errors.push('Missing metadata.name');

    // Support both categories (array) and legacy category (string)
    if (Array.isArray(meta.categories)) {
      if (meta.categories.length === 0) errors.push('metadata.categories must have at least one entry');
    } else if (typeof meta.category === 'string') {
      // Normalize legacy single category to array
      meta.categories = [meta.category];
    } else {
      errors.push('Missing metadata.categories (array) or metadata.category (string)');
    }
  }

  const diagram = t.diagram as Record<string, unknown> | undefined;
  if (!diagram || typeof diagram !== 'object') {
    errors.push('Missing diagram object');
    return { valid: false, errors };
  }

  if (!Array.isArray(diagram.nodes)) {
    errors.push('diagram.nodes must be an array');
    return { valid: false, errors };
  }

  if (!Array.isArray(diagram.edges)) {
    errors.push('diagram.edges must be an array');
    return { valid: false, errors };
  }

  const nodes = diagram.nodes as Record<string, unknown>[];
  const edges = diagram.edges as Record<string, unknown>[];
  const nodeIds = new Set<string>();

  // 2. Resource type checks
  for (const node of nodes) {
    const typeId = node.type as string;
    if (!typeId) {
      errors.push(`Node ${node.id} has no type`);
      continue;
    }
    if (!registry.hasResourceType(typeId as ResourceTypeId)) {
      errors.push(`Unknown resource type: ${typeId}`);
    }
    if (node.id && typeof node.id === 'string') {
      nodeIds.add(node.id);
    }
  }

  // 3. Containment checks
  for (const node of nodes) {
    const parentId = node.parentId as string | undefined;
    if (!parentId) continue;

    if (!nodeIds.has(parentId)) {
      errors.push(`Node ${node.id} references non-existent parent ${parentId}`);
      continue;
    }

    const childType = node.type as ResourceTypeId;
    const childSchema = registry.getResourceSchema(childType);
    if (!childSchema) continue;

    const allowedParents = childSchema.canBeChildOf;
    if (!allowedParents || allowedParents.length === 0) {
      errors.push(`Node ${node.id} (${childType}) cannot be a child of any container`);
      continue;
    }

    const parent = nodes.find((n) => n.id === parentId);
    if (parent) {
      const parentType = parent.type as ResourceTypeId;
      if (!allowedParents.includes(parentType)) {
        errors.push(
          `Node ${node.id} (${childType}) cannot be child of ${parentType}`,
        );
      }
    }
  }

  // 4. Terraform name uniqueness
  const terraformNames = new Set<string>();
  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined;
    const tfName = data?.terraformName as string | undefined;
    if (!tfName) continue;
    if (terraformNames.has(tfName)) {
      errors.push(`Duplicate terraform name: ${tfName}`);
    }
    terraformNames.add(tfName);
  }

  // 5. Edge integrity
  for (const edge of edges) {
    const source = edge.source as string;
    const target = edge.target as string;
    if (source && !nodeIds.has(source)) {
      errors.push(`Edge references non-existent source node: ${source}`);
    }
    if (target && !nodeIds.has(target)) {
      errors.push(`Edge references non-existent target node: ${target}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

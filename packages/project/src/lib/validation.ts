/**
 * Pure validation functions for diagram mutations.
 * No UI, no Tauri, no Svelte — safe to call from CLI, desktop, and web.
 */
import type { ResourceTypeId, ResourceSchema } from '@terrastudio/types';
import type { EdgeRuleValidator } from '@terrastudio/core';

export interface MutationResult {
  warnings: string[];
}

type GetSchema = (typeId: ResourceTypeId) => ResourceSchema | undefined;

/**
 * Check whether a child resource type is allowed inside a given parent type.
 * Returns a warning string if invalid, null if valid.
 *
 * Rules:
 * - If the child schema has no `canBeChildOf` list, it can live anywhere (no constraint).
 * - If it has a list, the parent type must be in that list.
 * - If parentTypeId is undefined (top-level drop), the child must have no canBeChildOf requirement.
 */
export function validateContainment(
  childTypeId: ResourceTypeId,
  parentTypeId: ResourceTypeId | undefined,
  getSchema: GetSchema,
): string | null {
  const childSchema = getSchema(childTypeId);
  if (!childSchema) return null; // Unknown type — no opinion

  const allowedParents = childSchema.canBeChildOf;

  if (!allowedParents || allowedParents.length === 0) {
    // Child has no containment requirement — always valid
    return null;
  }

  if (!parentTypeId) {
    const names = allowedParents.join(', ');
    return `"${childSchema.displayName ?? childTypeId}" must be placed inside one of: ${names}`;
  }

  if (!allowedParents.includes(parentTypeId)) {
    const parentSchema = getSchema(parentTypeId);
    const parentName = parentSchema?.displayName ?? parentTypeId;
    const names = allowedParents.join(', ');
    return `"${childSchema.displayName ?? childTypeId}" cannot be placed inside "${parentName}" — allowed parents: ${names}`;
  }

  return null;
}

/**
 * Check whether a connection between two resource types on given handles is allowed.
 * Returns a warning string if invalid, null if valid.
 *
 * If no edgeValidator is provided (plugins not loaded), always returns null.
 */
export function validateConnection(
  sourceTypeId: ResourceTypeId,
  sourceHandle: string,
  targetTypeId: ResourceTypeId,
  targetHandle: string,
  edgeValidator: EdgeRuleValidator | undefined,
): string | null {
  if (!edgeValidator) return null; // Plugins not loaded — skip validation

  const result = edgeValidator.validate(sourceTypeId, sourceHandle, targetTypeId, targetHandle);
  if (!result.valid) {
    return result.reason ?? `No connection rule allows ${sourceTypeId}[${sourceHandle}] → ${targetTypeId}[${targetHandle}]`;
  }

  return null;
}

/**
 * Check whether a node's position is within its parent's bounds.
 * Returns a warning string if out of bounds, null if valid or no parent.
 *
 * The parent must have width/height set (container nodes do).
 */
export function validateBounds(
  position: { x: number; y: number },
  parentNode: { width?: number; height?: number } | undefined,
): string | null {
  if (!parentNode) return null;

  const { width, height } = parentNode;
  if (!width || !height) return null;

  if (
    position.x < 0 ||
    position.y < 0 ||
    position.x > width ||
    position.y > height
  ) {
    return `Node position (${Math.round(position.x)}, ${Math.round(position.y)}) is outside parent bounds (${width}×${height})`;
  }

  return null;
}

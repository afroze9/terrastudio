import { resolveNamingOverrides } from '@terrastudio/core';
import type { NamingTokens } from '@terrastudio/core';
import type { ResourceSchema, ResourceTypeId, ProjectNode } from '@terrastudio/types';

/**
 * Walk up the parent chain from `node`, collecting naming token overrides
 * contributed by any ancestor whose schema declares `namingTokenSources`.
 *
 * Closer ancestors win: if both a Subscription and a Resource Group contribute
 * {env}, the Resource Group's value is used (it's closer to the resource).
 */
export function getNamingOverridesFromAncestors(
  node: ProjectNode,
  allNodes: ProjectNode[],
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
): Partial<NamingTokens> {
  const merged: Partial<NamingTokens> = {};

  let cur = node;
  while (cur.parentId) {
    const parent = allNodes.find((n) => n.id === cur.parentId);
    if (!parent) break;

    const schema = getSchema(parent.data.typeId);
    if (schema?.namingTokenSources?.length) {
      const contributed = resolveNamingOverrides(
        parent.data.properties as Record<string, unknown>,
        schema.namingTokenSources,
      );
      for (const [k, v] of Object.entries(contributed)) {
        if (!(k in merged)) (merged as Record<string, string>)[k] = v as string;
      }
    }

    cur = parent;
  }

  return merged;
}

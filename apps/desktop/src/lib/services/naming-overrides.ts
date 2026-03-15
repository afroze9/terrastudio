import { resolveNamingOverrides } from '@terrastudio/core';
import type { NamingTokens } from '@terrastudio/core';
import type { ResourceSchema, ResourceTypeId } from '@terrastudio/types';

export type NodeLike = {
  id: string;
  parentId?: string;
  data: { typeId: ResourceTypeId; properties: Record<string, unknown> };
};

/**
 * Walk up the parent chain from `node`, collecting naming token overrides
 * contributed by any ancestor whose schema declares `namingTokenSources`.
 *
 * Closer ancestors win: if both a Subscription and a Resource Group contribute
 * {env}, the Resource Group's value is used (it's closer to the resource).
 *
 * Returns a merged Partial<NamingTokens> ready to pass to buildTokens().
 */
export function getNamingOverridesFromAncestors(
  node: NodeLike,
  allNodes: NodeLike[],
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
      // Merge — only set keys not already provided by a closer ancestor
      for (const [k, v] of Object.entries(contributed)) {
        if (!(k in merged)) (merged as Record<string, string>)[k] = v as string;
      }
    }

    cur = parent;
  }

  return merged;
}

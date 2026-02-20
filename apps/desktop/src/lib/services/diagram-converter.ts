import type { ResourceInstance, ConnectionRule, ResourceSchema, ResourceTypeId } from '@terrastudio/types';
import type { DiagramNode, DiagramEdge } from '$lib/stores/diagram.svelte';

/**
 * Convert diagram nodes + edges into ResourceInstance[] for the HCL pipeline.
 *
 * Responsibilities:
 * 1. Map DiagramNode fields to ResourceInstance fields
 * 2. Derive `references` from edges + connection rules
 * 3. Add implicit parent references from schema parentReference + SvelteFlow parentId
 */
export function convertToResourceInstances(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  connectionRules: ConnectionRule[],
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
): ResourceInstance[] {
  const instances: ResourceInstance[] = [];

  for (const node of nodes) {
    const data = node.data;
    const references: Record<string, string> = { ...data.references };

    // Derive references from edges
    for (const edge of edges) {
      const rule = findMatchingRule(edge, nodes, connectionRules);
      if (!rule?.createsReference) continue;

      if (rule.createsReference.side === 'target' && edge.target === node.id) {
        references[rule.createsReference.propertyKey] = edge.source;
      } else if (rule.createsReference.side === 'source' && edge.source === node.id) {
        references[rule.createsReference.propertyKey] = edge.target;
      }
    }

    // Derive parent container references from schema parentReference + parentId
    if (node.parentId) {
      deriveParentReferences(node, nodes, references, getSchema);
    }

    instances.push({
      instanceId: node.id,
      typeId: data.typeId,
      properties: { ...data.properties },
      references,
      terraformName: data.terraformName,
    });
  }

  return instances;
}

function findMatchingRule(
  edge: DiagramEdge,
  nodes: DiagramNode[],
  rules: ConnectionRule[],
): ConnectionRule | undefined {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return undefined;

  return rules.find(
    (r) =>
      r.sourceType === sourceNode.data.typeId &&
      r.targetType === targetNode.data.typeId &&
      r.sourceHandle === edge.sourceHandle &&
      r.targetHandle === edge.targetHandle,
  );
}

/**
 * For parent-child container relationships (SvelteFlow parentId),
 * derive implicit references using the schema's parentReference field.
 * For example, a Subnet placed inside a VNet container has
 * parentReference: { propertyKey: 'virtual_network_name' }.
 */
function deriveParentReferences(
  childNode: DiagramNode,
  allNodes: DiagramNode[],
  references: Record<string, string>,
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
): void {
  const parentNode = allNodes.find((n) => n.id === childNode.parentId);
  if (!parentNode) return;

  const childSchema = getSchema(childNode.data.typeId);
  if (childSchema?.parentReference) {
    // Only set if not already explicitly set
    if (!references[childSchema.parentReference.propertyKey]) {
      references[childSchema.parentReference.propertyKey] = parentNode.id;
    }
  }
}

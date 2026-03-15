import type { ResourceInstance, ConnectionRule, ResourceSchema, ResourceTypeId, OutputBinding, ProjectNode, ProjectEdge } from '@terrastudio/types';
import type { EdgeRuleValidator, ProjectConfig } from '@terrastudio/core';
import { buildTokens, applyNamingTemplate } from '@terrastudio/core';
import { getNamingOverridesFromAncestors } from './naming-overrides.js';

/**
 * Convert diagram nodes + edges into ResourceInstance[] for the HCL pipeline.
 *
 * Responsibilities:
 * 1. Map ProjectNode fields to ResourceInstance fields
 * 2. Derive `references` from edges + connection rules
 * 3. Add implicit parent references from schema parentReference + parentId
 */
export function convertToResourceInstances(
  nodes: ProjectNode[],
  edges: ProjectEdge[],
  connectionRules: ConnectionRule[],
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
  projectConfig?: ProjectConfig,
): ResourceInstance[] {
  const instances: ResourceInstance[] = [];

  for (const node of nodes) {
    // Skip synthetic/visual-only nodes (collapsed modules, module instance cards, instance member clones)
    if (node.id.startsWith('_mod_') || node.id.startsWith('_modinst_') || node.id.startsWith('_instmem_')) continue;
    if (node.type === '_annotation_' || !node.type) continue;

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

    // If a naming convention is active and this node has a namingSlug, compute properties['name']
    const properties = { ...data.properties };
    const conv = projectConfig?.namingConvention;
    const schema = getSchema(data.typeId);
    if (conv?.enabled && schema?.cafAbbreviation && data.namingSlug !== undefined) {
      const overrides = getNamingOverridesFromAncestors(node, nodes, getSchema);
      const tokens = buildTokens(conv, schema.cafAbbreviation, data.namingSlug as string, overrides);
      const fullName = applyNamingTemplate(conv.template, tokens, schema.namingConstraints);
      if (fullName) properties['name'] = fullName;
    }

    instances.push({
      instanceId: node.id,
      typeId: data.typeId,
      properties,
      references,
      terraformName: data.terraformName,
      variableOverrides: data.variableOverrides,
      moduleId: data.moduleId as string | undefined,
    });
  }

  return instances;
}

/**
 * Extract output bindings from edges using the EdgeRuleValidator.
 * Handles both explicit connection rules and dynamic output→acceptsOutputs bindings.
 */
export function extractOutputBindings(
  edges: ProjectEdge[],
  nodes: ProjectNode[],
  edgeValidator: EdgeRuleValidator,
): OutputBinding[] {
  const bindings: OutputBinding[] = [];
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const result = edgeValidator.validate(
      sourceNode.data.typeId,
      edge.sourceHandle ?? '',
      targetNode.data.typeId,
      edge.targetHandle ?? '',
    );
    if (!result.valid || !result.rule?.outputBinding) continue;

    bindings.push({
      sourceInstanceId: edge.source,
      targetInstanceId: edge.target,
      sourceAttribute: result.rule.outputBinding.sourceAttribute,
    });
  }
  return bindings;
}

function findMatchingRule(
  edge: ProjectEdge,
  nodes: ProjectNode[],
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
 * For parent-child container relationships (parentId),
 * derive implicit references using the schema's parentReference field.
 */
function deriveParentReferences(
  childNode: ProjectNode,
  allNodes: ProjectNode[],
  references: Record<string, string>,
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
): void {
  const parentNode = allNodes.find((n) => n.id === childNode.parentId);
  if (!parentNode) return;

  const childSchema = getSchema(childNode.data.typeId);

  const isVisualParent = childSchema?.visualContainment && (
    parentNode.data.typeId === 'azurerm/networking/subnet' ||
    parentNode.data.typeId === 'azurerm/networking/virtual_network'
  );

  if (childSchema?.parentReference && !isVisualParent) {
    if (!references[childSchema.parentReference.propertyKey]) {
      references[childSchema.parentReference.propertyKey] = parentNode.id;
    }
  }

  if (childSchema?.visualContainment && parentNode.data.typeId === 'azurerm/networking/subnet') {
    if (!references['_visual_subnet']) {
      references['_visual_subnet'] = parentNode.id;
    }
  }

  if (parentNode.data.typeId === 'azurerm/core/resource_group' && childSchema?.requiresResourceGroup) {
    if (!references['_resource_group']) {
      references['_resource_group'] = parentNode.id;
    }
  }

  if (!references['_resource_group'] && childSchema?.requiresResourceGroup) {
    const rgNode = findAncestorOfType(childNode, allNodes, 'azurerm/core/resource_group');
    if (rgNode) references['_resource_group'] = rgNode.id;
  }

  if (!references['_subscription']) {
    const subNode = findAncestorOfType(childNode, allNodes, 'azurerm/core/subscription');
    if (subNode) references['_subscription'] = subNode.id;
  }
}

function findAncestorOfType(
  node: ProjectNode,
  allNodes: ProjectNode[],
  typeId: ResourceTypeId,
): ProjectNode | undefined {
  let current: ProjectNode | undefined = node;
  while (current?.parentId) {
    const parent = allNodes.find((n) => n.id === current!.parentId);
    if (!parent) break;
    if (parent.data.typeId === typeId) return parent;
    current = parent;
  }
  return undefined;
}

import type { ConnectionRule, ResourceTypeId, OutputDefinition } from '@terrastudio/types';
import type { ConnectionWizardEntry, AutoFilledProperty } from '$lib/stores/connection-wizard.svelte';
import type { DiagramNode } from '$lib/stores/diagram.svelte';
import type { ResourceSchema } from '@terrastudio/types';

interface PluginRegistryLike {
  getResourceSchema(typeId: ResourceTypeId): ResourceSchema | undefined;
}

interface DiagramLike {
  nodes: DiagramNode[];
}

export function buildEdgeWizardEntry(opts: {
  edgeId: string;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  rule: ConnectionRule | undefined;
  registry: PluginRegistryLike;
}): ConnectionWizardEntry | null {
  const { edgeId, sourceNode, targetNode, rule, registry } = opts;

  // No rule = annotation/connection-point edge — not explained by wizard
  if (!rule) return null;

  const sourceSchema = registry.getResourceSchema(sourceNode.type as ResourceTypeId);
  const targetSchema = registry.getResourceSchema(targetNode.type as ResourceTypeId);
  if (!sourceSchema || !targetSchema) return null;

  const kind = rule.outputBinding ? 'binding' : 'edge';
  const sourceLabel = sourceNode.data.displayLabel || sourceNode.data.label || sourceNode.id;
  const targetLabel = targetNode.data.displayLabel || targetNode.data.label || targetNode.id;
  const sourceTfName = sourceNode.data.terraformName || sourceNode.id;
  const targetTfName = targetNode.data.terraformName || targetNode.id;

  const autoFilledProperties: AutoFilledProperty[] = [];
  let description: string;
  let terraformSnippet: string | undefined;
  let bindingResourceType: string | undefined;

  if (kind === 'edge' && rule.createsReference) {
    const side = rule.createsReference.side;
    const propKey = rule.createsReference.propertyKey;
    const affectedName = side === 'target' ? targetSchema.displayName : sourceSchema.displayName;
    const refSource = side === 'target'
      ? `${sourceSchema.terraformType}.${sourceTfName}.id`
      : `${targetSchema.terraformType}.${targetTfName}.id`;

    autoFilledProperties.push({
      side,
      propertyKey: propKey,
      propertyLabel: formatPropertyLabel(propKey),
      value: refSource,
    });

    description = `Connecting ${sourceSchema.displayName} to ${targetSchema.displayName} sets the ${formatPropertyLabel(propKey)} argument on ${affectedName}. Terraform will reference ${refSource}.`;

    const resType = side === 'target' ? targetSchema.terraformType : sourceSchema.terraformType;
    const resName = side === 'target' ? targetTfName : sourceTfName;
    terraformSnippet = `resource "${resType}" "${resName}" {\n  ${propKey} = ${refSource}\n}`;
  } else if (kind === 'binding' && rule.outputBinding) {
    const sourceAttr = rule.outputBinding.sourceAttribute;
    const outputDef = sourceSchema.outputs?.find((o: OutputDefinition) => o.key === sourceAttr);
    const outputLabel = outputDef?.label || formatPropertyLabel(sourceAttr);

    // Infer binding resource type from target terraform type
    bindingResourceType = inferBindingResourceType(targetSchema.terraformType);

    description = `Connecting the ${outputLabel} output of ${sourceSchema.displayName} to ${targetSchema.displayName} will generate an intermediate Terraform resource that stores the value.`;
    if (bindingResourceType) {
      description = `Connecting the ${outputLabel} output of ${sourceSchema.displayName} to ${targetSchema.displayName} will generate a ${bindingResourceType} resource.`;
    }

    const valueRef = `${sourceSchema.terraformType}.${sourceTfName}.${sourceAttr}`;
    const targetRef = `${targetSchema.terraformType}.${targetTfName}.id`;
    if (bindingResourceType) {
      terraformSnippet = `resource "${bindingResourceType}" "..." {\n  key_vault_id = ${targetRef}\n  value        = ${valueRef}\n}`;
    }
  } else {
    description = `${sourceSchema.displayName} connected to ${targetSchema.displayName}.`;
  }

  return {
    id: edgeId,
    kind,
    timestamp: Date.now(),
    sourceNodeId: sourceNode.id,
    sourceLabel,
    sourceTypeId: sourceSchema.typeId,
    sourceDisplayName: sourceSchema.displayName,
    targetNodeId: targetNode.id,
    targetLabel,
    targetTypeId: targetSchema.typeId,
    targetDisplayName: targetSchema.displayName,
    connectionLabel: rule.label || `${sourceSchema.displayName} → ${targetSchema.displayName}`,
    description,
    terraformSnippet,
    autoFilledProperties,
    bindingResourceType,
  };
}

export function buildContainmentWizardEntry(opts: {
  childNode: DiagramNode;
  parentNodeId: string;
  registry: PluginRegistryLike;
  diagram: DiagramLike;
}): ConnectionWizardEntry | null {
  const { childNode, parentNodeId, registry, diagram } = opts;

  const childSchema = registry.getResourceSchema(childNode.type as ResourceTypeId);
  if (!childSchema) return null;

  // Visual-only containment has no Terraform implication
  if (childSchema.visualContainment) return null;
  // No parent reference = no property derivation
  if (!childSchema.parentReference) return null;

  const parentNode = diagram.nodes.find((n) => n.id === parentNodeId);
  if (!parentNode) return null;

  const parentSchema = registry.getResourceSchema(parentNode.type as ResourceTypeId);
  if (!parentSchema) return null;

  const propKey = childSchema.parentReference.propertyKey;
  const childLabel = childNode.data.displayLabel || childNode.data.label || childNode.id;
  const parentLabel = parentNode.data.displayLabel || parentNode.data.label || parentNode.id;
  const childTfName = childNode.data.terraformName || childNode.id;
  const parentTfName = parentNode.data.terraformName || parentNode.id;

  const description = `Placing ${childSchema.displayName} inside ${parentSchema.displayName} automatically sets ${propKey} in the generated Terraform. No manual wiring is needed.`;
  const terraformSnippet = `resource "${childSchema.terraformType}" "${childTfName}" {\n  ${propKey} = ${parentSchema.terraformType}.${parentTfName}.name\n}`;

  return {
    id: `containment-${childNode.id}-${parentNodeId}-${Date.now()}`,
    kind: 'containment',
    timestamp: Date.now(),
    sourceNodeId: childNode.id,
    sourceLabel: childLabel,
    sourceTypeId: childSchema.typeId,
    sourceDisplayName: childSchema.displayName,
    targetNodeId: parentNodeId,
    targetLabel: parentLabel,
    targetTypeId: parentSchema.typeId,
    targetDisplayName: parentSchema.displayName,
    connectionLabel: `${childSchema.displayName} in ${parentSchema.displayName}`,
    description,
    terraformSnippet,
    autoFilledProperties: [{
      side: 'source',
      propertyKey: propKey,
      propertyLabel: formatPropertyLabel(propKey),
      value: `${parentSchema.terraformType}.${parentTfName}.name`,
    }],
    parentPropertyKey: propKey,
    parentContainerLabel: parentLabel,
  };
}

function formatPropertyLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Infer the binding resource type from the target's terraform type. */
function inferBindingResourceType(targetTerraformType: string): string | undefined {
  const mapping: Record<string, string> = {
    'azurerm_key_vault': 'azurerm_key_vault_secret',
  };
  return mapping[targetTerraformType];
}

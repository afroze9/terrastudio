import type {
  ProjectNode,
  ProjectEdge,
  PropertyVariableMode,
  ModuleDefinition,
  ModuleInstance,
} from '@terrastudio/types';

// ─── Diff output types ───────────────────────────────────────────────────────

export interface DiagramDiff {
  resources: ResourceDiff[];
  connections: ConnectionDiff[];
  modules: ModuleDiff[];
  instances: InstanceDiff[];
}

export interface ResourceDiff {
  type: 'added' | 'removed' | 'modified';
  nodeId: string;
  resourceTypeId: string;
  resourceName: string;
  propertyChanges?: PropertyChange[];
  parentChanged?: { before: string | null; after: string | null };
  variableChanges?: VariableChange[];
  outputChanges?: OutputChange[];
  moduleChanged?: { before: string | undefined; after: string | undefined };
}

export interface PropertyChange {
  key: string;
  before: unknown;
  after: unknown;
}

export interface VariableChange {
  key: string;
  before: PropertyVariableMode | undefined;
  after: PropertyVariableMode | undefined;
}

export interface OutputChange {
  key: string;
  enabled: boolean; // true = newly enabled, false = disabled
}

export interface ConnectionDiff {
  type: 'added' | 'removed';
  edgeId: string;
  sourceName: string;
  targetName: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ModuleDiff {
  type: 'added' | 'removed' | 'modified';
  moduleId: string;
  moduleName: string;
  membersAdded?: string[];
  membersRemoved?: string[];
  renamed?: { before: string; after: string };
  templateChanged?: { before: boolean; after: boolean };
}

export interface InstanceDiff {
  type: 'added' | 'removed' | 'modified';
  instanceId: string;
  instanceName: string;
  templateName: string;
  variableChanges?: PropertyChange[];
}

// ─── Snapshot type (what we diff) ────────────────────────────────────────────

export interface DiffableSnapshot {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  modules?: ModuleDefinition[];
  moduleInstances?: ModuleInstance[];
}

// ─── Synthetic node prefixes to exclude ──────────────────────────────────────

const SYNTHETIC_PREFIXES = ['_mod_', '_modinst_', '_instmem_'];

function isSynthetic(nodeId: string): boolean {
  return SYNTHETIC_PREFIXES.some((p) => nodeId.startsWith(p));
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function computeDiagramDiff(
  before: DiffableSnapshot,
  after: DiffableSnapshot,
): DiagramDiff {
  return {
    resources: diffResources(before.nodes, after.nodes),
    connections: diffConnections(before.edges, after.edges, before.nodes, after.nodes),
    modules: diffModules(before.modules ?? [], after.modules ?? [], before.nodes, after.nodes),
    instances: diffInstances(before.moduleInstances ?? [], after.moduleInstances ?? []),
  };
}

// ─── Resource diffing ────────────────────────────────────────────────────────

function diffResources(beforeNodes: ProjectNode[], afterNodes: ProjectNode[]): ResourceDiff[] {
  const diffs: ResourceDiff[] = [];
  const beforeMap = new Map(beforeNodes.filter((n) => !isSynthetic(n.id)).map((n) => [n.id, n]));
  const afterMap = new Map(afterNodes.filter((n) => !isSynthetic(n.id)).map((n) => [n.id, n]));

  // Removed nodes
  for (const [id, node] of beforeMap) {
    if (!afterMap.has(id)) {
      diffs.push({
        type: 'removed',
        nodeId: id,
        resourceTypeId: node.data.typeId,
        resourceName: node.data.terraformName || node.data.label,
      });
    }
  }

  // Added nodes
  for (const [id, node] of afterMap) {
    if (!beforeMap.has(id)) {
      diffs.push({
        type: 'added',
        nodeId: id,
        resourceTypeId: node.data.typeId,
        resourceName: node.data.terraformName || node.data.label,
      });
    }
  }

  // Modified nodes
  for (const [id, afterNode] of afterMap) {
    const beforeNode = beforeMap.get(id);
    if (!beforeNode) continue;

    const propertyChanges = diffProperties(beforeNode.data.properties, afterNode.data.properties);
    const variableChanges = diffVariableOverrides(
      beforeNode.data.variableOverrides,
      afterNode.data.variableOverrides,
    );
    const outputChanges = diffEnabledOutputs(
      beforeNode.data.enabledOutputs,
      afterNode.data.enabledOutputs,
    );

    const parentChanged =
      beforeNode.parentId !== afterNode.parentId
        ? { before: beforeNode.parentId ?? null, after: afterNode.parentId ?? null }
        : undefined;

    const moduleChanged =
      beforeNode.data.moduleId !== afterNode.data.moduleId
        ? { before: beforeNode.data.moduleId, after: afterNode.data.moduleId }
        : undefined;

    // Check non-cosmetic data fields
    const terraformNameChanged = beforeNode.data.terraformName !== afterNode.data.terraformName;
    const referencesChanged = !shallowEqual(beforeNode.data.references, afterNode.data.references);

    const hasChanges =
      propertyChanges.length > 0 ||
      variableChanges.length > 0 ||
      outputChanges.length > 0 ||
      parentChanged !== undefined ||
      moduleChanged !== undefined ||
      terraformNameChanged ||
      referencesChanged;

    if (hasChanges) {
      diffs.push({
        type: 'modified',
        nodeId: id,
        resourceTypeId: afterNode.data.typeId,
        resourceName: afterNode.data.terraformName || afterNode.data.label,
        propertyChanges: propertyChanges.length > 0 ? propertyChanges : undefined,
        parentChanged,
        variableChanges: variableChanges.length > 0 ? variableChanges : undefined,
        outputChanges: outputChanges.length > 0 ? outputChanges : undefined,
        moduleChanged,
      });
    }
  }

  return diffs;
}

// ─── Property diffing ────────────────────────────────────────────────────────

function diffProperties(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): PropertyChange[] {
  const changes: PropertyChange[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeVal = before[key];
    const afterVal = after[key];
    if (!deepEqual(beforeVal, afterVal)) {
      changes.push({ key, before: beforeVal, after: afterVal });
    }
  }

  return changes;
}

function diffVariableOverrides(
  before: Record<string, PropertyVariableMode> | undefined,
  after: Record<string, PropertyVariableMode> | undefined,
): VariableChange[] {
  const changes: VariableChange[] = [];
  const b = before ?? {};
  const a = after ?? {};
  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);

  for (const key of allKeys) {
    if (b[key] !== a[key]) {
      changes.push({ key, before: b[key], after: a[key] });
    }
  }

  return changes;
}

function diffEnabledOutputs(
  before: string[] | undefined,
  after: string[] | undefined,
): OutputChange[] {
  const changes: OutputChange[] = [];
  const beforeSet = new Set(before ?? []);
  const afterSet = new Set(after ?? []);

  for (const key of afterSet) {
    if (!beforeSet.has(key)) {
      changes.push({ key, enabled: true });
    }
  }
  for (const key of beforeSet) {
    if (!afterSet.has(key)) {
      changes.push({ key, enabled: false });
    }
  }

  return changes;
}

// ─── Connection diffing ──────────────────────────────────────────────────────

function diffConnections(
  beforeEdges: ProjectEdge[],
  afterEdges: ProjectEdge[],
  beforeNodes: ProjectNode[],
  afterNodes: ProjectNode[],
): ConnectionDiff[] {
  const diffs: ConnectionDiff[] = [];
  const beforeMap = new Map(beforeEdges.map((e) => [e.id, e]));
  const afterMap = new Map(afterEdges.map((e) => [e.id, e]));
  const beforeNodeMap = new Map(beforeNodes.map((n) => [n.id, n]));
  const afterNodeMap = new Map(afterNodes.map((n) => [n.id, n]));

  const getNodeName = (id: string, nodeMap: Map<string, ProjectNode>) => {
    const node = nodeMap.get(id);
    return node?.data.terraformName || node?.data.label || id;
  };

  for (const [id, edge] of beforeMap) {
    if (!afterMap.has(id)) {
      diffs.push({
        type: 'removed',
        edgeId: id,
        sourceName: getNodeName(edge.source, beforeNodeMap),
        targetName: getNodeName(edge.target, beforeNodeMap),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
    }
  }

  for (const [id, edge] of afterMap) {
    if (!beforeMap.has(id)) {
      diffs.push({
        type: 'added',
        edgeId: id,
        sourceName: getNodeName(edge.source, afterNodeMap),
        targetName: getNodeName(edge.target, afterNodeMap),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
    }
  }

  return diffs;
}

// ─── Module diffing ──────────────────────────────────────────────────────────

function diffModules(
  beforeModules: ModuleDefinition[],
  afterModules: ModuleDefinition[],
  beforeNodes: ProjectNode[],
  afterNodes: ProjectNode[],
): ModuleDiff[] {
  const diffs: ModuleDiff[] = [];
  const beforeMap = new Map(beforeModules.map((m) => [m.id, m]));
  const afterMap = new Map(afterModules.map((m) => [m.id, m]));

  const getModuleMembers = (moduleId: string, nodes: ProjectNode[]) =>
    nodes.filter((n) => n.data.moduleId === moduleId && !isSynthetic(n.id)).map((n) => n.id);

  // Removed
  for (const [id, mod] of beforeMap) {
    if (!afterMap.has(id)) {
      diffs.push({ type: 'removed', moduleId: id, moduleName: mod.name });
    }
  }

  // Added
  for (const [id, mod] of afterMap) {
    if (!beforeMap.has(id)) {
      diffs.push({ type: 'added', moduleId: id, moduleName: mod.name });
    }
  }

  // Modified
  for (const [id, afterMod] of afterMap) {
    const beforeMod = beforeMap.get(id);
    if (!beforeMod) continue;

    const renamed =
      beforeMod.name !== afterMod.name
        ? { before: beforeMod.name, after: afterMod.name }
        : undefined;
    const templateChanged =
      (beforeMod.isTemplate ?? false) !== (afterMod.isTemplate ?? false)
        ? { before: beforeMod.isTemplate ?? false, after: afterMod.isTemplate ?? false }
        : undefined;

    const beforeMembers = new Set(getModuleMembers(id, beforeNodes));
    const afterMembers = new Set(getModuleMembers(id, afterNodes));
    const membersAdded = [...afterMembers].filter((m) => !beforeMembers.has(m));
    const membersRemoved = [...beforeMembers].filter((m) => !afterMembers.has(m));

    if (renamed || templateChanged || membersAdded.length > 0 || membersRemoved.length > 0) {
      diffs.push({
        type: 'modified',
        moduleId: id,
        moduleName: afterMod.name,
        renamed,
        templateChanged,
        membersAdded: membersAdded.length > 0 ? membersAdded : undefined,
        membersRemoved: membersRemoved.length > 0 ? membersRemoved : undefined,
      });
    }
  }

  return diffs;
}

// ─── Instance diffing ────────────────────────────────────────────────────────

function diffInstances(
  beforeInstances: ModuleInstance[],
  afterInstances: ModuleInstance[],
): InstanceDiff[] {
  const diffs: InstanceDiff[] = [];
  const beforeMap = new Map(beforeInstances.map((i) => [i.id, i]));
  const afterMap = new Map(afterInstances.map((i) => [i.id, i]));

  for (const [id, inst] of beforeMap) {
    if (!afterMap.has(id)) {
      diffs.push({
        type: 'removed',
        instanceId: id,
        instanceName: inst.name,
        templateName: inst.templateId,
      });
    }
  }

  for (const [id, inst] of afterMap) {
    if (!beforeMap.has(id)) {
      diffs.push({
        type: 'added',
        instanceId: id,
        instanceName: inst.name,
        templateName: inst.templateId,
      });
    }
  }

  for (const [id, afterInst] of afterMap) {
    const beforeInst = beforeMap.get(id);
    if (!beforeInst) continue;

    const variableChanges = diffProperties(
      beforeInst.variableValues ?? {},
      afterInst.variableValues ?? {},
    );

    if (variableChanges.length > 0 || beforeInst.name !== afterInst.name) {
      diffs.push({
        type: 'modified',
        instanceId: id,
        instanceName: afterInst.name,
        templateName: afterInst.templateId,
        variableChanges: variableChanges.length > 0 ? variableChanges : undefined,
      });
    }
  }

  return diffs;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }
  return false;
}

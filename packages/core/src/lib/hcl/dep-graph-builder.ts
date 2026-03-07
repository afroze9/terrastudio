import type {
  ResourceTypeId,
  PluginRegistryReader,
  DepGraphNode,
  DepGraphEdge,
  DepGraphCluster,
  DepGraphData,
  ResourceNodeData,
  TerraStudioEdgeData,
} from '@terrastudio/types';

interface DiagramNode {
  id: string;
  type?: string;
  data: ResourceNodeData;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  data?: TerraStudioEdgeData;
}

interface ModuleDef {
  id: string;
  name: string;
  color?: string;
}

const SYNTHETIC_PREFIXES = ['_mod_', '_modinst_', '_instmem_'];

function isSynthetic(id: string): boolean {
  return SYNTHETIC_PREFIXES.some((p) => id.startsWith(p));
}

/**
 * Build a dependency graph from diagram state.
 * Uses reference edges and canvas structural/binding edges.
 */
export function buildDependencyGraph(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  modules: ModuleDef[],
  registry: PluginRegistryReader,
): DepGraphData {
  // Filter to real resources only
  const realNodes = nodes.filter((n) => {
    if (isSynthetic(n.id)) return false;
    const typeId = n.type as ResourceTypeId | undefined;
    if (!typeId || !typeId.includes('/')) return false;
    const schema = registry.getResourceSchema(typeId);
    if (!schema) return false;
    if (schema.terraformType.startsWith('_')) return false;
    return true;
  });

  const nodeMap = new Map<string, DiagramNode>();
  for (const n of realNodes) nodeMap.set(n.id, n);

  // Build dep graph nodes
  const depNodes: DepGraphNode[] = [];
  const addressMap = new Map<string, string>(); // instanceId -> terraformAddress

  for (const n of realNodes) {
    const typeId = n.type as ResourceTypeId;
    const schema = registry.getResourceSchema(typeId)!;
    const category = typeId.split('/')[1] ?? 'unknown';
    const terraformAddress = `${schema.terraformType}.${n.data.terraformName}`;
    addressMap.set(n.id, terraformAddress);

    depNodes.push({
      instanceId: n.id,
      typeId,
      label: n.data.label,
      terraformAddress,
      displayName: schema.displayName,
      category,
      deploymentStatus: n.data.deploymentStatus,
      moduleId: n.data.moduleId,
      level: 0, // computed below
    });
  }

  // Collect edges from two sources
  const edgeSet = new Map<string, DepGraphEdge>(); // "source|target" -> edge
  const edgeKey = (s: string, t: string) => `${s}|${t}`;

  // Source 1: node.data.references (reference edges)
  for (const n of realNodes) {
    if (!n.data.references) continue;
    for (const [, targetId] of Object.entries(n.data.references)) {
      if (!targetId || !nodeMap.has(targetId)) continue;
      // n references targetId, meaning n depends on target
      const key = edgeKey(targetId, n.id);
      if (!edgeSet.has(key)) {
        edgeSet.set(key, {
          sourceInstanceId: targetId,
          targetInstanceId: n.id,
          kind: 'reference',
        });
      }
    }
  }

  // Source 2: canvas structural/binding edges
  for (const e of edges) {
    const category = e.data?.category;
    if (category !== 'structural' && category !== 'binding') continue;
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
    // Edge source -> target means target depends on source
    const key = edgeKey(e.source, e.target);
    if (!edgeSet.has(key)) {
      edgeSet.set(key, {
        sourceInstanceId: e.source,
        targetInstanceId: e.target,
        kind: 'binding',
      });
    }
  }

  const depEdges = [...edgeSet.values()];

  // Compute topological levels via BFS from roots
  const hasCycle = false;
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>(); // source -> [targets]

  for (const n of depNodes) {
    inDegree.set(n.instanceId, 0);
    adjacency.set(n.instanceId, []);
  }

  for (const e of depEdges) {
    inDegree.set(e.targetInstanceId, (inDegree.get(e.targetInstanceId) ?? 0) + 1);
    adjacency.get(e.sourceInstanceId)?.push(e.targetInstanceId);
  }

  // BFS level assignment
  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      levels.set(id, 0);
    }
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    const currentLevel = levels.get(current) ?? 0;

    for (const target of adjacency.get(current) ?? []) {
      const newLevel = currentLevel + 1;
      levels.set(target, Math.max(levels.get(target) ?? 0, newLevel));
      const remaining = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, remaining);
      if (remaining === 0) {
        queue.push(target);
      }
    }
  }

  // Check for cycles
  if (processed !== depNodes.length) {
    return {
      nodes: depNodes,
      edges: [],
      clusters: buildClusters(depNodes, modules),
      hasCycle: true,
      cycleError: 'Circular dependency detected. Check resource references.',
    };
  }

  // Apply levels to nodes
  const leveledNodes = depNodes.map((n) => ({
    ...n,
    level: levels.get(n.instanceId) ?? 0,
  }));

  return {
    nodes: leveledNodes,
    edges: depEdges,
    clusters: buildClusters(leveledNodes, modules),
    hasCycle,
  };
}

function buildClusters(
  nodes: DepGraphNode[],
  modules: ModuleDef[],
): DepGraphCluster[] {
  const moduleMap = new Map<string, ModuleDef>();
  for (const m of modules) moduleMap.set(m.id, m);

  const memberMap = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.moduleId && moduleMap.has(n.moduleId)) {
      const list = memberMap.get(n.moduleId) ?? [];
      list.push(n.instanceId);
      memberMap.set(n.moduleId, list);
    }
  }

  const clusters: DepGraphCluster[] = [];
  for (const [moduleId, members] of memberMap) {
    const mod = moduleMap.get(moduleId)!;
    clusters.push({
      moduleId,
      moduleName: mod.name,
      color: mod.color,
      memberInstanceIds: members,
    });
  }
  return clusters;
}

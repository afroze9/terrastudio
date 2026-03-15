import type {
  ProjectNode,
  ProjectEdge,
  ResourceTypeId,
  ResourceSchema,
  ModuleDefinition,
  ModuleInstance,
  EdgeCategoryId,
  ProviderId,
} from '@terrastudio/types';
import type { ProjectConfig } from '@terrastudio/core';
import { convertToResourceInstances, extractOutputBindings } from './diagram-converter.js';
import type { ConnectionRule } from '@terrastudio/types';
import type { EdgeRuleValidator, HclPipeline, PipelineResult } from '@terrastudio/core';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface DiagramSnapshot {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  modules?: ModuleDefinition[];
  moduleInstances?: ModuleInstance[];
}

export interface ProjectMetadata {
  name: string;
  version: string;
  projectConfig: ProjectConfig;
}

export interface LoadedProject {
  path: string;
  metadata: ProjectMetadata;
  diagram: DiagramSnapshot | null;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Migrate edges from old format (no data.category) to new format.
 * Infers category from edge properties:
 *   - animated: true  → binding
 *   - id starts with 'ref-' → reference
 *   - otherwise → structural
 */
export function migrateEdges(edges: unknown[]): ProjectEdge[] {
  return edges.map((edge: any) => {
    if (edge.data?.category) return edge as ProjectEdge;

    let category: EdgeCategoryId = 'structural';
    if (edge.animated) {
      category = 'binding';
    } else if (edge.id?.startsWith('ref-')) {
      category = 'reference';
    }

    const { animated: _a, style: _s, label, ...rest } = edge;
    return {
      ...rest,
      data: {
        category,
        label: label ?? undefined,
      },
    } as ProjectEdge;
  });
}

/**
 * Resolve which provider IDs to load for a given project config.
 * If activeProviders is set, use it. Otherwise infer from diagram node types.
 * Falls back to ['azurerm'].
 */
export function resolveActiveProviders(
  config: ProjectConfig,
  diagramNodes?: unknown[],
): ProviderId[] {
  if (config.activeProviders?.length) {
    return config.activeProviders as ProviderId[];
  }

  if (diagramNodes?.length) {
    const providers = new Set<string>();
    for (const node of diagramNodes) {
      const type = (node as any)?.type as string | undefined;
      if (type && type.includes('/') && !type.startsWith('_')) {
        providers.add(type.split('/')[0]!);
      }
    }
    if (providers.size > 0) return [...providers] as ProviderId[];
  }

  return ['azurerm' as ProviderId];
}

// ─── Project class ─────────────────────────────────────────────────────────────

/**
 * In-memory representation of an open TerraStudio project.
 *
 * This class is platform-agnostic — it has no knowledge of how files are read
 * or written. Pass a loaded snapshot in via `Project.fromSnapshot()` and call
 * `toSnapshot()` to get a serializable form for writing back to disk.
 *
 * HCL generation requires an `HclPipeline` and `EdgeRuleValidator` instance
 * (constructed by the caller after loading the appropriate plugins).
 */
export class Project {
  readonly path: string;
  readonly name: string;
  readonly version: string;
  projectConfig: ProjectConfig;

  nodes: ProjectNode[];
  edges: ProjectEdge[];
  modules: ModuleDefinition[];
  moduleInstances: ModuleInstance[];

  constructor(
    path: string,
    metadata: ProjectMetadata,
    diagram: DiagramSnapshot | null,
  ) {
    this.path = path;
    this.name = metadata.name;
    this.version = metadata.version;
    this.projectConfig = metadata.projectConfig;

    if (diagram) {
      this.nodes = diagram.nodes;
      this.edges = migrateEdges(diagram.edges as unknown[]);
      this.modules = diagram.modules ?? [];
      this.moduleInstances = diagram.moduleInstances ?? [];
    } else {
      this.nodes = [];
      this.edges = [];
      this.modules = [];
      this.moduleInstances = [];
    }
  }

  static fromLoaded(loaded: LoadedProject): Project {
    return new Project(loaded.path, loaded.metadata, loaded.diagram);
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  /**
   * Produce a diagram snapshot for persistence.
   * Filters out transient cloned nodes (_instmem_) that are rebuilt on expand.
   */
  toDiagramSnapshot(): DiagramSnapshot {
    return {
      nodes: this.nodes.filter((n) => !n.id.startsWith('_instmem_')),
      edges: this.edges.filter((e) => !e.id.startsWith('_instmem_')),
      modules: this.modules,
      moduleInstances: this.moduleInstances,
    };
  }

  toMetadata(): ProjectMetadata {
    return {
      name: this.name,
      version: this.version,
      projectConfig: this.projectConfig,
    };
  }

  // ─── HCL generation ──────────────────────────────────────────────────────────

  /**
   * Generate Terraform HCL files from the current diagram state.
   *
   * @param pipeline - HclPipeline instance (from @terrastudio/core)
   * @param edgeValidator - EdgeRuleValidator instance (from @terrastudio/core)
   * @param connectionRules - All connection rules from loaded plugins
   * @param getSchema - Schema resolver from the plugin registry
   */
  generateHcl(
    pipeline: HclPipeline,
    edgeValidator: EdgeRuleValidator,
    connectionRules: ConnectionRule[],
    getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
  ): PipelineResult {
    const resources = convertToResourceInstances(
      this.nodes,
      this.edges,
      connectionRules,
      getSchema,
      this.projectConfig,
    );

    const bindings = extractOutputBindings(this.edges, this.nodes, edgeValidator);

    return pipeline.generate({
      resources,
      bindings,
      projectConfig: this.projectConfig,
      modules: this.modules,
      moduleInstances: this.moduleInstances,
    });
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getNode(id: string): ProjectNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  getNodesOfType(typeId: ResourceTypeId): ProjectNode[] {
    return this.nodes.filter((n) => n.data.typeId === typeId);
  }

  getChildren(parentId: string): ProjectNode[] {
    return this.nodes.filter((n) => n.parentId === parentId);
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────

  addNode(node: ProjectNode): void {
    this.nodes = [...this.nodes, node];
  }

  updateNode(id: string, patch: Partial<ProjectNode> & { data?: Partial<ProjectNode['data']> }): void {
    this.nodes = this.nodes.map((n) => {
      if (n.id !== id) return n;
      const { data, ...rest } = patch;
      return {
        ...n,
        ...rest,
        data: data ? { ...n.data, ...data } : n.data,
      };
    });
  }

  removeNode(id: string): void {
    // Remove node and all descendants
    const toRemove = new Set<string>();
    const collect = (nodeId: string) => {
      toRemove.add(nodeId);
      for (const child of this.getChildren(nodeId)) collect(child.id);
    };
    collect(id);

    this.nodes = this.nodes.filter((n) => !toRemove.has(n.id));
    this.edges = this.edges.filter(
      (e) => !toRemove.has(e.source) && !toRemove.has(e.target),
    );
  }

  addEdge(edge: ProjectEdge): void {
    this.edges = [...this.edges, edge];
  }

  removeEdge(id: string): void {
    this.edges = this.edges.filter((e) => e.id !== id);
  }

  moveNode(id: string, position: { x: number; y: number }, parentId?: string | null): void {
    this.nodes = this.nodes.map((n) => {
      if (n.id !== id) return n;
      const update: Partial<ProjectNode> = { position };
      if (parentId !== undefined) update.parentId = parentId ?? undefined;
      return { ...n, ...update };
    });
  }

  resizeNode(id: string, width: number, height: number): void {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, width, height } : n,
    );
  }
}

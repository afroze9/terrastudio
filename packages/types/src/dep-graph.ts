import type { ResourceTypeId } from './resource-schema.js';

/** A node in the dependency graph view. */
export interface DepGraphNode {
  readonly instanceId: string;
  readonly typeId: ResourceTypeId;
  readonly label: string;
  readonly terraformAddress: string;
  readonly displayName: string;
  readonly category: string;
  readonly deploymentStatus?: string;
  readonly moduleId?: string;
  readonly level: number;
}

/** A directed dependency edge: source must be deployed before target. */
export interface DepGraphEdge {
  readonly sourceInstanceId: string;
  readonly targetInstanceId: string;
  readonly kind: 'explicit' | 'reference' | 'binding';
}

/** Module boundary cluster for visual grouping. */
export interface DepGraphCluster {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly color?: string;
  readonly memberInstanceIds: string[];
}

/** Complete dependency graph data ready for rendering. */
export interface DepGraphData {
  readonly nodes: DepGraphNode[];
  readonly edges: DepGraphEdge[];
  readonly clusters: DepGraphCluster[];
  readonly hasCycle: boolean;
  readonly cycleError?: string;
}

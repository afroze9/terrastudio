// Wire format types for IPC bridge between Node.js sidecar and Rust backend

export interface BridgeRequest {
  id: string;
  command: string;
  params: unknown;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: BridgeError;
}

export interface BridgePush {
  event: string;
  data: unknown;
}

export interface BridgeError {
  code: string;
  message: string;
  details?: unknown;
}

// Resource data types

export interface ResourceEntry {
  instanceId: string;
  typeId: string;
  label: string;
  terraformName: string;
  properties: Record<string, unknown>;
  references: Record<string, string>;
  parentId?: string;
  deploymentStatus: 'pending' | 'creating' | 'updating' | 'created' | 'failed' | 'destroyed';
  position: { x: number; y: number };
}

export interface ResourceTypeInfo {
  typeId: string;
  displayName: string;
  category: string;
  provider: string;
  description: string;
  isContainer: boolean;
  canBeChildOf: string[];
  handles: HandleInfo[];
  properties: PropertyInfo[];
}

export interface HandleInfo {
  id: string;
  type: 'source' | 'target';
  label: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface PropertyInfo {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface RunTerraformOutput {
  exitCode: number;
  success: boolean;
  diagnostics: TerraformDiagnostic[];
  resourceChanges: ResourceChange[];
}

export interface TerraformDiagnostic {
  severity: string;
  summary: string;
  detail: string;
}

export interface ResourceChange {
  address: string;
  action: string;
  success: boolean;
  error?: string;
}

export interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  parentId?: string;
  width?: number;
  height?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, unknown>;
}

// MCP mutation types (from Rust to frontend)

export type McpMutation =
  | { op: 'add_node'; payload: DiagramNode }
  | { op: 'update_node_data'; instanceId: string; data: Record<string, unknown> }
  | { op: 'remove_node'; instanceId: string }
  | { op: 'add_edge'; payload: DiagramEdge }
  | { op: 'remove_edge'; edgeId: string };

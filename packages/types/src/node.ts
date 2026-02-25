import type { ResourceTypeId } from './resource-schema.js';
import type { ResourceSchema } from './resource-schema.js';
import type { ValidationError } from './validation.js';

export type DeploymentStatus =
  | 'pending'
  | 'creating'
  | 'updating'
  | 'created'
  | 'failed'
  | 'destroyed';

/** How a property value should be treated in HCL generation */
export type PropertyVariableMode = 'literal' | 'variable';

/** Position for connection points */
export type ConnectionPointPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * User-defined connection points for annotation edges.
 * Each side can have 0+ connection points for creating annotation edges.
 */
export interface ConnectionPointConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * User overrides for handle positions.
 * Keys are handle IDs (e.g., 'secret-in', 'out-connection_string').
 * Values are the new position ('top' | 'bottom' | 'left' | 'right').
 */
export type HandlePositionOverrides = Record<string, ConnectionPointPosition>;

export interface ResourceNodeData {
  [key: string]: unknown;
  typeId: ResourceTypeId;
  properties: Record<string, unknown>;
  references: Record<string, string>;
  terraformName: string;
  label: string;
  validationErrors: ValidationError[];
  deploymentStatus?: DeploymentStatus;
  /** Per-property override for literal vs variable mode */
  variableOverrides?: Record<string, PropertyVariableMode>;
  /** User-defined connection points for annotation edges */
  connectionPoints?: ConnectionPointConfig;
  /** User overrides for schema/output handle positions */
  handlePositions?: HandlePositionOverrides;
  /** Which outputs are enabled (creates dynamic out-* handles) */
  enabledOutputs?: string[];
}

/**
 * Svelte component type for resource nodes on the canvas.
 * Receives Svelte Flow NodeProps with ResourceNodeData.
 *
 * Defined as a generic component signature to avoid depending on
 * @xyflow/svelte or svelte at the types package level.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResourceNodeComponent = any;

export interface PropertyEditorProps {
  schema: ResourceSchema;
  properties: Record<string, unknown>;
  references: Record<string, string>;
  onPropertyChange: (key: string, value: unknown) => void;
  onReferenceChange: (key: string, targetInstanceId: string | null) => void;
  availableResources: Array<{
    instanceId: string;
    typeId: ResourceTypeId;
    label: string;
  }>;
}

/**
 * Optional custom sidebar component for editing resource properties.
 * If not provided, the core renders a generic schema-driven editor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PropertyEditorComponent = any;

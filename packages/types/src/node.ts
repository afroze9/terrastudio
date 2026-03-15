import type { ResourceTypeId } from './resource-schema.js';
import type { ResourceSchema } from './resource-schema.js';
import type { ValidationError } from './validation.js';
import type { ReferenceEdgeOverrides } from './edge.js';

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
  /** User-set display name shown on the canvas. Overrides label for canvas rendering only; does not affect terraform naming. */
  displayLabel?: string;
  /** The user-supplied slug used by naming conventions to compute the full resource name.
   *  Only meaningful when a naming convention is active and the resource has a cafAbbreviation.
   *  The full name (properties['name']) is derived from this at HCL generation time and for preview — never stored. */
  namingSlug?: string;
  validationErrors: ValidationError[];
  deploymentStatus?: DeploymentStatus;
  /** Per-property override for literal vs variable mode */
  variableOverrides?: Record<string, PropertyVariableMode>;
  /** User-defined connection points for annotation edges */
  connectionPoints?: ConnectionPointConfig;
  /** User overrides for schema/output handle positions */
  handlePositions?: HandlePositionOverrides;
  /** Handle IDs explicitly made visible via the arrow menu */
  visibleHandles?: string[];
  /** Which outputs are enabled (creates dynamic out-* handles) */
  enabledOutputs?: string[];
  /** User customizations (label, style) for reference edges originating from this node */
  referenceEdgeOverrides?: ReferenceEdgeOverrides;
  /** Module this resource belongs to (logical grouping, independent of parentId) */
  moduleId?: string;
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

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

export interface ResourceNodeData {
  [key: string]: unknown;
  typeId: ResourceTypeId;
  properties: Record<string, unknown>;
  references: Record<string, string>;
  terraformName: string;
  label: string;
  validationErrors: ValidationError[];
  deploymentStatus?: DeploymentStatus;
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

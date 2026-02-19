import type { PropertyValidation } from './validation.js';

/** Fully qualified resource type identifier: {provider}/{category}/{resource} */
export type ResourceTypeId = `${string}/${string}/${string}`;

export type PropertyFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'cidr'
  | 'tags'
  | 'key-value-map'
  | 'array'
  | 'object'
  | 'reference';

export interface PropertySchema {
  readonly key: string;
  readonly label: string;
  readonly type: PropertyFieldType;
  readonly description?: string;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly placeholder?: string;

  /** For 'select' / 'multiselect' */
  readonly options?: ReadonlyArray<{ label: string; value: string }>;

  /** For 'reference': which resource types can be referenced */
  readonly referenceTargetTypes?: ReadonlyArray<ResourceTypeId>;

  /** For 'array': schema of each item */
  readonly itemSchema?: PropertySchema;

  /** For 'object': nested field schemas */
  readonly nestedSchema?: ReadonlyArray<PropertySchema>;

  readonly validation?: PropertyValidation;

  /** Collapsible group heading */
  readonly group?: string;
  /** Sort order within group */
  readonly order?: number;

  /** Conditional visibility */
  readonly visibleWhen?: {
    field: string;
    operator: 'eq' | 'neq' | 'in' | 'notIn' | 'truthy' | 'falsy';
    value?: unknown;
  };
}

export interface HandleDefinition {
  readonly id: string;
  readonly type: 'source' | 'target';
  readonly position: 'top' | 'bottom' | 'left' | 'right';
  readonly acceptsTypes?: ReadonlyArray<ResourceTypeId>;
  readonly label: string;
  readonly maxConnections?: number;
}

export interface ResourceSchema {
  readonly typeId: ResourceTypeId;
  readonly provider: string;
  readonly displayName: string;
  readonly category: string;
  readonly description: string;
  readonly terraformType: string;
  readonly properties: ReadonlyArray<PropertySchema>;
  readonly handles: ReadonlyArray<HandleDefinition>;
  readonly supportsTags: boolean;
  readonly requiresResourceGroup: boolean;
  /** If true, this resource renders as a container that can hold child nodes */
  readonly isContainer?: boolean;
  /** Which resource typeIds can be children of this container */
  readonly acceptsChildren?: ReadonlyArray<ResourceTypeId>;
}

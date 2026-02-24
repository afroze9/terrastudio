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

  /** If true, render as a password input and mark as sensitive in generated variables */
  readonly sensitive?: boolean;

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

  /**
   * If true, automatically render a dashed visual edge on the canvas when this
   * reference property is set — useful for "logical" connections like VNet
   * Integration → App Service or Private Endpoint → target resource.
   */
  readonly showAsEdge?: boolean;
}

export interface HandleDefinition {
  readonly id: string;
  readonly type: 'source' | 'target';
  readonly position: 'top' | 'bottom' | 'left' | 'right';
  readonly acceptsTypes?: ReadonlyArray<ResourceTypeId>;
  /** Accept connections from any dynamic output handle (out-*) */
  readonly acceptsOutputs?: boolean;
  readonly label: string;
  readonly maxConnections?: number;
}

export interface ContainerStyle {
  /** CSS border color, e.g. '#14b8a6' */
  readonly borderColor?: string;
  /** CSS border style */
  readonly borderStyle?: 'solid' | 'dashed' | 'dotted';
  /** CSS background color (use rgba for semi-transparency) */
  readonly backgroundColor?: string;
  /** Color for the container header bar text/icon */
  readonly headerColor?: string;
  /** Border radius in pixels */
  readonly borderRadius?: number;
  /** Border width in pixels */
  readonly borderWidth?: number;
  /** Whether to hide the header bottom border */
  readonly hideHeaderBorder?: boolean;
  /** Icon size in pixels (default 18) */
  readonly iconSize?: number;
  /** Label font size in pixels (default 12) */
  readonly labelSize?: number;
  /** SVG stroke-dasharray for dashed borders (e.g. '20,10'). Overrides borderStyle with an SVG border. */
  readonly dashArray?: string;
}

export interface OutputDefinition {
  readonly key: string;
  readonly label: string;
  readonly terraformAttribute: string;
  readonly sensitive?: boolean;
}

export interface NamingConstraints {
  /** Force the generated name to lowercase */
  readonly lowercase?: boolean;
  /** Strip all hyphens from the generated name (storage accounts, container registries) */
  readonly noHyphens?: boolean;
  /** Maximum character length for the generated name */
  readonly maxLength?: number;
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
  /** CAF abbreviation used as the {type} token in naming templates (e.g. 'vm', 'asp', 'st') */
  readonly cafAbbreviation?: string;
  /** Resource-specific constraints applied after naming template rendering */
  readonly namingConstraints?: NamingConstraints;
  /** If true, this resource renders as a container that can hold child nodes */
  readonly isContainer?: boolean;
  /** Which container typeIds this resource can be placed inside */
  readonly canBeChildOf?: ReadonlyArray<ResourceTypeId>;
  /** Visual style for container nodes; read by ContainerResourceNode */
  readonly containerStyle?: ContainerStyle;
  /** When nested inside a parent container, auto-set this reference for HCL generation */
  readonly parentReference?: {
    readonly propertyKey: string;
  };
  /** Computed outputs this resource exposes for output binding connections */
  readonly outputs?: ReadonlyArray<OutputDefinition>;
}

import type { ResourceTypeId } from './resource-schema.js';

/**
 * Edge category identifiers.
 * - structural: Terraform dependencies (NSG→Subnet, App Service→Plan)
 * - binding: Data flow (Resource output → Key Vault secret)
 * - reference: Visual property refs (showAsEdge: true properties)
 * - annotation: User documentation/notes
 */
export type EdgeCategoryId = 'structural' | 'binding' | 'reference' | 'annotation';

/**
 * Edge marker types for arrow heads and endpoints.
 */
export type EdgeMarkerType = 'none' | 'arrow' | 'arrowClosed' | 'dot';

/**
 * Line style types for user-friendly edge configuration.
 * 'animated' is a special style that shows moving dashes (for data flow visualization).
 */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'animated';

/**
 * Style definition for an edge category or custom edge styling.
 */
export interface EdgeStyleDefinition {
  /** Stroke color (CSS color string or CSS variable) */
  readonly strokeColor: string;
  /** Stroke width in pixels */
  readonly strokeWidth: number;
  /** Dash pattern (e.g., '5 4' for dashed, undefined for solid) */
  readonly dashArray?: string;
  /** Whether the edge animates (for data flow visualization) */
  readonly animated?: boolean;
  /** Arrow marker at source end */
  readonly markerStart?: EdgeMarkerType;
  /** Arrow marker at target end */
  readonly markerEnd?: EdgeMarkerType;
}

/**
 * User-configurable edge style settings (simplified from EdgeStyleDefinition).
 * Used for project-level defaults and per-edge overrides.
 */
export interface EdgeStyleSettings {
  /** Line style: solid, dashed, dotted, or animated */
  lineStyle?: EdgeLineStyle;
  /** Stroke color (hex color like #ff0000) */
  color?: string;
  /** Stroke width in pixels (1-5) */
  thickness?: number;
  /** Marker at source/start end (line start) */
  markerStart?: EdgeMarkerType;
  /** Marker at target/end (line end) */
  markerEnd?: EdgeMarkerType;
}

/**
 * Project-level edge style defaults per category.
 */
export type ProjectEdgeStyles = Partial<Record<EdgeCategoryId, EdgeStyleSettings>>;

/**
 * Definition of an edge category with default styling and behavior flags.
 */
export interface EdgeCategoryDefinition {
  /** Unique category identifier */
  readonly id: EdgeCategoryId;
  /** Human-readable label for UI */
  readonly label: string;
  /** Default styling for edges of this category */
  readonly defaultStyle: EdgeStyleDefinition;
  /** Whether edges of this category affect HCL generation */
  readonly affectsHcl: boolean;
  /** Whether users can manually create edges of this category */
  readonly userCreatable: boolean;
  /** Whether edges of this category are persisted in project files */
  readonly persisted: boolean;
  /** Whether edges of this category can be selected and deleted */
  readonly selectable: boolean;
}

/**
 * Custom data stored on each edge instance.
 * Using Record<string, unknown> compatible structure for SvelteFlow edge data.
 */
export interface TerraStudioEdgeData extends Record<string, unknown> {
  /** Edge category determining behavior and default styling */
  category: EdgeCategoryId;
  /** User label (editable for annotation edges) */
  label?: string;
  /** User style overrides for this specific edge */
  styleOverrides?: EdgeStyleSettings;
  /**
   * For structural/binding edges: information about the connection rule
   * that validated this edge.
   */
  ruleMatch?: {
    sourceType: ResourceTypeId;
    targetType: ResourceTypeId;
    createsReference?: {
      side: 'source' | 'target';
      propertyKey: string;
    };
    outputBinding?: {
      sourceAttribute: string;
    };
  };
  /** For reference edges: which property triggered this edge */
  sourceProperty?: string;
}

/**
 * User customizations for a reference edge (stored on source node).
 * Reference edges are derived from node.references, but users can
 * add labels and style overrides which are stored on the source node.
 */
export interface ReferenceEdgeOverride {
  /** User-defined label for this reference edge */
  label?: string;
  /** User-defined style overrides for this reference edge */
  styleOverrides?: EdgeStyleSettings;
}

/**
 * Map of reference edge overrides keyed by property key.
 * Example: { 'target_resource_id': { label: 'Private Link', styleOverrides: { color: '#ff0000' } } }
 */
export type ReferenceEdgeOverrides = Record<string, ReferenceEdgeOverride>;

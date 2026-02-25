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
  /** Style overrides (for annotation edges with custom styling) */
  styleOverrides?: Partial<EdgeStyleDefinition>;
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

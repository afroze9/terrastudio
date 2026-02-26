import type { EdgeStyleDefinition, EdgeMarkerType, EdgeStyleSettings, EdgeLineStyle } from '@terrastudio/types';

/**
 * Default edge style fallback.
 */
export const DEFAULT_EDGE_STYLE: EdgeStyleDefinition = {
  strokeColor: 'var(--edge-structural)',
  strokeWidth: 2,
  markerEnd: 'arrowClosed',
};

/**
 * Convert line style to dash array and animated flag.
 * Returns explicit values (including undefined) to properly override defaults.
 */
function lineStyleToStyleProps(style: EdgeLineStyle | undefined): { dashArray: string | undefined; animated: boolean } {
  switch (style) {
    case 'dashed':
      return { dashArray: '5 4', animated: false };
    case 'dotted':
      return { dashArray: '2 2', animated: false };
    case 'animated':
      return { dashArray: undefined, animated: true };
    case 'solid':
      return { dashArray: undefined, animated: false };
    default:
      // undefined style means "don't override" - return values that won't override
      return { dashArray: undefined, animated: false };
  }
}

// Mutable version of EdgeStyleDefinition for building
type MutableEdgeStyle = {
  strokeColor?: string;
  strokeWidth?: number;
  dashArray?: string;
  animated?: boolean;
  markerStart?: EdgeMarkerType;
  markerEnd?: EdgeMarkerType;
};

/**
 * Convert user-friendly EdgeStyleSettings to internal EdgeStyleDefinition.
 */
export function settingsToDefinition(settings: EdgeStyleSettings): MutableEdgeStyle {
  const result: MutableEdgeStyle = {};

  if (settings.lineStyle) {
    const styleProps = lineStyleToStyleProps(settings.lineStyle);
    // Always set both dashArray and animated when lineStyle is specified
    // to properly override category defaults
    result.dashArray = styleProps.dashArray;
    result.animated = styleProps.animated;
  }
  if (settings.color) {
    result.strokeColor = settings.color;
  }
  if (settings.thickness !== undefined) {
    result.strokeWidth = settings.thickness;
  }
  if (settings.markerStart !== undefined) {
    result.markerStart = settings.markerStart;
  }
  if (settings.markerEnd !== undefined) {
    result.markerEnd = settings.markerEnd;
  }

  return result;
}

/**
 * Merge category default style with project-level settings and per-edge overrides.
 * Priority: per-edge > project-level > category default
 */
export function mergeEdgeStyles(
  categoryDefault: EdgeStyleDefinition | undefined,
  projectSettings: EdgeStyleSettings | undefined,
  edgeOverrides: EdgeStyleSettings | undefined,
): EdgeStyleDefinition {
  const base = categoryDefault ?? DEFAULT_EDGE_STYLE;

  // Convert project settings to definition format
  const projectDef = projectSettings ? settingsToDefinition(projectSettings) : {};

  // Convert edge overrides to definition format
  const overridesDef = edgeOverrides ? settingsToDefinition(edgeOverrides) : {};

  // Build merged style - mutable during construction
  const merged: MutableEdgeStyle = {
    strokeColor: base.strokeColor,
    strokeWidth: base.strokeWidth,
    dashArray: base.dashArray,
    animated: base.animated,
    markerStart: base.markerStart,
    markerEnd: base.markerEnd,
  };

  // Apply project settings (check 'in' to allow undefined to override defined values)
  if ('strokeColor' in projectDef) merged.strokeColor = projectDef.strokeColor;
  if ('strokeWidth' in projectDef) merged.strokeWidth = projectDef.strokeWidth;
  if ('dashArray' in projectDef) merged.dashArray = projectDef.dashArray;
  if ('animated' in projectDef) merged.animated = projectDef.animated;
  if ('markerStart' in projectDef) merged.markerStart = projectDef.markerStart;
  if ('markerEnd' in projectDef) merged.markerEnd = projectDef.markerEnd;

  // Apply edge overrides (check 'in' to allow undefined to override project/base)
  if ('strokeColor' in overridesDef) merged.strokeColor = overridesDef.strokeColor;
  if ('strokeWidth' in overridesDef) merged.strokeWidth = overridesDef.strokeWidth;
  if ('dashArray' in overridesDef) merged.dashArray = overridesDef.dashArray;
  if ('animated' in overridesDef) merged.animated = overridesDef.animated;
  if ('markerStart' in overridesDef) merged.markerStart = overridesDef.markerStart;
  if ('markerEnd' in overridesDef) merged.markerEnd = overridesDef.markerEnd;

  // Return as readonly EdgeStyleDefinition
  return merged as EdgeStyleDefinition;
}

/**
 * Compute the CSS style string for an edge.
 */
export function computeEdgeStyle(
  style: EdgeStyleDefinition,
  selected: boolean,
): string {
  const parts = [
    `stroke: ${style.strokeColor}`,
    `stroke-width: ${selected ? style.strokeWidth + 1 : style.strokeWidth}px`,
  ];

  if (style.dashArray) {
    parts.push(`stroke-dasharray: ${style.dashArray}`);
  }

  return parts.join('; ');
}

/**
 * Get the URL reference for an SVG marker at the end of the edge (target side).
 */
export function getMarkerUrl(marker: EdgeMarkerType | undefined): string | undefined {
  if (!marker || marker === 'none') return undefined;
  return `url(#terrastudio-marker-${marker})`;
}

/**
 * Get the URL reference for an SVG marker at the start of the edge (source side).
 * Uses the -start variant markers which have reversed arrow direction.
 */
export function getMarkerStartUrl(marker: EdgeMarkerType | undefined): string | undefined {
  if (!marker || marker === 'none') return undefined;
  return `url(#terrastudio-marker-${marker}-start)`;
}

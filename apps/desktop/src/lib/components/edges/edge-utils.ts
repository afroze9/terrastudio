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
 * Convert line style to dash array.
 */
function lineStyleToDashArray(style: EdgeLineStyle | undefined): string | undefined {
  switch (style) {
    case 'dashed':
      return '5 4';
    case 'dotted':
      return '2 2';
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * Convert user-friendly EdgeStyleSettings to internal EdgeStyleDefinition.
 */
export function settingsToDefinition(settings: EdgeStyleSettings): Partial<EdgeStyleDefinition> {
  const result: {
    dashArray?: string;
    animated?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
    markerEnd?: EdgeMarkerType;
  } = {};

  if (settings.lineStyle) {
    result.dashArray = lineStyleToDashArray(settings.lineStyle);
  }
  if (settings.animated !== undefined) {
    result.animated = settings.animated;
  }
  if (settings.color) {
    result.strokeColor = settings.color;
  }
  if (settings.thickness !== undefined) {
    result.strokeWidth = settings.thickness;
  }
  if (settings.markerEnd !== undefined) {
    result.markerEnd = settings.markerEnd;
  }

  return result as Partial<EdgeStyleDefinition>;
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

  // Merge with priority: overrides > project > base
  return {
    ...base,
    ...projectDef,
    ...overridesDef,
  };
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
 * Get the URL reference for an SVG marker.
 */
export function getMarkerUrl(marker: EdgeMarkerType | undefined): string | undefined {
  if (!marker || marker === 'none') return undefined;
  return `url(#terrastudio-marker-${marker})`;
}

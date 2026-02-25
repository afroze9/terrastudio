import type { EdgeStyleDefinition, EdgeMarkerType } from '@terrastudio/types';

/**
 * Compute the CSS style string for an edge based on category defaults and overrides.
 */
export function computeEdgeStyle(
  defaultStyle: EdgeStyleDefinition | undefined,
  overrides: Partial<EdgeStyleDefinition> | undefined,
  selected: boolean,
): string {
  const base: EdgeStyleDefinition = defaultStyle ?? {
    strokeColor: '#64748b',
    strokeWidth: 2,
  };

  const merged = { ...base, ...overrides };

  const parts = [
    `stroke: ${merged.strokeColor}`,
    `stroke-width: ${selected ? merged.strokeWidth + 1 : merged.strokeWidth}px`,
  ];

  if (merged.dashArray) {
    parts.push(`stroke-dasharray: ${merged.dashArray}`);
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

/**
 * Default edge style fallback.
 */
export const DEFAULT_EDGE_STYLE: EdgeStyleDefinition = {
  strokeColor: 'var(--edge-structural)',
  strokeWidth: 2,
  markerEnd: 'arrowClosed',
};

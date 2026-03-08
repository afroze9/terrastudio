/**
 * Preset color themes for annotation nodes.
 */
export type AnnotationColor =
  | 'yellow'
  | 'blue'
  | 'green'
  | 'red'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'grey';

/**
 * Logical size presets. Users can override dimensions by dragging resize handles.
 */
export type AnnotationSize = 'small' | 'medium' | 'large';

/**
 * Data payload stored in DiagramNode.data for annotation nodes.
 * Node type is always '_annotation_'.
 */
export interface AnnotationNodeData {
  readonly kind: '_annotation_';
  text: string;
  color: AnnotationColor;
  size: AnnotationSize;
  label?: string;
}

/** Default dimensions per size preset (width x height in pixels) */
export const ANNOTATION_SIZE_DEFAULTS: Record<AnnotationSize, { width: number; height: number }> = {
  small:  { width: 140, height: 100 },
  medium: { width: 200, height: 140 },
  large:  { width: 280, height: 200 },
};

/** CSS values for each color theme (header bg, body bg, border, text) */
export const ANNOTATION_COLOR_THEMES: Record<
  AnnotationColor,
  { header: string; body: string; border: string; text: string }
> = {
  yellow: { header: '#f5c842', body: 'rgba(255, 245, 180, 0.88)', border: '#d4a800', text: '#3d2e00' },
  blue:   { header: '#4a9eff', body: 'rgba(210, 235, 255, 0.88)', border: '#1a6fcc', text: '#0a2a50' },
  green:  { header: '#4caf6e', body: 'rgba(210, 245, 220, 0.88)', border: '#2e7d4f', text: '#0e3020' },
  red:    { header: '#e05555', body: 'rgba(255, 220, 220, 0.88)', border: '#b83030', text: '#3d0a0a' },
  purple: { header: '#9b59b6', body: 'rgba(235, 215, 255, 0.88)', border: '#6c3483', text: '#2a0a40' },
  orange: { header: '#f39c12', body: 'rgba(255, 235, 200, 0.88)', border: '#b5740a', text: '#3d2000' },
  teal:   { header: '#26a69a', body: 'rgba(200, 245, 240, 0.88)', border: '#00796b', text: '#00332e' },
  grey:   { header: '#78909c', body: 'rgba(230, 235, 238, 0.88)', border: '#546e7a', text: '#1c2a30' },
};

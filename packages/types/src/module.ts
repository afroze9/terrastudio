/**
 * A Terraform module definition — a logical grouping of resources
 * that generates into its own `modules/{name}/` directory.
 *
 * Module membership is tracked via `moduleId` on ResourceNodeData,
 * which is completely independent of `parentId` (infrastructure containment).
 */
export interface ModuleDefinition {
  /** Unique module ID (e.g., "mod-abc123") */
  readonly id: string;
  /** User-facing name — must be a valid Terraform module name (lowercase, alphanumeric + hyphens) */
  readonly name: string;
  /** Optional description shown in sidebar */
  readonly description?: string;
  /** Whether module is visually collapsed on the canvas */
  readonly collapsed: boolean;
  /** Canvas position used when the module is rendered as a collapsed node */
  readonly position: { x: number; y: number };
  /** Visual border/header color (CSS color string) */
  readonly color?: string;
}

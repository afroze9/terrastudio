/**
 * A Terraform module definition — a logical grouping of resources
 * that generates into its own `modules/{name}/` directory.
 *
 * Module membership is tracked via `moduleId` on ResourceNodeData,
 * which is completely independent of `parentId` (infrastructure containment).
 *
 * When `isTemplate` is true, the module serves as a reusable template:
 * multiple `ModuleInstance` records can reference it, each generating
 * a separate `module "..." {}` block in root `main.tf` that points to
 * the same shared `modules/{name}/` source directory.
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
  /**
   * When true, this module is a reusable template that can have instances.
   * Template variables are derived from member nodes' `variableOverrides`.
   */
  readonly isTemplate?: boolean;
}

/**
 * An instance of a module template. References a `ModuleDefinition` with
 * `isTemplate: true` and carries per-instance variable value overrides.
 *
 * On the canvas, instances render as collapsed card nodes.
 * In HCL output, each instance produces a `module "{name}" {}` block
 * pointing to `source = "./modules/{template.name}"`.
 */
export interface ModuleInstance {
  /** Unique instance ID (e.g., "modinst-abc123") */
  readonly id: string;
  /** Reference to the template ModuleDefinition.id */
  readonly templateId: string;
  /** Terraform module block name (e.g., "net_prod") — must be a valid Terraform name */
  readonly name: string;
  /** Optional description */
  readonly description?: string;
  /** Canvas position for the instance card node */
  readonly position: { x: number; y: number };
  /** Per-variable value overrides (variable name → value). Missing keys use template defaults. */
  readonly variableValues: Record<string, unknown>;
  /** Visual color override (defaults to template color) */
  readonly color?: string;
  /** Whether the instance is visually collapsed (card-only) on the canvas. Defaults to true. */
  readonly collapsed?: boolean;
}

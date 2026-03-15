import type { ProjectNode, ProjectEdge } from './node.js';

/**
 * Serialized diagram snapshot — nodes + edges + optional module data.
 * This mirrors DiagramSnapshot in @terrastudio/project but lives in @terrastudio/types
 * so platform adapters can depend on it without a circular dependency.
 */
export interface DiagramData {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  modules?: unknown[];
  moduleInstances?: unknown[];
}

/**
 * Serialized project config stored in the .tstudio file.
 * Typed as unknown to avoid coupling to @terrastudio/core's ProjectConfig shape.
 */
export interface ProjectFileMetadata {
  name: string;
  version: string;
  projectConfig: unknown;
}

/**
 * Loaded project data returned by IProjectStorage.loadProject / createProject.
 */
export interface StoredProjectData {
  path: string;
  metadata: ProjectFileMetadata;
  diagram: DiagramData | null;
}

/**
 * Platform-agnostic interface for reading and writing TerraStudio project files.
 *
 * Implement this interface once per platform:
 *   - `NodeProjectStorage` (packages/platform-node) — Node.js fs, used by CLI
 *   - `TauriProjectStorage` (packages/platform-tauri) — Tauri invoke, used by desktop
 *
 * This interface deliberately excludes platform-specific concerns such as:
 *   - Terraform CLI execution (desktop/server only)
 *   - Secrets store (desktop only)
 *   - Window management (desktop only)
 *   - Azure pricing API (desktop only)
 */
export interface IProjectStorage {
  /**
   * Create a new project directory with the standard structure.
   * Returns the loaded project data (metadata + empty diagram).
   */
  createProject(name: string, parentPath: string): Promise<StoredProjectData>;

  /**
   * Load a project from a directory containing a .tstudio file.
   */
  loadProject(projectPath: string): Promise<StoredProjectData>;

  /**
   * Save the diagram state to `{projectPath}/diagrams/main.json`.
   */
  saveDiagram(projectPath: string, diagram: DiagramData): Promise<void>;

  /**
   * Save the project config to the `.tstudio` file.
   * Only the `projectConfig` field is updated; `name` and `version` are preserved.
   *
   * @param projectConfig - The raw project config object to persist.
   */
  saveProjectConfig(projectPath: string, projectConfig: unknown): Promise<void>;

  /**
   * Write Terraform HCL files to `{projectPath}/terraform/`.
   * The `files` map is `{ filename: content }`, e.g. `{ 'main.tf': '...' }`.
   */
  writeTerraformFiles(projectPath: string, files: Record<string, string>): Promise<void>;

  /**
   * Read all `.tf` files from `{projectPath}/terraform/`.
   * Returns `{ filename: content }`. Returns empty object if directory doesn't exist.
   */
  readTerraformFiles(projectPath: string): Promise<Record<string, string>>;
}

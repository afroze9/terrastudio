import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { project, type ProjectMetadata } from '$lib/stores/project.svelte';
import { diagram, type DiagramEdge } from '$lib/stores/diagram.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { registry } from '$lib/bootstrap';
import { applyTemplate } from '$lib/templates/service';
import type { Template } from '$lib/templates/types';
import type { NamingConvention, EdgeCategoryId } from '@terrastudio/types';
import type { LayoutAlgorithm } from '@terrastudio/core';

/**
 * Migrate edges from old format (no data.category) to new format.
 * Infers category from edge properties:
 * - animated: true -> binding
 * - id starts with 'ref-' -> reference
 * - otherwise -> structural
 */
function migrateEdges(edges: unknown[]): DiagramEdge[] {
  return edges.map((edge: any) => {
    // Already migrated - has data.category
    if (edge.data?.category) return edge as DiagramEdge;

    // Infer category from existing properties
    let category: EdgeCategoryId = 'structural';
    if (edge.animated) {
      category = 'binding';
    } else if (edge.id?.startsWith('ref-')) {
      category = 'reference';
    }

    // Create new edge with data.category, preserving existing label
    const { animated, style, label, ...rest } = edge;
    return {
      ...rest,
      data: {
        category,
        label: label ?? undefined,
      },
    } as DiagramEdge;
  });
}

interface ProjectData {
  metadata: ProjectMetadata;
  diagram: {
    nodes: unknown[];
    edges: unknown[];
  } | null;
  path: string;
}

/**
 * Check for unsaved changes and prompt the user. Returns true if safe to proceed.
 */
export async function guardUnsavedChanges(): Promise<boolean> {
  if (!project.isOpen || !project.isDirty) return true;
  const result = await ui.confirmUnsaved();
  if (result === 'cancel') return false;
  if (result === 'save') await saveDiagram();
  return true;
}

/**
 * Create a new project: create directory structure and optionally apply a template.
 */
export async function createProject(
  name: string,
  parentPath: string,
  template?: Template,
  namingConvention?: NamingConvention,
  layoutAlgorithm?: LayoutAlgorithm,
): Promise<void> {
  const data = await invoke<ProjectData>('create_project', {
    name,
    parentPath,
  });

  diagram.clear();
  project.open(data.path, data.metadata);

  // Apply any config overrides and persist them
  const hasOverrides = namingConvention || layoutAlgorithm;
  if (hasOverrides) {
    if (namingConvention) project.projectConfig = { ...project.projectConfig, namingConvention };
    if (layoutAlgorithm) project.projectConfig = { ...project.projectConfig, layoutAlgorithm };
    await invoke('save_project_config', {
      projectPath: data.path,
      projectConfig: project.projectConfig,
    });
  }

  if (template) {
    const { nodes, edges } = applyTemplate(template, namingConvention, registry);
    diagram.loadDiagram(nodes, edges);
    await saveDiagram();
  }
}

/**
 * Open an existing project: show folder picker, load terrastudio.json + diagram.
 */
export async function openProject(): Promise<void> {
  if (!(await guardUnsavedChanges())) return;

  const selected = await openDialog({
    directory: true,
    title: 'Open TerraStudio Project',
  });

  if (!selected) return;

  const data = await invoke<ProjectData>('load_project', {
    projectPath: selected,
  });

  diagram.clear();
  project.open(data.path, data.metadata);

  // Restore diagram if it exists, migrating old edges to new format
  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[] };
    const nodes = (d.nodes ?? []) as any[];
    const edges = migrateEdges(d.edges ?? []);
    diagram.loadDiagram(nodes, edges);
  }
}

/**
 * Load a project from a known path (no folder picker).
 * Used by the welcome screen when clicking a recent project.
 */
export async function loadProjectByPath(path: string): Promise<void> {
  if (!(await guardUnsavedChanges())) return;

  const data = await invoke<ProjectData>('load_project', {
    projectPath: path,
  });

  diagram.clear();
  project.open(data.path, data.metadata);

  // Restore diagram if it exists, migrating old edges to new format
  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[] };
    const nodes = (d.nodes ?? []) as any[];
    const edges = migrateEdges(d.edges ?? []);
    diagram.loadDiagram(nodes, edges);
  }
}

/**
 * Save the current diagram to the project's diagrams/main.json.
 */
export async function saveDiagram(): Promise<void> {
  if (!project.path) return;

  const diagramData = {
    nodes: diagram.nodes,
    edges: diagram.edges,
  };

  await invoke('save_diagram', {
    projectPath: project.path,
    diagram: diagramData,
  });

  project.markSaved();
}

/**
 * Pick a folder using the native dialog.
 */
export async function pickFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    title: 'Select Project Location',
  });
  return selected ?? null;
}


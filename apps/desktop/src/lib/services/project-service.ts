import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { project, type ProjectMetadata } from '$lib/stores/project.svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { applyTemplate } from '$lib/templates/service';
import type { Template } from '$lib/templates/types';

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
): Promise<void> {
  const data = await invoke<ProjectData>('create_project', {
    name,
    parentPath,
  });

  diagram.clear();
  project.open(data.path, data.metadata);

  if (template) {
    const { nodes, edges } = applyTemplate(template);
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

  // Restore diagram if it exists
  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[] };
    diagram.loadDiagram((d.nodes ?? []) as any[], (d.edges ?? []) as any[]);
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

  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[] };
    diagram.loadDiagram((d.nodes ?? []) as any[], (d.edges ?? []) as any[]);
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


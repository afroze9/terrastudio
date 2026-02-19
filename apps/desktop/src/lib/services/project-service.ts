import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { project, type ProjectMetadata } from '$lib/stores/project.svelte';
import { diagram } from '$lib/stores/diagram.svelte';

interface ProjectData {
  metadata: ProjectMetadata;
  diagram: {
    nodes: unknown[];
    edges: unknown[];
  } | null;
  path: string;
}

/**
 * Create a new project: show folder picker, create directory structure.
 */
export async function createProject(name: string, parentPath: string): Promise<void> {
  const data = await invoke<ProjectData>('create_project', {
    name,
    parentPath,
  });

  diagram.clear();
  project.open(data.path, data.metadata);
}

/**
 * Open an existing project: show folder picker, load terrastudio.json + diagram.
 */
export async function openProject(): Promise<void> {
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

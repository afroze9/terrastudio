import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ResourceTypeId } from '@terrastudio/types';
import { createNodeData, generateNodeId } from '@terrastudio/core';
import { registry } from '$lib/bootstrap';
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

  // Pre-populate canvas with Subscription + Resource Group
  prePopulateCanvas();
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

/**
 * Pre-populate a new project with a Subscription container and Resource Group inside it.
 */
function prePopulateCanvas(): void {
  const subTypeId: ResourceTypeId = 'azurerm/core/subscription';
  const rgTypeId: ResourceTypeId = 'azurerm/core/resource_group';

  const subSchema = registry.getResourceSchema(subTypeId);
  const rgSchema = registry.getResourceSchema(rgTypeId);
  if (!subSchema || !rgSchema) return;

  // Create Subscription container
  const subId = generateNodeId(subTypeId);
  const subData = createNodeData(subSchema, {
    label: 'Subscription',
  });

  diagram.addNode({
    id: subId,
    type: subTypeId,
    position: { x: 100, y: 100 },
    data: subData,
    width: 900,
    height: 700,
    style: 'width: 900px; height: 700px;',
  } as any);

  // Create Resource Group as child of Subscription
  const rgId = generateNodeId(rgTypeId);
  const rgData = createNodeData(rgSchema, {
    label: 'Resource Group',
  });

  diagram.addNode({
    id: rgId,
    type: rgTypeId,
    position: { x: 50, y: 60 },
    data: rgData,
    parentId: subId,
    width: 800,
    height: 600,
    style: 'width: 800px; height: 600px;',
  } as any);
}

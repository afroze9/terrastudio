import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { project, type ProjectMetadata } from '$lib/stores/project.svelte';
import { diagram, type DiagramEdge } from '$lib/stores/diagram.svelte';
import { cost } from '$lib/stores/cost.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { registry, loadPluginsForProject } from '$lib/bootstrap';
import { applyTemplate } from '$lib/templates/service';
import type { Template } from '$lib/templates/types';
import type { NamingConvention, EdgeCategoryId } from '@terrastudio/types';
import type { LayoutAlgorithm, ProjectConfig } from '@terrastudio/core';
import type { ProviderId } from '@terrastudio/types';

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
  cost: unknown | null;
  path: string;
}

/**
 * Resolve which provider IDs to load for a given project config.
 * Defaults to ['azurerm'] for backward compatibility with projects that
 * don't have activeProviders set.
 */
function resolveActiveProviders(config: ProjectConfig): ProviderId[] {
  return (config.activeProviders?.length ? config.activeProviders : ['azurerm']) as ProviderId[];
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
  activeProviders?: ProviderId[],
): Promise<void> {
  const data = await invoke<ProjectData>('create_project', {
    name,
    parentPath,
  });

  // Load plugins before opening project in store
  const providers = activeProviders?.length ? activeProviders : ['azurerm' as ProviderId];
  await loadPluginsForProject(providers);

  diagram.clear();
  project.open(data.path, data.metadata);

  // Set window title and sync project info to MCP state
  const appWindow = getCurrentWindow();
  appWindow.setTitle(`${name} — TerraStudio`).catch(() => {});
  invoke('mcp_set_window_project', {
    windowLabel: appWindow.label,
    projectName: name,
    projectPath: data.path,
  }).catch(() => {});

  // Apply config overrides and persist them (always save activeProviders)
  if (namingConvention) project.projectConfig = { ...project.projectConfig, namingConvention };
  if (layoutAlgorithm) project.projectConfig = { ...project.projectConfig, layoutAlgorithm };
  project.projectConfig = { ...project.projectConfig, activeProviders: providers };
  await invoke('save_project_config', {
    projectPath: data.path,
    projectConfig: project.projectConfig,
  });

  if (template) {
    const { nodes, edges } = applyTemplate(template, namingConvention, registry);
    diagram.loadDiagram(nodes, edges);
    await saveDiagram();
  }
}

/**
 * Open an existing project: show file picker for .tstudio files, load project + diagram.
 */
export async function openProject(): Promise<void> {
  if (!(await guardUnsavedChanges())) return;

  const selected = await openDialog({
    title: 'Open TerraStudio Project',
    filters: [
      { name: 'TerraStudio Project', extensions: ['tstudio'] },
    ],
    directory: false,
  });

  if (!selected) return;

  // Derive project directory from the .tstudio file path
  const projectDir = selected.replace(/[\\/][^\\/]+$/, '');
  await loadProjectByPath(projectDir);
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

  // Load plugins before opening project in store
  await loadPluginsForProject(resolveActiveProviders(data.metadata.projectConfig));

  diagram.clear();
  cost.clear();
  project.open(data.path, data.metadata);

  // Set window title and sync project info to MCP state
  const appWindow = getCurrentWindow();
  appWindow.setTitle(`${data.metadata.name} — TerraStudio`).catch(() => {});
  invoke('mcp_set_window_project', {
    windowLabel: appWindow.label,
    projectName: data.metadata.name,
    projectPath: data.path,
  }).catch(() => {});

  // Restore diagram if it exists, migrating old edges to new format
  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[] };
    const nodes = (d.nodes ?? []) as any[];
    const edges = migrateEdges(d.edges ?? []);
    diagram.loadDiagram(nodes, edges);
  }

  // Restore cost estimates if present, then check if diagram changed since last save
  if (data.cost) {
    cost.loadSaved(data.cost as any);
    cost.checkDirty(diagram.nodes);
  }
}

/**
 * Save the current diagram to the project's diagrams/main.json
 * and project config to {name}.tstudio.
 */
export async function saveDiagram(): Promise<void> {
  if (!project.path) return;

  const diagramData = {
    nodes: diagram.nodes,
    edges: diagram.edges,
  };

  // Save diagram, project config, and cost estimates in parallel
  await Promise.all([
    invoke('save_diagram', {
      projectPath: project.path,
      diagram: diagramData,
    }),
    invoke('save_project_config', {
      projectPath: project.path,
      projectConfig: project.projectConfig,
    }),
    cost.hasPrices
      ? invoke('save_cost', {
          projectPath: project.path,
          cost: cost.toJSON(),
        })
      : Promise.resolve(),
  ]);

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
 * Initialize this window's project on startup.
 * Checks for a pending project path assigned to this specific window (for dynamically
 * created windows), or from the initial launch args (for the "main" window).
 *
 * Call this once from the root layout or app initialization.
 */
export async function initWindowProject(): Promise<void> {
  // 1. Check if this window was created with a specific project path
  const windowPath = await invoke<string | null>('get_window_pending_path');
  if (windowPath) {
    await loadProjectByPath(windowPath);
    return;
  }

  // 2. Check for first-launch file association (only relevant for the "main" window)
  const pendingPath = await invoke<string | null>('get_pending_open_path');
  if (pendingPath) {
    await loadProjectByPath(pendingPath);
  }
}

/**
 * Initialize file association handling.
 * Listens for `project://open-request` fallback events. If a project is already open,
 * creates a new window for the incoming project instead of replacing the current one.
 *
 * Call this once from the root layout or app initialization.
 */
export async function initFileAssociationHandler(): Promise<void> {
  await listen<{ path: string }>('project://open-request', async (event) => {
    const path = event.payload.path;
    if (!path) return;

    if (project.isOpen) {
      // Project already open in this window — open a new window
      await invoke('create_project_window', { projectPath: path });
    } else {
      // On welcome screen — load into this window
      await loadProjectByPath(path);
    }
  });
}

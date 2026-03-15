import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { project, type ProjectMetadata } from '$lib/stores/project.svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { cost } from '$lib/stores/cost.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { terraform } from '$lib/stores/terraform.svelte';
import { plan } from '$lib/stores/plan.svelte';
import { registry, loadPluginsForProject } from '$lib/bootstrap';
import { logger } from '$lib/logger';
import { applyTemplate } from '$lib/templates/service';
import type { Template } from '$lib/templates/types';
import type { NamingConvention } from '@terrastudio/types';
import type { LayoutAlgorithm, ProjectConfig } from '@terrastudio/core';
import type { ProviderId } from '@terrastudio/types';
import { migrateEdges, resolveActiveProviders } from '@terrastudio/project';

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
  terraform.clear();
  plan.clear();
  cost.clear();
  ui.closeAllFileTabs();
  project.open(data.path, data.metadata);

  // Set window title
  getCurrentWindow().setTitle(`${name} — TerraStudio`).catch(() => {});

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
  const diagramNodes = (data.diagram as any)?.nodes as unknown[] | undefined;
  logger.info(`[project] Loading project "${data.metadata.name}" — diagram has ${diagramNodes?.length ?? 0} nodes`);
  const providers = resolveActiveProviders(data.metadata.projectConfig, diagramNodes);
  logger.info(`[project] Loading plugins for providers: [${providers.join(', ')}]`);
  await loadPluginsForProject(providers);

  diagram.clear();
  terraform.clear();
  plan.clear();
  cost.clear();
  ui.closeAllFileTabs();
  project.open(data.path, data.metadata);

  // Merge user secrets into variableValues if this project has a secretsId
  if (project.projectConfig.secretsId) {
    try {
      const secrets = await invoke<Record<string, string>>('load_user_secrets', {
        secretsId: project.projectConfig.secretsId,
      });
      if (Object.keys(secrets).length > 0) {
        project.projectConfig = {
          ...project.projectConfig,
          variableValues: {
            ...project.projectConfig.variableValues,
            ...secrets,
          },
        };
      }
    } catch {
      console.warn('Failed to load user secrets, continuing without them');
    }
  }

  // Set window title
  getCurrentWindow().setTitle(`${data.metadata.name} — TerraStudio`).catch(() => {});

  // Restore diagram if it exists, migrating old edges to new format
  if (data.diagram) {
    const d = data.diagram as { nodes?: unknown[]; edges?: unknown[]; modules?: unknown[]; moduleInstances?: unknown[] };
    const nodes = (d.nodes ?? []) as any[];
    const edges = migrateEdges(d.edges ?? []);
    const modules = (d.modules ?? []) as any[];
    const moduleInstances = (d.moduleInstances ?? []) as any[];
    diagram.loadDiagram(nodes, edges, modules, moduleInstances);
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
 *
 * Sensitive variable values (determined by collectedVariables) are stored
 * separately in the user secrets store (app data dir), not in the project file.
 */
export async function saveDiagram(): Promise<void> {
  if (!project.path) return;

  // Filter out transient cloned nodes (_instmem_) — they're rebuilt on expand and shouldn't be persisted.
  // Also filter their cloned edges. Synthetic module/instance nodes (_mod_, _modinst_) are kept as they're
  // recreated on load if missing.
  const diagramData = {
    nodes: diagram.nodes.filter((n) => !n.id.startsWith('_instmem_')),
    edges: diagram.edges.filter((e) => !e.id.startsWith('_instmem_')),
    modules: diagram.modules,
    moduleInstances: diagram.moduleInstances,
  };

  // Determine which variable names are sensitive from the last HCL generation
  const sensitiveNames = new Set(
    terraform.collectedVariables
      .filter((v) => v.sensitive)
      .map((v) => v.name),
  );

  // Split variableValues into public (saved in .tstudio) and secret (saved in app data)
  const allValues = { ...project.projectConfig.variableValues };
  const publicValues: Record<string, unknown> = {};
  const secretValues: Record<string, string> = {};

  for (const [key, value] of Object.entries(allValues)) {
    if (sensitiveNames.has(key) && value && typeof value === 'string') {
      secretValues[key] = value;
    } else {
      publicValues[key] = value;
    }
  }

  // Generate a secretsId if this project doesn't have one yet and has secrets
  if (!project.projectConfig.secretsId && Object.keys(secretValues).length > 0) {
    const secretsId = await invoke<string>('generate_secrets_id');
    project.projectConfig = { ...project.projectConfig, secretsId };
  }

  // Build config for saving — with sensitive values stripped out
  const configForSave = {
    ...project.projectConfig,
    variableValues: publicValues,
  };

  // Save diagram, project config (without secrets), and cost in parallel
  const savePromises: Promise<unknown>[] = [
    invoke('save_diagram', {
      projectPath: project.path,
      diagram: diagramData,
    }),
    invoke('save_project_config', {
      projectPath: project.path,
      projectConfig: configForSave,
    }),
    cost.hasPrices
      ? invoke('save_cost', {
          projectPath: project.path,
          cost: cost.toJSON(),
        })
      : Promise.resolve(),
  ];

  // Save secrets to app data dir if we have a secretsId
  if (project.projectConfig.secretsId) {
    savePromises.push(
      invoke('save_user_secrets', {
        secretsId: project.projectConfig.secretsId,
        secrets: secretValues,
      }),
    );
  }

  await Promise.all(savePromises);
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

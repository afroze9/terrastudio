/**
 * Node.js I/O adapter for the TerraStudio CLI.
 * Reads and writes project files using the Node.js fs module.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DiagramSnapshot, ProjectMetadata, LoadedProject, ProjectValidatorContext } from '@terrastudio/project';
import { PluginRegistry, EdgeRuleValidator } from '@terrastudio/core';
import type { ProviderId, ResourceTypeId } from '@terrastudio/types';

/** Read and parse a JSON file. Throws if the file does not exist. */
export function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

/** Write a JSON file, creating parent directories as needed. */
export function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Write a text file, creating parent directories as needed. */
export function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Locate the .tstudio file in the given directory.
 * Throws if none or multiple are found.
 */
function findTstudioFile(projectPath: string): string {
  const entries = fs.readdirSync(projectPath);
  const tstudioFiles = entries.filter((e) => e.endsWith('.tstudio'));
  if (tstudioFiles.length === 0) {
    throw new Error(`No .tstudio file found in: ${projectPath}`);
  }
  if (tstudioFiles.length > 1) {
    throw new Error(`Multiple .tstudio files found in: ${projectPath}`);
  }
  return path.join(projectPath, tstudioFiles[0]!);
}

/**
 * Load a project from disk.
 * Reads the .tstudio metadata file and diagrams/main.json.
 */
export function loadProject(projectPath: string): LoadedProject {
  const tstudioFile = findTstudioFile(projectPath);
  const metadata = readJson<ProjectMetadata>(tstudioFile);

  const diagramFile = path.join(projectPath, 'diagrams', 'main.json');
  const diagram = fs.existsSync(diagramFile)
    ? readJson<DiagramSnapshot>(diagramFile)
    : null;

  return { path: projectPath, metadata, diagram };
}

/**
 * Save a project's diagram back to disk.
 */
export function saveDiagram(projectPath: string, diagram: DiagramSnapshot): void {
  const diagramFile = path.join(projectPath, 'diagrams', 'main.json');
  writeJson(diagramFile, diagram);
}

/**
 * Save the project config (.tstudio) back to disk.
 */
export function saveProjectConfig(projectPath: string, metadata: ProjectMetadata): void {
  const tstudioFile = findTstudioFile(projectPath);
  writeJson(tstudioFile, metadata);
}

/**
 * Write Terraform files to the project's terraform/ directory.
 */
export function writeTerraformFiles(projectPath: string, files: Record<string, string>): void {
  const tfDir = path.join(projectPath, 'terraform');
  for (const [filename, content] of Object.entries(files)) {
    writeText(path.join(tfDir, filename), content);
  }
}

/**
 * Load plugins for the given providers and return a ProjectValidatorContext.
 * This enables containment and connection validation in Project mutations.
 * Call once per command invocation — plugin loading is idempotent.
 */
export async function loadValidator(providerIds: ProviderId[]): Promise<ProjectValidatorContext> {
  const registry = new PluginRegistry();

  // Register lazy loaders for known providers
  for (const providerId of providerIds) {
    if (providerId === 'azurerm') {
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-networking'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-compute'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-storage'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-database'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-monitoring'));
      registry.registerLazyPlugin('azurerm', () => import('@terrastudio/plugin-azure-security'));
    } else if (providerId === 'aws') {
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-networking'));
      registry.registerLazyPlugin('aws', () => import('@terrastudio/plugin-aws-compute'));
    }
  }

  await registry.loadPluginsForProviders(providerIds);

  const rules = registry.getConnectionRules();
  const edgeValidator = new EdgeRuleValidator(rules);

  return {
    getSchema: (typeId: ResourceTypeId) => registry.getResourceSchema(typeId),
    edgeValidator,
  };
}

/**
 * Read all .tf files from the project's terraform/ directory.
 * Returns a map of filename -> content. Returns empty object if dir doesn't exist.
 */
export function readTerraformFiles(projectPath: string): Record<string, string> {
  const tfDir = path.join(projectPath, 'terraform');
  if (!fs.existsSync(tfDir)) return {};

  const entries = fs.readdirSync(tfDir);
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.endsWith('.tf')) {
      result[entry] = fs.readFileSync(path.join(tfDir, entry), 'utf8');
    }
  }
  return result;
}

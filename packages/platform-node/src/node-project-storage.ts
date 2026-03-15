import fs from 'node:fs';
import path from 'node:path';
import type { IProjectStorage, StoredProjectData, DiagramData, ProjectFileMetadata } from '@terrastudio/types';

/** Read and parse a JSON file. Throws if the file does not exist. */
function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

/** Write a JSON file, creating parent directories as needed. */
function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Write a text file, creating parent directories as needed. */
function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Locate the .tstudio file in the given directory. Throws if none or multiple are found. */
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
 * Node.js implementation of IProjectStorage.
 * Reads and writes project files using the Node.js `fs` module.
 * Used by the TerraStudio CLI.
 */
export class NodeProjectStorage implements IProjectStorage {
  async createProject(name: string, parentPath: string): Promise<StoredProjectData> {
    const projectDir = path.join(parentPath, name);

    if (fs.existsSync(projectDir)) {
      throw new Error(`Directory already exists: ${projectDir}`);
    }

    fs.mkdirSync(path.join(projectDir, 'diagrams'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'terraform'), { recursive: true });

    const metadata: ProjectFileMetadata = {
      name,
      version: '0.1.0',
      projectConfig: {
        providerConfigs: { azurerm: { features: {} } },
        resourceGroupName: `rg-${name}`,
        resourceGroupAsVariable: true,
        location: 'eastus',
        locationAsVariable: true,
        commonTags: { managed_by: 'terrastudio' },
        variableValues: {},
      },
    };

    const metadataPath = path.join(projectDir, `${name}.tstudio`);
    writeJson(metadataPath, metadata);

    return { path: projectDir, metadata, diagram: null };
  }

  async loadProject(projectPath: string): Promise<StoredProjectData> {
    const tstudioFile = findTstudioFile(projectPath);
    const metadata = readJson<ProjectFileMetadata>(tstudioFile);

    const diagramFile = path.join(projectPath, 'diagrams', 'main.json');
    const diagram = fs.existsSync(diagramFile)
      ? readJson<DiagramData>(diagramFile)
      : null;

    return { path: projectPath, metadata, diagram };
  }

  async saveDiagram(projectPath: string, diagram: DiagramData): Promise<void> {
    const diagramFile = path.join(projectPath, 'diagrams', 'main.json');
    writeJson(diagramFile, diagram);
  }

  async saveProjectConfig(projectPath: string, projectConfig: unknown): Promise<void> {
    const tstudioFile = findTstudioFile(projectPath);
    const existing = readJson<ProjectFileMetadata>(tstudioFile);
    writeJson(tstudioFile, { ...existing, projectConfig });
  }

  async writeTerraformFiles(projectPath: string, files: Record<string, string>): Promise<void> {
    const tfDir = path.join(projectPath, 'terraform');
    for (const [filename, content] of Object.entries(files)) {
      writeText(path.join(tfDir, filename), content);
    }
  }

  async readTerraformFiles(projectPath: string): Promise<Record<string, string>> {
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
}

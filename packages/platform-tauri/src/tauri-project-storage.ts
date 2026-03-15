import { invoke } from '@tauri-apps/api/core';
import type { IProjectStorage, StoredProjectData, DiagramData } from '@terrastudio/types';

/**
 * Tauri implementation of IProjectStorage.
 * Delegates file I/O to the Rust backend via `invoke`.
 * Used by the TerraStudio desktop application.
 */
export class TauriProjectStorage implements IProjectStorage {
  async createProject(name: string, parentPath: string): Promise<StoredProjectData> {
    return invoke<StoredProjectData>('create_project', { name, parentPath });
  }

  async loadProject(projectPath: string): Promise<StoredProjectData> {
    return invoke<StoredProjectData>('load_project', { projectPath });
  }

  async saveDiagram(projectPath: string, diagram: DiagramData): Promise<void> {
    return invoke('save_diagram', { projectPath, diagram });
  }

  async saveProjectConfig(projectPath: string, projectConfig: unknown): Promise<void> {
    await invoke('save_project_config', { projectPath, projectConfig });
  }

  async writeTerraformFiles(projectPath: string, files: Record<string, string>): Promise<void> {
    await invoke('write_terraform_files', { projectPath, files });
  }

  async readTerraformFiles(projectPath: string): Promise<Record<string, string>> {
    const filenames = await invoke<string[]>('list_terraform_files', { projectPath });
    const result: Record<string, string> = {};
    for (const filename of filenames) {
      result[filename] = await invoke<string>('read_terraform_file', { projectPath, filename });
    }
    return result;
  }
}

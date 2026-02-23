import type { ProjectConfig } from '@terrastudio/core';

export interface ProjectMetadata {
  name: string;
  version: string;
  projectConfig: ProjectConfig;
}

class ProjectStore {
  path = $state<string | null>(null);
  name = $state<string>('');
  isOpen = $state(false);
  isDirty = $state(false);

  projectConfig = $state<ProjectConfig>({
    providerConfigs: {
      azurerm: {
        features: {},
      },
    },
    commonTags: {
      managed_by: 'terrastudio',
    },
    variableValues: {},
  });

  open(path: string, metadata: ProjectMetadata) {
    this.path = path;
    this.name = metadata.name;
    // Merge loaded config with defaults for backward compatibility
    this.projectConfig = {
      ...this.projectConfig,
      ...metadata.projectConfig,
      variableValues: metadata.projectConfig.variableValues ?? {},
    };
    this.isOpen = true;
    this.isDirty = false;
  }

  markDirty() {
    this.isDirty = true;
  }

  markSaved() {
    this.isDirty = false;
  }

  close() {
    this.path = null;
    this.name = '';
    this.isOpen = false;
    this.isDirty = false;
  }
}

export const project = new ProjectStore();

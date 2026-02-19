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
    resourceGroupName: 'rg-terrastudio',
    resourceGroupAsVariable: true,
    location: 'eastus',
    locationAsVariable: true,
    commonTags: {
      managed_by: 'terrastudio',
    },
  });

  open(path: string, metadata: ProjectMetadata) {
    this.path = path;
    this.name = metadata.name;
    this.projectConfig = metadata.projectConfig;
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

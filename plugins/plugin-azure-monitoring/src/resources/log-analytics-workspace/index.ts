import type { ResourceTypeRegistration } from '@terrastudio/types';
import { logAnalyticsWorkspaceSchema } from './schema.js';
import { logAnalyticsWorkspaceHclGenerator } from './hcl-generator.js';
import { logAnalyticsWorkspaceIcon } from './icon.js';

export const logAnalyticsWorkspaceRegistration: ResourceTypeRegistration = {
  schema: logAnalyticsWorkspaceSchema,
  nodeComponent: null,
  hclGenerator: logAnalyticsWorkspaceHclGenerator,
  icon: logAnalyticsWorkspaceIcon,
};

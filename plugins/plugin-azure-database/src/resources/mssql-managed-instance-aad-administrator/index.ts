import type { ResourceTypeRegistration } from '@terrastudio/types';
import { mssqlManagedInstanceAadAdministratorSchema } from './schema.js';
import { mssqlManagedInstanceAadAdministratorHclGenerator } from './hcl-generator.js';
import { mssqlManagedInstanceAadAdministratorIcon } from './icon.js';

export const mssqlManagedInstanceAadAdministratorRegistration: ResourceTypeRegistration = {
  schema: mssqlManagedInstanceAadAdministratorSchema,
  nodeComponent: null,
  hclGenerator: mssqlManagedInstanceAadAdministratorHclGenerator,
  icon: mssqlManagedInstanceAadAdministratorIcon,
};

import type { ResourceTypeRegistration } from '@terrastudio/types';
import { staticWebAppSchema } from './schema.js';
import { staticWebAppHclGenerator } from './hcl-generator.js';
import { staticWebAppIcon } from './icon.js';

export const staticWebAppRegistration: ResourceTypeRegistration = {
	schema: staticWebAppSchema,
	nodeComponent: null,
	hclGenerator: staticWebAppHclGenerator,
	icon: staticWebAppIcon,
};

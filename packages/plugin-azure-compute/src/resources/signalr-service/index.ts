import type { ResourceTypeRegistration } from '@terrastudio/types';
import { signalrServiceSchema } from './schema.js';
import { signalrServiceHclGenerator } from './hcl-generator.js';
import { signalrServiceIcon } from './icon.js';

export const signalrServiceRegistration: ResourceTypeRegistration = {
	schema: signalrServiceSchema,
	nodeComponent: null,
	hclGenerator: signalrServiceHclGenerator,
	icon: signalrServiceIcon,
};

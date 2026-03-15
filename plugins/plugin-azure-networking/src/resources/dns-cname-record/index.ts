import type { ResourceTypeRegistration } from '@terrastudio/types';
import { dnsCnameRecordSchema } from './schema.js';
import { dnsCnameRecordHclGenerator } from './hcl-generator.js';
import { dnsCnameRecordIcon } from './icon.js';

export const dnsCnameRecordRegistration: ResourceTypeRegistration = {
	schema: dnsCnameRecordSchema,
	nodeComponent: null,
	hclGenerator: dnsCnameRecordHclGenerator,
	icon: dnsCnameRecordIcon,
};

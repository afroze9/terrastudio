import type { ResourceTypeRegistration } from '@terrastudio/types';
import { dynamodbTableSchema } from './schema.js';
import { dynamodbTableHclGenerator } from './hcl-generator.js';
import { dynamodbTableIcon } from './icon.js';

export const dynamodbTableRegistration: ResourceTypeRegistration = {
  schema: dynamodbTableSchema,
  nodeComponent: null,
  hclGenerator: dynamodbTableHclGenerator,
  icon: dynamodbTableIcon,
};

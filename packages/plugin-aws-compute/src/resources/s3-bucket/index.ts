import type { ResourceTypeRegistration } from '@terrastudio/types';
import { s3BucketSchema } from './schema.js';
import { s3BucketHclGenerator } from './hcl-generator.js';
import { s3BucketIcon } from './icon.js';

export const s3BucketRegistration: ResourceTypeRegistration = {
  schema: s3BucketSchema,
  nodeComponent: null,
  hclGenerator: s3BucketHclGenerator,
  icon: s3BucketIcon,
};

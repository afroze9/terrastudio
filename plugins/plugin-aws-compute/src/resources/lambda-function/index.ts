import type { ResourceTypeRegistration } from '@terrastudio/types';
import { lambdaFunctionSchema } from './schema.js';
import { lambdaFunctionHclGenerator } from './hcl-generator.js';
import { lambdaFunctionIcon } from './icon.js';

export const lambdaFunctionRegistration: ResourceTypeRegistration = {
  schema: lambdaFunctionSchema,
  nodeComponent: null,
  hclGenerator: lambdaFunctionHclGenerator,
  icon: lambdaFunctionIcon,
};

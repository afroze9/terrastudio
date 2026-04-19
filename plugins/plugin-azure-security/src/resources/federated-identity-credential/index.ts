import type { ResourceTypeRegistration } from '@terrastudio/types';
import { federatedIdentityCredentialSchema } from './schema.js';
import { federatedIdentityCredentialHclGenerator } from './hcl-generator.js';
import { federatedIdentityCredentialIcon } from './icon.js';

export const federatedIdentityCredentialRegistration: ResourceTypeRegistration = {
  schema: federatedIdentityCredentialSchema,
  nodeComponent: null,
  hclGenerator: federatedIdentityCredentialHclGenerator,
  icon: federatedIdentityCredentialIcon,
};

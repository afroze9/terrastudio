import type { ResourceSchema } from '@terrastudio/types';

export const keyVaultSchema: ResourceSchema = {
  typeId: 'azurerm/security/key_vault',
  provider: 'azurerm',
  displayName: 'Key Vault',
  category: 'security',
  description: 'Azure Key Vault for managing secrets, keys, and certificates',
  terraformType: 'azurerm_key_vault',
  supportsTags: true,
  requiresResourceGroup: true,
  canBeChildOf: [
    'azurerm/core/resource_group',
  ],

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'kv-myapp-dev',
      group: 'General',
      order: 1,
      validation: {
        minLength: 3,
        maxLength: 24,
        pattern: '^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$',
        patternMessage: 'Must start with a letter, end with alphanumeric, and contain only letters, numbers, and hyphens',
      },
    },
    {
      key: 'sku_name',
      label: 'SKU',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Premium (HSM-backed keys)', value: 'premium' },
      ],
    },
    {
      key: 'soft_delete_retention_days',
      label: 'Soft Delete Retention (days)',
      type: 'number',
      required: false,
      group: 'Protection',
      order: 3,
      defaultValue: 90,
      validation: { min: 7, max: 90 },
    },
    {
      key: 'purge_protection_enabled',
      label: 'Purge Protection',
      type: 'boolean',
      required: false,
      group: 'Protection',
      order: 4,
      defaultValue: false,
      description: 'Once enabled, cannot be disabled',
    },
    {
      key: 'enabled_for_deployment',
      label: 'Enable for VM Deployment',
      type: 'boolean',
      required: false,
      group: 'Access',
      order: 5,
      defaultValue: false,
    },
    {
      key: 'enabled_for_disk_encryption',
      label: 'Enable for Disk Encryption',
      type: 'boolean',
      required: false,
      group: 'Access',
      order: 6,
      defaultValue: false,
    },
    {
      key: 'enabled_for_template_deployment',
      label: 'Enable for Template Deployment',
      type: 'boolean',
      required: false,
      group: 'Access',
      order: 7,
      defaultValue: false,
    },
  ],

  handles: [
    {
      id: 'secret-in',
      type: 'target',
      position: 'left',
      label: 'Secret',
      acceptsOutputs: true,
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
    { key: 'vault_uri', label: 'Vault URI', terraformAttribute: 'vault_uri' },
  ],
};

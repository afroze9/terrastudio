import type { ResourceSchema } from '@terrastudio/types';

export const kubernetesClusterNodePoolSchema: ResourceSchema = {
  typeId: 'azurerm/containers/kubernetes_cluster_node_pool',
  provider: 'azurerm',
  displayName: 'Node Pool',
  category: 'containers',
  description: 'Additional node pool for an AKS cluster',
  terraformType: 'azurerm_kubernetes_cluster_node_pool',
  supportsTags: true,
  requiresResourceGroup: false,
  cafAbbreviation: 'np',
  namingConstraints: { maxLength: 12 },

  canBeChildOf: [
    'azurerm/containers/kubernetes_cluster',
  ],
  parentReference: { propertyKey: 'kubernetes_cluster_id' },

  properties: [
    {
      key: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      placeholder: 'gpu',
      group: 'General',
      order: 1,
      validation: {
        minLength: 1,
        maxLength: 12,
        pattern: '^[a-z][a-z0-9]*$',
        patternMessage: 'Lowercase alphanumeric, must start with a letter, max 12 characters',
      },
    },
    {
      key: 'vm_size',
      label: 'VM Size',
      type: 'select',
      required: true,
      group: 'General',
      order: 2,
      defaultValue: 'Standard_B2s',
      options: [
        { label: 'Standard_B2s (2 vCPU, 4 GB)', value: 'Standard_B2s' },
        { label: 'Standard_B4ms (4 vCPU, 16 GB)', value: 'Standard_B4ms' },
        { label: 'Standard_DS2_v2 (2 vCPU, 7 GB)', value: 'Standard_DS2_v2' },
        { label: 'Standard_DS3_v2 (4 vCPU, 14 GB)', value: 'Standard_DS3_v2' },
        { label: 'Standard_D4s_v3 (4 vCPU, 16 GB)', value: 'Standard_D4s_v3' },
        { label: 'Standard_D8s_v3 (8 vCPU, 32 GB)', value: 'Standard_D8s_v3' },
        { label: 'Standard_E4s_v3 (4 vCPU, 32 GB)', value: 'Standard_E4s_v3' },
      ],
    },

    // Scaling
    {
      key: 'node_count',
      label: 'Node Count',
      type: 'number',
      required: false,
      group: 'Scaling',
      order: 10,
      defaultValue: 1,
      validation: { min: 0, max: 100 },
    },
    {
      key: 'auto_scaling_enabled',
      label: 'Auto Scaling',
      type: 'boolean',
      required: false,
      group: 'Scaling',
      order: 11,
      defaultValue: false,
    },
    {
      key: 'min_count',
      label: 'Min Nodes',
      type: 'number',
      required: false,
      group: 'Scaling',
      order: 12,
      defaultValue: 1,
      validation: { min: 0, max: 100 },
      visibleWhen: { field: 'auto_scaling_enabled', operator: 'truthy' },
    },
    {
      key: 'max_count',
      label: 'Max Nodes',
      type: 'number',
      required: false,
      group: 'Scaling',
      order: 13,
      defaultValue: 3,
      validation: { min: 1, max: 100 },
      visibleWhen: { field: 'auto_scaling_enabled', operator: 'truthy' },
    },

    // Configuration
    {
      key: 'os_type',
      label: 'OS Type',
      type: 'select',
      required: false,
      group: 'Configuration',
      order: 20,
      defaultValue: 'Linux',
      options: [
        { label: 'Linux', value: 'Linux' },
        { label: 'Windows', value: 'Windows' },
      ],
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      required: false,
      group: 'Configuration',
      order: 21,
      defaultValue: 'User',
      description: 'System pools run critical cluster pods; User pools run your workloads',
      options: [
        { label: 'System', value: 'System' },
        { label: 'User', value: 'User' },
      ],
    },
  ],

  handles: [
    {
      id: 'subnet-in',
      type: 'target',
      position: 'left',
      label: 'Subnet',
    },
  ],

  outputs: [
    { key: 'id', label: 'Resource ID', terraformAttribute: 'id' },
  ],

  costEstimation: {
    serviceName: 'Azure Kubernetes Service',
    skuProperty: 'vm_size',
  },
};

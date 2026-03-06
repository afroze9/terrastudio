import type { ResourceSchema } from '@terrastudio/types';

export const eksClusterSchema: ResourceSchema = {
  typeId: 'aws/containers/eks_cluster',
  provider: 'aws',
  displayName: 'EKS Cluster',
  category: 'aws-containers',
  description: 'Amazon Elastic Kubernetes Service — managed Kubernetes control plane',
  terraformType: 'aws_eks_cluster',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Cluster Name',
      type: 'string',
      required: true,
      placeholder: 'my-eks-cluster',
      group: 'General',
      order: 1,
    },
    {
      key: 'kubernetes_version',
      label: 'Kubernetes Version',
      type: 'select',
      required: false,
      defaultValue: '1.29',
      options: [
        { label: '1.29', value: '1.29' },
        { label: '1.28', value: '1.28' },
        { label: '1.27', value: '1.27' },
      ],
      group: 'General',
      order: 2,
    },
    {
      key: 'endpoint_private_access',
      label: 'Private Endpoint',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'Network',
      order: 3,
      description: 'Enable private API server endpoint',
    },
    {
      key: 'endpoint_public_access',
      label: 'Public Endpoint',
      type: 'boolean',
      required: false,
      defaultValue: true,
      group: 'Network',
      order: 4,
      description: 'Enable public API server endpoint',
    },
  ],

  handles: [
    { id: 'eks-role', type: 'target', position: 'left', label: 'IAM Role' },
    { id: 'eks-out', type: 'source', position: 'right', label: 'Workloads' },
  ],

  outputs: [
    { key: 'id', label: 'Cluster ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'endpoint', label: 'Endpoint', terraformAttribute: 'endpoint' },
    { key: 'cluster_security_group_id', label: 'Cluster Security Group ID', terraformAttribute: 'vpc_config[0].cluster_security_group_id' },
  ],

  costEstimation: {
    serviceName: 'EKS',
    staticMonthlyCost: 73,
  },
};

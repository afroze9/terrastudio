import type { ResourceSchema } from '@terrastudio/types';

export const ecsClusterSchema: ResourceSchema = {
  typeId: 'aws/containers/ecs_cluster',
  provider: 'aws',
  displayName: 'ECS Cluster',
  category: 'aws-containers',
  description: 'Amazon Elastic Container Service — managed container orchestration',
  terraformType: 'aws_ecs_cluster',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Cluster Name',
      type: 'string',
      required: true,
      placeholder: 'my-ecs-cluster',
      group: 'General',
      order: 1,
    },
    {
      key: 'container_insights',
      label: 'Container Insights',
      type: 'boolean',
      required: false,
      defaultValue: true,
      group: 'Monitoring',
      order: 2,
      description: 'Enable CloudWatch Container Insights for monitoring',
    },
    {
      key: 'capacity_provider',
      label: 'Default Capacity Provider',
      type: 'select',
      required: false,
      defaultValue: 'FARGATE',
      options: [
        { label: 'Fargate', value: 'FARGATE' },
        { label: 'Fargate Spot', value: 'FARGATE_SPOT' },
      ],
      group: 'Capacity',
      order: 3,
      description: 'Default launch type for tasks',
    },
  ],

  handles: [
    { id: 'ecs-in', type: 'target', position: 'left', label: 'Services' },
    { id: 'ecs-out', type: 'source', position: 'right', label: 'Workloads' },
  ],

  outputs: [
    { key: 'id', label: 'Cluster ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
  ],

  costEstimation: {
    serviceName: 'ECS',
    usageInputs: [
      {
        key: '_cost_vcpu_hours',
        label: 'Monthly vCPU Hours',
        unit: 'vCPU-hours',
        defaultValue: 730,
        min: 0,
        max: 100000,
        description: 'Fargate: $0.04048/vCPU/hour. 730 hours ≈ 1 vCPU running 24/7.',
      },
      {
        key: '_cost_memory_gb_hours',
        label: 'Monthly Memory GB-Hours',
        unit: 'GB-hours',
        defaultValue: 1460,
        min: 0,
        max: 500000,
        description: 'Fargate: $0.004445/GB/hour. 1460 ≈ 2 GB running 24/7.',
      },
    ],
  },
};

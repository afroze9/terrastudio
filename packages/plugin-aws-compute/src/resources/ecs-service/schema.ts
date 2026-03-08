import type { ResourceSchema } from '@terrastudio/types';

export const ecsServiceSchema: ResourceSchema = {
  typeId: 'aws/containers/ecs_service',
  provider: 'aws',
  displayName: 'ECS Service',
  category: 'aws-containers',
  description: 'ECS Service — runs and maintains desired count of tasks',
  terraformType: 'aws_ecs_service',
  supportsTags: true,
  requiresResourceGroup: false,
  canBeChildOf: ['aws/containers/ecs_cluster'],
  parentReference: { propertyKey: 'cluster' },

  properties: [
    {
      key: 'name',
      label: 'Service Name',
      type: 'string',
      required: true,
      placeholder: 'my-service',
      group: 'General',
      order: 1,
    },
    {
      key: 'desired_count',
      label: 'Desired Count',
      type: 'number',
      required: true,
      defaultValue: 1,
      group: 'General',
      order: 2,
      validation: { min: 0, max: 5000 },
      description: 'Number of task instances to keep running',
    },
    {
      key: 'launch_type',
      label: 'Launch Type',
      type: 'select',
      required: false,
      defaultValue: 'FARGATE',
      options: [
        { label: 'Fargate', value: 'FARGATE' },
        { label: 'EC2', value: 'EC2' },
      ],
      group: 'General',
      order: 3,
    },
    {
      key: 'assign_public_ip',
      label: 'Assign Public IP',
      type: 'boolean',
      required: false,
      defaultValue: false,
      group: 'Network',
      order: 4,
      description: 'Assign a public IP address to the task ENI (Fargate only)',
    },
    {
      key: 'health_check_grace_period',
      label: 'Health Check Grace Period (s)',
      type: 'number',
      required: false,
      defaultValue: 60,
      group: 'Health',
      order: 5,
      validation: { min: 0, max: 7200 },
      description: 'Seconds to wait before checking health of new tasks',
    },
  ],

  handles: [
    { id: 'service-taskdef', type: 'target', position: 'left', label: 'Task Definition' },
    { id: 'service-out', type: 'source', position: 'right', label: 'Service' },
  ],

  outputs: [
    { key: 'id', label: 'Service ID', terraformAttribute: 'id' },
    { key: 'name', label: 'Service Name', terraformAttribute: 'name' },
  ],

  costEstimation: {
    serviceName: 'Amazon ECS',
    staticMonthlyCost: 0,
  },
};

import type { ResourceSchema } from '@terrastudio/types';

export const elasticacheSchema: ResourceSchema = {
  typeId: 'aws/database/elasticache',
  provider: 'aws',
  displayName: 'ElastiCache Cluster',
  category: 'aws-database',
  description: 'Amazon ElastiCache — managed Redis or Memcached',
  terraformType: 'aws_elasticache_cluster',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'cluster_id',
      label: 'Cluster ID',
      type: 'string',
      required: true,
      placeholder: 'my-cache',
      group: 'General',
      order: 1,
    },
    {
      key: 'engine',
      label: 'Engine',
      type: 'select',
      required: true,
      defaultValue: 'redis',
      options: [
        { label: 'Redis', value: 'redis' },
        { label: 'Memcached', value: 'memcached' },
      ],
      group: 'General',
      order: 2,
    },
    {
      key: 'node_type',
      label: 'Node Type',
      type: 'select',
      required: true,
      defaultValue: 'cache.t3.micro',
      options: [
        { label: 'cache.t3.micro (0.5 GB)', value: 'cache.t3.micro' },
        { label: 'cache.t3.small (1.37 GB)', value: 'cache.t3.small' },
        { label: 'cache.t3.medium (3.09 GB)', value: 'cache.t3.medium' },
        { label: 'cache.m6g.large (6.38 GB)', value: 'cache.m6g.large' },
        { label: 'cache.m6g.xlarge (12.93 GB)', value: 'cache.m6g.xlarge' },
        { label: 'cache.r6g.large (13.07 GB)', value: 'cache.r6g.large' },
        { label: 'cache.r6g.xlarge (26.32 GB)', value: 'cache.r6g.xlarge' },
      ],
      group: 'General',
      order: 3,
    },
    {
      key: 'num_cache_nodes',
      label: 'Number of Nodes',
      type: 'number',
      required: false,
      defaultValue: 1,
      group: 'General',
      order: 4,
      validation: { min: 1, max: 40 },
      description: 'For Redis, must be 1. For Memcached, 1-40.',
    },
    {
      key: 'engine_version',
      label: 'Engine Version',
      type: 'string',
      required: false,
      placeholder: '7.0',
      group: 'General',
      order: 5,
    },
    {
      key: 'port',
      label: 'Port',
      type: 'number',
      required: false,
      defaultValue: 6379,
      group: 'Network',
      order: 6,
    },
  ],

  handles: [
    { id: 'cache-in', type: 'target', position: 'left', label: 'Client' },
  ],

  outputs: [
    { key: 'id', label: 'Cluster ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'cache_nodes', label: 'Cache Nodes', terraformAttribute: 'cache_nodes' },
    { key: 'configuration_endpoint', label: 'Configuration Endpoint', terraformAttribute: 'configuration_endpoint' },
  ],

  costEstimation: {
    serviceName: 'ElastiCache',
    skuProperty: 'node_type',
  },
};

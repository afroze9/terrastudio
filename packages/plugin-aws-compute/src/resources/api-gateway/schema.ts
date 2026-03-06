import type { ResourceSchema } from '@terrastudio/types';

export const apiGatewaySchema: ResourceSchema = {
  typeId: 'aws/compute/api_gateway',
  provider: 'aws',
  displayName: 'API Gateway',
  category: 'aws-compute',
  description: 'AWS API Gateway HTTP or REST API',
  terraformType: 'aws_apigatewayv2_api',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'API Name',
      type: 'string',
      required: true,
      placeholder: 'my-api',
      group: 'General',
      order: 1,
    },
    {
      key: 'protocol_type',
      label: 'Protocol',
      type: 'select',
      required: true,
      defaultValue: 'HTTP',
      group: 'General',
      order: 2,
      options: [
        { label: 'HTTP', value: 'HTTP' },
        { label: 'WebSocket', value: 'WEBSOCKET' },
      ],
    },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      placeholder: 'API for my application',
      group: 'General',
      order: 3,
    },
    {
      key: 'cors_enabled',
      label: 'Enable CORS',
      type: 'boolean',
      required: false,
      defaultValue: true,
      group: 'Settings',
      order: 4,
    },
    {
      key: 'cors_allow_origins',
      label: 'CORS Allow Origins',
      type: 'array',
      required: false,
      defaultValue: ['*'],
      group: 'Settings',
      order: 5,
      visibleWhen: { field: 'cors_enabled', operator: 'truthy' },
      itemSchema: {
        key: 'origin',
        label: 'Origin',
        type: 'string',
        required: true,
        placeholder: 'https://example.com',
      },
    },
  ],

  handles: [
    { id: 'apigw-out', type: 'source', position: 'right', label: 'API Gateway', },
  ],

  outputs: [
    { key: 'id', label: 'API ID', terraformAttribute: 'id' },
    { key: 'api_endpoint', label: 'API Endpoint', terraformAttribute: 'api_endpoint' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'execution_arn', label: 'Execution ARN', terraformAttribute: 'execution_arn' },
  ],

  costEstimation: {
    serviceName: 'API Gateway',
    usageInputs: [
      {
        key: '_cost_requests_millions',
        label: 'Monthly Requests',
        unit: 'million',
        defaultValue: 1,
        min: 0,
        max: 100000,
        description: 'HTTP API: ~$1.00/million. REST API: ~$3.50/million.',
      },
    ],
  },
};

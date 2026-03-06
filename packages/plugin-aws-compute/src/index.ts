import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { securityGroupRegistration } from './resources/security-group/index.js';
import { ec2InstanceRegistration } from './resources/ec2-instance/index.js';
import { eipRegistration } from './resources/eip/index.js';
import { albRegistration } from './resources/alb/index.js';
import { rdsInstanceRegistration } from './resources/rds-instance/index.js';
import { s3BucketRegistration } from './resources/s3-bucket/index.js';
import { iamRoleRegistration } from './resources/iam-role/index.js';
import { cloudwatchLogGroupRegistration } from './resources/cloudwatch-log-group/index.js';
import { lambdaFunctionRegistration } from './resources/lambda-function/index.js';
import { apiGatewayRegistration } from './resources/api-gateway/index.js';
import { dynamodbTableRegistration } from './resources/dynamodb-table/index.js';
import { sqsQueueRegistration } from './resources/sqs-queue/index.js';
import { snsTopicRegistration } from './resources/sns-topic/index.js';
import { secretsManagerRegistration } from './resources/secrets-manager/index.js';
import { ecrRegistration } from './resources/ecr/index.js';
import { efsRegistration } from './resources/efs/index.js';
import { elasticacheRegistration } from './resources/elasticache/index.js';
import { eksClusterRegistration } from './resources/eks-cluster/index.js';
import { ecsClusterRegistration } from './resources/ecs-cluster/index.js';
import { computeConnectionRules } from './connections/rules.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['aws/compute/security_group', securityGroupRegistration],
  ['aws/compute/instance', ec2InstanceRegistration],
  ['aws/compute/eip', eipRegistration],
  ['aws/compute/alb', albRegistration],
  ['aws/compute/rds_instance', rdsInstanceRegistration],
  ['aws/storage/s3_bucket', s3BucketRegistration],
  ['aws/security/iam_role', iamRoleRegistration],
  ['aws/monitoring/cloudwatch_log_group', cloudwatchLogGroupRegistration],
  ['aws/compute/lambda_function', lambdaFunctionRegistration],
  ['aws/compute/api_gateway', apiGatewayRegistration],
  ['aws/database/dynamodb_table', dynamodbTableRegistration],
  ['aws/messaging/sqs_queue', sqsQueueRegistration],
  ['aws/messaging/sns_topic', snsTopicRegistration],
  ['aws/security/secrets_manager', secretsManagerRegistration],
  ['aws/containers/ecr', ecrRegistration],
  ['aws/storage/efs', efsRegistration],
  ['aws/database/elasticache', elasticacheRegistration],
  ['aws/containers/eks_cluster', eksClusterRegistration],
  ['aws/containers/ecs_cluster', ecsClusterRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-aws-compute',
  name: 'AWS Compute',
  version: '0.1.0',
  providerId: 'aws',

  resourceTypes,
  connectionRules: computeConnectionRules,

  paletteCategories: [
    {
      id: 'aws-compute',
      label: 'Compute',
      order: 120,
    },
    {
      id: 'aws-security',
      label: 'Security',
      order: 130,
    },
    {
      id: 'aws-loadbalancing',
      label: 'Load Balancing',
      order: 125,
    },
    {
      id: 'aws-database',
      label: 'Database',
      order: 140,
    },
    {
      id: 'aws-storage',
      label: 'Storage',
      order: 135,
    },
    {
      id: 'aws-monitoring',
      label: 'Monitoring',
      order: 145,
    },
    {
      id: 'aws-messaging',
      label: 'Messaging',
      order: 150,
    },
    {
      id: 'aws-containers',
      label: 'Containers',
      order: 155,
    },
  ],
};

export default plugin;

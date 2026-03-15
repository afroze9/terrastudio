import type { ResourceSchema } from '@terrastudio/types';

export const iamRoleSchema: ResourceSchema = {
  typeId: 'aws/security/iam_role',
  provider: 'aws',
  displayName: 'IAM Role',
  category: 'aws-security',
  description: 'AWS IAM Role for granting permissions to AWS services',
  terraformType: 'aws_iam_role',
  supportsTags: true,
  requiresResourceGroup: false,

  properties: [
    {
      key: 'name',
      label: 'Role Name',
      type: 'string',
      required: true,
      placeholder: 'lambda-execution-role',
      group: 'General',
      order: 1,
      validation: { maxLength: 64 },
    },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      placeholder: 'Role for Lambda function execution',
      group: 'General',
      order: 2,
    },
    {
      key: 'assume_role_service',
      label: 'Trusted Service',
      type: 'select',
      required: true,
      defaultValue: 'lambda.amazonaws.com',
      group: 'Trust Policy',
      order: 3,
      description: 'AWS service that can assume this role',
      options: [
        { label: 'Lambda', value: 'lambda.amazonaws.com' },
        { label: 'EC2', value: 'ec2.amazonaws.com' },
        { label: 'ECS Tasks', value: 'ecs-tasks.amazonaws.com' },
        { label: 'API Gateway', value: 'apigateway.amazonaws.com' },
        { label: 'S3', value: 's3.amazonaws.com' },
        { label: 'SNS', value: 'sns.amazonaws.com' },
        { label: 'SQS', value: 'sqs.amazonaws.com' },
      ],
    },
    {
      key: 'managed_policy_arns',
      label: 'Managed Policy ARNs',
      type: 'array',
      required: false,
      group: 'Policies',
      order: 4,
      description: 'AWS managed or customer policy ARNs to attach',
      itemSchema: {
        key: 'policy_arn',
        label: 'Policy ARN',
        type: 'string',
        required: true,
        placeholder: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      },
    },
  ],

  handles: [
    { id: 'role-out', type: 'source', position: 'right', label: 'IAM Role' },
  ],

  outputs: [
    { key: 'id', label: 'Role ID', terraformAttribute: 'id' },
    { key: 'arn', label: 'ARN', terraformAttribute: 'arn' },
    { key: 'name', label: 'Name', terraformAttribute: 'name' },
  ],

  costEstimation: { serviceName: 'IAM', staticMonthlyCost: 0 },
};

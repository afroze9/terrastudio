import type { Template } from '../types';

export const blankAwsTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'blank-aws',
    name: 'Blank Project (AWS)',
    description: 'Empty canvas with a VPC and Subnet',
    categories: ['Getting Started'],
    icon: 'blank',
    providers: ['aws'],
  },
  diagram: {
    nodes: [
      {
        id: 'template-vpc-1',
        type: 'aws/networking/vpc',
        position: { x: 100, y: 100 },
        data: {
          typeId: 'aws/networking/vpc',
          properties: {
            name: 'main',
            cidr_block: '10.0.0.0/16',
            enable_dns_support: true,
            enable_dns_hostnames: true,
          },
          references: {},
          terraformName: 'vpc_main',
          label: 'VPC',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 800,
        height: 600,
        style: 'width: 800px; height: 600px;',
      },
      {
        id: 'template-subnet-1',
        type: 'aws/networking/subnet',
        position: { x: 50, y: 60 },
        parentId: 'template-vpc-1',
        data: {
          typeId: 'aws/networking/subnet',
          properties: {
            name: 'public-1',
            cidr_block: '10.0.1.0/24',
            availability_zone: 'us-east-1a',
          },
          references: {},
          terraformName: 'subnet_public_1',
          label: 'Subnet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 700,
        height: 500,
        style: 'width: 700px; height: 500px;',
      },
    ],
    edges: [],
  },
};

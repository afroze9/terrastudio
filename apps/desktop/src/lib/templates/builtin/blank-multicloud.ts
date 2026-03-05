import type { Template } from '../types';

export const blankMulticloudTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'blank-multicloud',
    name: 'Blank Project (Multi-Cloud)',
    description: 'Azure Subscription + Resource Group alongside an AWS VPC + Subnet',
    categories: ['Getting Started'],
    icon: 'blank',
    providers: ['azurerm', 'aws'],
  },
  diagram: {
    nodes: [
      // Azure side
      {
        id: 'template-sub-1',
        type: 'azurerm/core/subscription',
        position: { x: 50, y: 100 },
        data: {
          typeId: 'azurerm/core/subscription',
          properties: {},
          references: {},
          terraformName: 'sub_1',
          label: 'Subscription',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 500,
        height: 500,
        style: 'width: 500px; height: 500px;',
      },
      {
        id: 'template-rg-1',
        type: 'azurerm/core/resource_group',
        position: { x: 50, y: 60 },
        parentId: 'template-sub-1',
        data: {
          typeId: 'azurerm/core/resource_group',
          properties: {
            location: 'eastus',
          },
          references: {},
          terraformName: 'rg_1',
          label: 'Resource Group',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 400,
        height: 400,
        style: 'width: 400px; height: 400px;',
      },
      // AWS side
      {
        id: 'template-vpc-1',
        type: 'aws/networking/vpc',
        position: { x: 600, y: 100 },
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
        width: 500,
        height: 500,
        style: 'width: 500px; height: 500px;',
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
        width: 400,
        height: 400,
        style: 'width: 400px; height: 400px;',
      },
    ],
    edges: [],
  },
};

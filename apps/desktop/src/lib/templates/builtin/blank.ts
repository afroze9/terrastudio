import type { Template } from '../types';

export const blankTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty canvas with Subscription and Resource Group',
    categories: ['Getting Started'],
    icon: 'blank',
  },
  diagram: {
    nodes: [
      {
        id: 'template-sub-1',
        type: 'azurerm/core/subscription',
        position: { x: 100, y: 100 },
        data: {
          typeId: 'azurerm/core/subscription',
          properties: {},
          references: {},
          terraformName: 'sub_1',
          label: 'Subscription',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 900,
        height: 700,
        style: 'width: 900px; height: 700px;',
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
        width: 800,
        height: 600,
        style: 'width: 800px; height: 600px;',
      },
    ],
    edges: [],
  },
};

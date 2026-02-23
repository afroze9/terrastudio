import type { Template } from '../types';

export const vmNetworkingTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'vm-networking',
    name: 'VM + Networking',
    description: 'Virtual Machine with VNet, Subnet, NSG, and Public IP',
    categories: ['Compute', 'Networking'],
    icon: 'compute',
  },
  diagram: {
    nodes: [
      {
        id: 'tmpl-sub',
        type: 'azurerm/core/subscription',
        position: { x: 50, y: 50 },
        data: {
          typeId: 'azurerm/core/subscription',
          properties: {},
          references: {},
          terraformName: 'sub_1',
          label: 'Subscription',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 1200,
        height: 850,
        style: 'width: 1200px; height: 850px;',
      },
      {
        id: 'tmpl-rg',
        type: 'azurerm/core/resource_group',
        position: { x: 50, y: 60 },
        parentId: 'tmpl-sub',
        data: {
          typeId: 'azurerm/core/resource_group',
          properties: { location: 'eastus' },
          references: {},
          terraformName: 'rg_1',
          label: 'Resource Group',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 1100,
        height: 750,
        style: 'width: 1100px; height: 750px;',
      },
      // VNet container
      {
        id: 'tmpl-vnet',
        type: 'azurerm/networking/virtual_network',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/virtual_network',
          properties: {
            name: 'main',
            address_space: ['10.0.0.0/16'],
          },
          references: {},
          terraformName: 'vnet_1',
          label: 'Virtual Network',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 550,
        height: 600,
        style: 'width: 550px; height: 600px;',
      },
      // Subnet inside VNet
      {
        id: 'tmpl-subnet',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'default',
            address_prefixes: ['10.0.1.0/24'],
            nsg_enabled: true,
          },
          references: {
            nsg_id: 'tmpl-nsg',
          },
          terraformName: 'snet_1',
          label: 'Default Subnet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 490,
        height: 450,
        style: 'width: 490px; height: 450px;',
      },
      // VM inside Subnet
      {
        id: 'tmpl-vm',
        type: 'azurerm/compute/virtual_machine',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-subnet',
        data: {
          typeId: 'azurerm/compute/virtual_machine',
          properties: {
            name: 'main',
            os_type: 'linux',
            size: 'Standard_B2s',
            admin_username: 'azureuser',
            image_publisher: 'Canonical',
            image_offer: '0001-com-ubuntu-server-jammy',
            image_sku: '22_04-lts',
            os_disk_size_gb: 30,
            os_disk_type: 'Standard_LRS',
            public_ip_enabled: true,
          },
          references: {
            public_ip_id: 'tmpl-pip',
          },
          terraformName: 'vm_1',
          label: 'Virtual Machine',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // NSG in RG
      {
        id: 'tmpl-nsg',
        type: 'azurerm/networking/network_security_group',
        position: { x: 650, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/network_security_group',
          properties: {
            name: 'default',
            security_rules: [],
          },
          references: {},
          terraformName: 'nsg_1',
          label: 'Network Security Group',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // Public IP in RG
      {
        id: 'tmpl-pip',
        type: 'azurerm/networking/public_ip',
        position: { x: 650, y: 250 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/public_ip',
          properties: {
            name: 'vm',
            allocation_method: 'Static',
            sku: 'Standard',
          },
          references: {},
          terraformName: 'pip_1',
          label: 'Public IP',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
    ],
    edges: [],
  },
};

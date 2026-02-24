import type { Template } from '../types';

export const hubSpokeNetworkingTemplate: Template = {
  templateVersion: 1,
  metadata: {
    id: 'hub-spoke-networking',
    name: 'Hub-Spoke Networking',
    description:
      'Hub VNet for shared services with a spoke VNet for workloads, each with dedicated subnets and NSGs',
    categories: ['Networking'],
    icon: 'network',
  },
  diagram: {
    nodes: [
      // Subscription
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
        width: 1380,
        height: 860,
        style: 'width: 1380px; height: 860px;',
      },
      // Resource Group
      {
        id: 'tmpl-rg',
        type: 'azurerm/core/resource_group',
        position: { x: 50, y: 60 },
        parentId: 'tmpl-sub',
        data: {
          typeId: 'azurerm/core/resource_group',
          properties: { location: 'eastus' },
          references: {},
          terraformName: 'rg_networking',
          label: 'Networking RG',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 1280,
        height: 760,
        style: 'width: 1280px; height: 760px;',
      },
      // ── Hub VNet ──────────────────────────────────────────────────────────
      {
        id: 'tmpl-hub-vnet',
        type: 'azurerm/networking/virtual_network',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/virtual_network',
          properties: {
            name: 'hub',
            address_space: ['10.0.0.0/16'],
          },
          references: {},
          terraformName: 'vnet_hub',
          label: 'Hub VNet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 560,
        height: 460,
        style: 'width: 560px; height: 460px;',
      },
      // Hub — Shared Services subnet
      {
        id: 'tmpl-hub-subnet-shared',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-hub-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'SharedServices',
            address_prefixes: ['10.0.1.0/24'],
            nsg_enabled: true,
          },
          references: { nsg_id: 'tmpl-hub-nsg' },
          terraformName: 'snet_hub_shared',
          label: 'Shared Services',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 460,
        height: 160,
        style: 'width: 460px; height: 160px;',
      },
      // Hub — Gateway subnet (no NSG — Azure requirement)
      {
        id: 'tmpl-hub-subnet-gw',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 250 },
        parentId: 'tmpl-hub-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'GatewaySubnet',
            address_prefixes: ['10.0.255.0/27'],
          },
          references: {},
          terraformName: 'snet_hub_gateway',
          label: 'GatewaySubnet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 460,
        height: 140,
        style: 'width: 460px; height: 140px;',
      },
      // Hub NSG (in RG, referenced by hub-subnet-shared)
      {
        id: 'tmpl-hub-nsg',
        type: 'azurerm/networking/network_security_group',
        position: { x: 30, y: 570 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/network_security_group',
          properties: { name: 'hub', security_rules: [] },
          references: {},
          terraformName: 'nsg_hub',
          label: 'Hub NSG',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
      // ── Spoke VNet ────────────────────────────────────────────────────────
      {
        id: 'tmpl-spoke-vnet',
        type: 'azurerm/networking/virtual_network',
        position: { x: 690, y: 60 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/virtual_network',
          properties: {
            name: 'spoke',
            address_space: ['10.1.0.0/16'],
          },
          references: {},
          terraformName: 'vnet_spoke',
          label: 'Spoke VNet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 560,
        height: 460,
        style: 'width: 560px; height: 460px;',
      },
      // Spoke — Workload subnet
      {
        id: 'tmpl-spoke-subnet-app',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 60 },
        parentId: 'tmpl-spoke-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'app',
            address_prefixes: ['10.1.1.0/24'],
            nsg_enabled: true,
          },
          references: { nsg_id: 'tmpl-spoke-nsg' },
          terraformName: 'snet_spoke_app',
          label: 'App Subnet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 460,
        height: 160,
        style: 'width: 460px; height: 160px;',
      },
      // Spoke — Data subnet
      {
        id: 'tmpl-spoke-subnet-data',
        type: 'azurerm/networking/subnet',
        position: { x: 30, y: 250 },
        parentId: 'tmpl-spoke-vnet',
        data: {
          typeId: 'azurerm/networking/subnet',
          properties: {
            name: 'data',
            address_prefixes: ['10.1.2.0/24'],
            nsg_enabled: true,
          },
          references: { nsg_id: 'tmpl-spoke-nsg' },
          terraformName: 'snet_spoke_data',
          label: 'Data Subnet',
          validationErrors: [],
          enabledOutputs: [],
        },
        width: 460,
        height: 140,
        style: 'width: 460px; height: 140px;',
      },
      // Spoke NSG (in RG)
      {
        id: 'tmpl-spoke-nsg',
        type: 'azurerm/networking/network_security_group',
        position: { x: 690, y: 570 },
        parentId: 'tmpl-rg',
        data: {
          typeId: 'azurerm/networking/network_security_group',
          properties: { name: 'spoke', security_rules: [] },
          references: {},
          terraformName: 'nsg_spoke',
          label: 'Spoke NSG',
          validationErrors: [],
          enabledOutputs: [],
        },
      },
    ],
    edges: [],
  },
};

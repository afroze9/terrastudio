import type { ResourceTypeId } from '@terrastudio/types';
import type { fetchMonthlyPrice } from '$lib/services/pricing-service';
import {
  vmCostCalculator,
  appServicePlanCostCalculator,
  containerRegistryCostCalculator,
} from './calculators/azure-compute';
import { storageAccountCostCalculator } from './calculators/azure-storage';
import {
  mssqlDatabaseCostCalculator,
  cosmosDbCostCalculator,
  postgresqlCostCalculator,
  keyVaultCostCalculator,
  redisCacheCostCalculator,
} from './calculators/azure-database';
import {
  logAnalyticsCostCalculator,
  applicationInsightsCostCalculator,
  serviceBusNamespaceCostCalculator,
  bastionCostCalculator,
  publicIpCostCalculator,
  natGatewayCostCalculator,
  functionAppCostCalculator,
} from './calculators/azure-monitoring';

export interface CostResult {
  monthly: number | null;
  breakdown?: { label: string; cost: number }[];
}

export type CostCalculator = (
  properties: Record<string, unknown>,
  region: string,
  fetchPrice?: typeof fetchMonthlyPrice
) => Promise<CostResult>;

const calculators = new Map<ResourceTypeId, CostCalculator>([
  // Compute
  ['azurerm/compute/virtual_machine', vmCostCalculator],
  ['azurerm/compute/app_service_plan', appServicePlanCostCalculator],
  ['azurerm/compute/function_app', functionAppCostCalculator],
  ['azurerm/containers/container_registry', containerRegistryCostCalculator],

  // Storage
  ['azurerm/storage/storage_account', storageAccountCostCalculator],

  // Database
  ['azurerm/database/mssql_database', mssqlDatabaseCostCalculator],
  ['azurerm/database/cosmosdb_account', cosmosDbCostCalculator],
  ['azurerm/database/postgresql_flexible_server', postgresqlCostCalculator],
  ['azurerm/database/redis_cache', redisCacheCostCalculator],

  // Security
  ['azurerm/security/key_vault', keyVaultCostCalculator],

  // Monitoring
  ['azurerm/monitoring/log_analytics_workspace', logAnalyticsCostCalculator],
  ['azurerm/monitoring/application_insights', applicationInsightsCostCalculator],

  // Messaging
  ['azurerm/messaging/servicebus_namespace', serviceBusNamespaceCostCalculator],

  // Networking — priced resources
  ['azurerm/networking/bastion_host', bastionCostCalculator],
  ['azurerm/networking/public_ip', publicIpCostCalculator],
  ['azurerm/networking/nat_gateway', natGatewayCostCalculator],
]);

/**
 * Resources that are always free ($0).
 * App Service and child storage resources are billed via their parent (ASP / Storage Account),
 * so they show $0 here to avoid double-counting.
 */
const FREE_TYPE_IDS = new Set<ResourceTypeId>([
  // Core
  'azurerm/core/resource_group',
  'azurerm/core/subscription',

  // Networking — free services
  'azurerm/networking/virtual_network',
  'azurerm/networking/subnet',
  'azurerm/networking/network_security_group',
  'azurerm/networking/route_table',
  'azurerm/networking/route',
  'azurerm/networking/private_endpoint',        // billed per hour ~$7/mo — free tier exists; mark $0 for simplicity
  'azurerm/networking/private_dns_zone',        // $0.50/zone/mo — near-free, show Free
  'azurerm/networking/private_dns_zone_vnet_link',
  'azurerm/networking/vnet_integration',        // App Service VNet Integration — no standalone cost

  // Storage children — billed via Storage Account
  'azurerm/storage/blob_container',
  'azurerm/storage/file_share',
  'azurerm/storage/queue',
  'azurerm/storage/table',

  // Database children / logical resources
  'azurerm/database/mssql_server',              // logical server — no cost; DB is billed separately
  'azurerm/database/cosmosdb_sql_database',     // billed via CosmosDB account
  'azurerm/database/postgresql_flexible_server_database',

  // Compute children — billed via App Service Plan
  'azurerm/compute/app_service',

  // Messaging children — billed via namespace
  'azurerm/messaging/servicebus_queue',
  'azurerm/messaging/servicebus_topic',

  // Identity — no direct cost
  'azurerm/identity/role_assignment',
  'azurerm/identity/user_assigned_identity',
]);

export async function calculateNodeCost(
  typeId: ResourceTypeId,
  properties: Record<string, unknown>,
  region: string
): Promise<CostResult> {
  if (FREE_TYPE_IDS.has(typeId)) {
    return { monthly: 0, breakdown: [{ label: 'Free / included in parent', cost: 0 }] };
  }

  const calculator = calculators.get(typeId);
  if (!calculator) {
    return { monthly: null, breakdown: [] };
  }

  try {
    return await calculator(properties, region);
  } catch {
    return { monthly: null, breakdown: [] };
  }
}

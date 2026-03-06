import type { CostCalculator } from '../index';

// S3: ~$0.023/GB/month (Standard), ~$0.0125/GB (Infrequent Access)
const S3_RATE_PER_GB = 0.023;
const S3_BASE_OPERATIONS = 1.0; // ~$1/mo for PUT/GET/LIST operations baseline

export const s3BucketCostCalculator: CostCalculator = async (properties) => {
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : 100;

  const storageCost = Math.round(storageGb * S3_RATE_PER_GB * 100) / 100;
  const monthly = storageCost + S3_BASE_OPERATIONS;

  return {
    monthly,
    breakdown: [
      { label: `Storage (${storageGb} GB × $${S3_RATE_PER_GB}/GB)`, cost: storageCost },
      { label: 'Operations estimate', cost: S3_BASE_OPERATIONS },
    ],
  };
};

// CloudWatch Logs: ~$0.50/GB ingestion + $0.03/GB/month storage
const CW_INGESTION_RATE = 0.50;
const CW_STORAGE_RATE = 0.03;

export const cloudwatchLogGroupCostCalculator: CostCalculator = async (properties) => {
  const ingestionGb = typeof properties._cost_ingestion_gb === 'number' ? properties._cost_ingestion_gb : 5;
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : 10;

  const ingestionCost = Math.round(ingestionGb * CW_INGESTION_RATE * 100) / 100;
  const storageCost = Math.round(storageGb * CW_STORAGE_RATE * 100) / 100;
  const monthly = ingestionCost + storageCost;

  return {
    monthly,
    breakdown: [
      { label: `Ingestion (${ingestionGb} GB × $${CW_INGESTION_RATE}/GB)`, cost: ingestionCost },
      { label: `Storage (${storageGb} GB × $${CW_STORAGE_RATE}/GB)`, cost: storageCost },
    ],
  };
};

// Lambda: $0.20/million requests + $0.0000166667/GB-second
const LAMBDA_REQUEST_RATE = 0.20; // per million
const LAMBDA_GBSEC_RATE = 0.0000166667;

export const lambdaFunctionCostCalculator: CostCalculator = async (properties) => {
  const requestsMillions = typeof properties._cost_requests_millions === 'number' ? properties._cost_requests_millions : 1;
  const durationMs = typeof properties._cost_duration_ms === 'number' ? properties._cost_duration_ms : 200;
  const memoryMb = Number(properties.memory_size ?? 128);

  const requestCost = Math.round(requestsMillions * LAMBDA_REQUEST_RATE * 100) / 100;
  // GB-seconds = (memoryMB / 1024) × (durationMs / 1000) × requestCount
  const gbSeconds = (memoryMb / 1024) * (durationMs / 1000) * requestsMillions * 1_000_000;
  const computeCost = Math.round(gbSeconds * LAMBDA_GBSEC_RATE * 100) / 100;
  const monthly = requestCost + computeCost;

  return {
    monthly,
    breakdown: [
      { label: `Requests (${requestsMillions}M × $${LAMBDA_REQUEST_RATE}/M)`, cost: requestCost },
      { label: `Compute (${memoryMb} MB × ${durationMs} ms)`, cost: computeCost },
    ],
  };
};

// API Gateway HTTP API: ~$1.00/million requests
// REST API: ~$3.50/million
const APIGW_HTTP_RATE = 1.0;

export const apiGatewayCostCalculator: CostCalculator = async (properties) => {
  const requestsMillions = typeof properties._cost_requests_millions === 'number' ? properties._cost_requests_millions : 1;
  const protocol = (properties.protocol_type as string | undefined) ?? 'HTTP';

  const rate = protocol === 'WEBSOCKET' ? 1.0 : APIGW_HTTP_RATE;
  const monthly = Math.round(requestsMillions * rate * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `${protocol} API (${requestsMillions}M requests × $${rate}/M)`, cost: monthly },
    ],
  };
};

// DynamoDB On-Demand: $1.25/million WRU, $0.25/million RRU, $0.25/GB storage
// Provisioned: $0.00065/WCU/hr (~$0.47/WCU/mo), $0.00013/RCU/hr (~$0.09/RCU/mo)
const DYNAMO_STORAGE_RATE = 0.25;
const DYNAMO_ONDEMAND_WRU_RATE = 1.25; // per million
const DYNAMO_ONDEMAND_RRU_RATE = 0.25; // per million
const DYNAMO_PROVISIONED_WCU_RATE = 0.47; // per WCU/month
const DYNAMO_PROVISIONED_RCU_RATE = 0.09; // per RCU/month

export const dynamodbTableCostCalculator: CostCalculator = async (properties) => {
  const billingMode = (properties.billing_mode as string | undefined) ?? 'PAY_PER_REQUEST';
  const storageGb = typeof properties._cost_storage_gb === 'number' ? properties._cost_storage_gb : 1;

  const storageCost = Math.round(storageGb * DYNAMO_STORAGE_RATE * 100) / 100;
  const breakdown: { label: string; cost: number }[] = [];

  if (billingMode === 'PROVISIONED') {
    const readCapacity = Number(properties.read_capacity ?? 5);
    const writeCapacity = Number(properties.write_capacity ?? 5);
    const readCost = Math.round(readCapacity * DYNAMO_PROVISIONED_RCU_RATE * 100) / 100;
    const writeCost = Math.round(writeCapacity * DYNAMO_PROVISIONED_WCU_RATE * 100) / 100;
    breakdown.push({ label: `Read (${readCapacity} RCU)`, cost: readCost });
    breakdown.push({ label: `Write (${writeCapacity} WCU)`, cost: writeCost });
    breakdown.push({ label: `Storage (${storageGb} GB)`, cost: storageCost });
    return { monthly: readCost + writeCost + storageCost, breakdown };
  }

  // On-demand
  const wruMillions = typeof properties._cost_wcu === 'number' ? properties._cost_wcu : 1;
  const rruMillions = typeof properties._cost_rcu === 'number' ? properties._cost_rcu : 1;
  const writeCost = Math.round(wruMillions * DYNAMO_ONDEMAND_WRU_RATE * 100) / 100;
  const readCost = Math.round(rruMillions * DYNAMO_ONDEMAND_RRU_RATE * 100) / 100;

  breakdown.push({ label: `Writes (${wruMillions}M WRU)`, cost: writeCost });
  breakdown.push({ label: `Reads (${rruMillions}M RRU)`, cost: readCost });
  breakdown.push({ label: `Storage (${storageGb} GB)`, cost: storageCost });

  return { monthly: writeCost + readCost + storageCost, breakdown };
};

// SQS: Standard ~$0.40/million, FIFO ~$0.50/million
const SQS_STANDARD_RATE = 0.40;
const SQS_FIFO_RATE = 0.50;

export const sqsQueueCostCalculator: CostCalculator = async (properties) => {
  const requestsMillions = typeof properties._cost_requests_millions === 'number' ? properties._cost_requests_millions : 1;
  const fifo = properties.fifo_queue === true;

  const rate = fifo ? SQS_FIFO_RATE : SQS_STANDARD_RATE;
  const monthly = Math.round(requestsMillions * rate * 100) / 100;
  const label = fifo ? 'FIFO' : 'Standard';

  return {
    monthly,
    breakdown: [
      { label: `SQS ${label} (${requestsMillions}M × $${rate}/M)`, cost: monthly },
    ],
  };
};

// SNS: ~$0.50/million publishes + delivery costs
const SNS_PUBLISH_RATE = 0.50;

export const snsTopicCostCalculator: CostCalculator = async (properties) => {
  const requestsMillions = typeof properties._cost_requests_millions === 'number' ? properties._cost_requests_millions : 1;

  const monthly = Math.round(requestsMillions * SNS_PUBLISH_RATE * 100) / 100;

  return {
    monthly,
    breakdown: [
      { label: `SNS publishes (${requestsMillions}M × $${SNS_PUBLISH_RATE}/M)`, cost: monthly },
    ],
  };
};

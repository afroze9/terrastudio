import { invoke } from '@tauri-apps/api/core';
import { logger } from '$lib/logger';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  price: number;
  timestamp: number;
}

function cacheKey(serviceName: string, sku: string, region: string): string {
  return `ts-price-${serviceName}-${sku}-${region}`;
}

function getFromCache(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.price;
  } catch {
    return null;
  }
}

function setInCache(key: string, price: number): void {
  try {
    const entry: CacheEntry = { price, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/**
 * Fetch the monthly retail price for a given Azure resource SKU.
 * Routes through the Tauri backend to avoid browser CORS restrictions.
 * Returns null if the price cannot be determined.
 *
 * Prices are cached in localStorage for 24 hours.
 */
export async function fetchMonthlyPrice(
  serviceName: string,
  armSkuName: string,
  region: string
): Promise<number | null> {
  const key = cacheKey(serviceName, armSkuName, region);
  const cached = getFromCache(key);
  if (cached !== null) return cached;

  try {
    logger.debug(`[pricing] invoke fetch_azure_price: ${serviceName} / ${armSkuName} / ${region}`);

    // Tauri backend makes the HTTP call — no CORS issues
    const retailPrice = await invoke<number | null>('fetch_azure_price', {
      serviceName,
      armSkuName,
      region,
    });

    if (retailPrice === null || retailPrice === undefined) {
      logger.warn(`[pricing] No price returned for ${serviceName} / ${armSkuName} / ${region}`);
      return null;
    }

    // Azure Retail API returns per-hour for compute, per-unit for others.
    // For hourly prices multiply by 730 (average hours/month).
    const isHourly = serviceName === 'Virtual Machines' || serviceName === 'Azure App Service';
    const monthly = isHourly ? retailPrice * 730 : retailPrice;

    logger.debug(`[pricing] → $${monthly.toFixed(2)}/mo (retailPrice=${retailPrice})`);
    setInCache(key, monthly);
    return monthly;
  } catch (err) {
    logger.error(`[pricing] Error fetching ${serviceName} / ${armSkuName} / ${region}: ${err}`);
    return null;
  }
}

/**
 * Clear all cached pricing entries from localStorage.
 */
export function clearPricingCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('ts-price-')) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

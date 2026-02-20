/**
 * CIDR utility functions for networking intelligence.
 * All functions are pure with no dependencies.
 */

export interface ParsedCidr {
  /** Network address as a 32-bit unsigned integer */
  ip: number;
  /** Prefix length (0-32) */
  prefix: number;
}

/**
 * Parse a CIDR string like "10.0.0.0/16" into its components.
 * Returns null if the format is invalid.
 */
export function parseCidr(cidr: string): ParsedCidr | null {
  const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) return null;

  const o0 = parseInt(match[1]);
  const o1 = parseInt(match[2]);
  const o2 = parseInt(match[3]);
  const o3 = parseInt(match[4]);
  const prefix = parseInt(match[5]);

  if (o0 > 255 || o1 > 255 || o2 > 255 || o3 > 255 || prefix > 32) return null;

  const ip = ((o0 << 24) | (o1 << 16) | (o2 << 8) | o3) >>> 0;
  return { ip, prefix };
}

/**
 * Convert a 32-bit unsigned integer back to dotted-quad notation.
 */
function ipToString(ip: number): string {
  return `${(ip >>> 24) & 0xff}.${(ip >>> 16) & 0xff}.${(ip >>> 8) & 0xff}.${ip & 0xff}`;
}

/**
 * Compute the network mask for a given prefix length.
 */
function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (~0 << (32 - prefix)) >>> 0;
}

/**
 * Validate that a string is a well-formed CIDR block.
 */
export function isValidCidr(cidr: string): boolean {
  return parseCidr(cidr) !== null;
}

/**
 * Check if two CIDR blocks overlap (share any addresses).
 */
export function cidrsOverlap(a: string, b: string): boolean {
  const pa = parseCidr(a);
  const pb = parseCidr(b);
  if (!pa || !pb) return false;

  // Use the shorter prefix (larger network) as the comparison mask
  const shorterPrefix = Math.min(pa.prefix, pb.prefix);
  const mask = prefixToMask(shorterPrefix);

  return (pa.ip & mask) === (pb.ip & mask);
}

/**
 * Check if a child CIDR block fits entirely within a parent CIDR block.
 */
export function cidrContains(parent: string, child: string): boolean {
  const pp = parseCidr(parent);
  const pc = parseCidr(child);
  if (!pp || !pc) return false;

  // Child prefix must be >= parent prefix (smaller or equal network)
  if (pc.prefix < pp.prefix) return false;

  // Child's network address, masked to parent prefix, must match parent's network
  const parentMask = prefixToMask(pp.prefix);
  return (pc.ip & parentMask) === (pp.ip & parentMask);
}

/**
 * Find the next available subnet CIDR block within a parent CIDR range,
 * avoiding all already-used CIDR blocks.
 *
 * @param parentCidr - The parent network (e.g. "10.0.0.0/16")
 * @param usedCidrs - Already allocated subnet CIDRs (e.g. ["10.0.0.0/24", "10.0.1.0/24"])
 * @param subnetPrefix - The prefix length for the new subnet (default: 24)
 * @returns The next available CIDR string, or null if the parent is full
 */
export function nextAvailableCidr(
  parentCidr: string,
  usedCidrs: string[],
  subnetPrefix: number = 24,
): string | null {
  const parent = parseCidr(parentCidr);
  if (!parent) return null;

  // Subnet prefix must be longer than parent prefix
  if (subnetPrefix <= parent.prefix || subnetPrefix > 32) return null;

  const parentMask = prefixToMask(parent.prefix);
  const parentNetwork = (parent.ip & parentMask) >>> 0;
  const parentBroadcast = (parentNetwork | ~parentMask) >>> 0;

  // Step size for the subnet (number of addresses per subnet)
  const step = 1 << (32 - subnetPrefix);

  // Iterate through all possible subnet positions within the parent
  for (let candidate = parentNetwork; candidate <= parentBroadcast - step + 1; candidate = (candidate + step) >>> 0) {
    const candidateCidr = `${ipToString(candidate)}/${subnetPrefix}`;

    // Check this candidate doesn't overlap with any used CIDR
    const overlaps = usedCidrs.some((used) => cidrsOverlap(candidateCidr, used));
    if (!overlaps) {
      return candidateCidr;
    }
  }

  return null; // Parent is full
}

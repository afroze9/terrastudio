import { describe, it, expect } from 'vitest';
import {
  parseCidr,
  isValidCidr,
  cidrsOverlap,
  cidrContains,
  nextAvailableCidr,
} from './cidr-utils.js';

describe('parseCidr', () => {
  it('parses a valid CIDR', () => {
    const result = parseCidr('10.0.0.0/16');
    expect(result).toEqual({ ip: (10 << 24) >>> 0, prefix: 16 });
  });

  it('parses 0.0.0.0/0', () => {
    expect(parseCidr('0.0.0.0/0')).toEqual({ ip: 0, prefix: 0 });
  });

  it('parses 255.255.255.255/32', () => {
    expect(parseCidr('255.255.255.255/32')).toEqual({ ip: 0xffffffff, prefix: 32 });
  });

  it('returns null for invalid format', () => {
    expect(parseCidr('not-a-cidr')).toBeNull();
    expect(parseCidr('10.0.0.0')).toBeNull();
    expect(parseCidr('10.0.0.0/')).toBeNull();
    expect(parseCidr('/16')).toBeNull();
    expect(parseCidr('')).toBeNull();
  });

  it('returns null for out-of-range octets', () => {
    expect(parseCidr('256.0.0.0/16')).toBeNull();
    expect(parseCidr('10.0.0.300/24')).toBeNull();
  });

  it('returns null for out-of-range prefix', () => {
    expect(parseCidr('10.0.0.0/33')).toBeNull();
  });
});

describe('isValidCidr', () => {
  it('returns true for valid CIDRs', () => {
    expect(isValidCidr('10.0.0.0/16')).toBe(true);
    expect(isValidCidr('192.168.1.0/24')).toBe(true);
    expect(isValidCidr('0.0.0.0/0')).toBe(true);
  });

  it('returns false for invalid CIDRs', () => {
    expect(isValidCidr('not-valid')).toBe(false);
    expect(isValidCidr('10.0.0.0')).toBe(false);
    expect(isValidCidr('')).toBe(false);
  });
});

describe('cidrsOverlap', () => {
  it('detects identical CIDRs as overlapping', () => {
    expect(cidrsOverlap('10.0.0.0/24', '10.0.0.0/24')).toBe(true);
  });

  it('detects contained CIDRs as overlapping', () => {
    expect(cidrsOverlap('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
    expect(cidrsOverlap('10.0.1.0/24', '10.0.0.0/16')).toBe(true);
  });

  it('detects non-overlapping CIDRs', () => {
    expect(cidrsOverlap('10.0.0.0/24', '10.0.1.0/24')).toBe(false);
    expect(cidrsOverlap('10.0.0.0/24', '192.168.0.0/24')).toBe(false);
  });

  it('detects adjacent CIDRs as non-overlapping', () => {
    expect(cidrsOverlap('10.0.0.0/25', '10.0.0.128/25')).toBe(false);
  });

  it('returns false for invalid inputs', () => {
    expect(cidrsOverlap('invalid', '10.0.0.0/24')).toBe(false);
  });
});

describe('cidrContains', () => {
  it('parent contains child', () => {
    expect(cidrContains('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
    expect(cidrContains('10.0.0.0/16', '10.0.0.0/24')).toBe(true);
    expect(cidrContains('10.0.0.0/16', '10.0.255.0/24')).toBe(true);
  });

  it('parent does not contain child outside range', () => {
    expect(cidrContains('10.0.0.0/16', '10.1.0.0/24')).toBe(false);
    expect(cidrContains('10.0.0.0/16', '192.168.0.0/24')).toBe(false);
  });

  it('child cannot be larger than parent', () => {
    expect(cidrContains('10.0.0.0/24', '10.0.0.0/16')).toBe(false);
  });

  it('identical CIDRs contain each other', () => {
    expect(cidrContains('10.0.0.0/24', '10.0.0.0/24')).toBe(true);
  });

  it('returns false for invalid inputs', () => {
    expect(cidrContains('invalid', '10.0.0.0/24')).toBe(false);
    expect(cidrContains('10.0.0.0/16', 'invalid')).toBe(false);
  });
});

describe('nextAvailableCidr', () => {
  it('returns first subnet when none are used', () => {
    expect(nextAvailableCidr('10.0.0.0/16', [])).toBe('10.0.0.0/24');
  });

  it('returns second subnet when first is used', () => {
    expect(nextAvailableCidr('10.0.0.0/16', ['10.0.0.0/24'])).toBe('10.0.1.0/24');
  });

  it('skips used subnets', () => {
    expect(nextAvailableCidr('10.0.0.0/16', ['10.0.0.0/24', '10.0.1.0/24'])).toBe('10.0.2.0/24');
  });

  it('finds gaps in allocation', () => {
    expect(nextAvailableCidr('10.0.0.0/16', ['10.0.0.0/24', '10.0.2.0/24'])).toBe('10.0.1.0/24');
  });

  it('returns null when parent is full', () => {
    // /24 parent can only hold one /24 subnet
    expect(nextAvailableCidr('10.0.0.0/24', ['10.0.0.0/24'])).toBeNull();
  });

  it('returns null for invalid parent', () => {
    expect(nextAvailableCidr('invalid', [])).toBeNull();
  });

  it('returns null when subnet prefix is not larger than parent', () => {
    expect(nextAvailableCidr('10.0.0.0/24', [], 24)).toBeNull();
    expect(nextAvailableCidr('10.0.0.0/24', [], 16)).toBeNull();
  });

  it('respects custom subnet prefix', () => {
    // /16 parent with /25 subnets (128 addresses each)
    expect(nextAvailableCidr('10.0.0.0/16', [], 25)).toBe('10.0.0.0/25');
    expect(nextAvailableCidr('10.0.0.0/16', ['10.0.0.0/25'], 25)).toBe('10.0.0.128/25');
  });

  it('handles overlapping used CIDRs of different sizes', () => {
    // If a /23 is used, the next /24 should skip both /24 blocks within that /23
    expect(nextAvailableCidr('10.0.0.0/16', ['10.0.0.0/23'])).toBe('10.0.2.0/24');
  });
});

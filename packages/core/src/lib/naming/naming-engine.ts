import type { NamingConvention, NamingConstraints } from '@terrastudio/types';

export interface NamingTokens {
  type: string;
  env: string;
  name: string;
  region?: string;
  org?: string;
}

/**
 * Build the token map from a NamingConvention + a resource's cafAbbreviation.
 */
export function buildTokens(
  convention: NamingConvention,
  cafAbbreviation: string,
  name = '',
): NamingTokens {
  return {
    type: cafAbbreviation,
    env: convention.env,
    name,
    region: convention.region,
    org: convention.org,
  };
}

/**
 * Apply a naming template, substituting tokens and applying resource constraints.
 *
 * Tokens: {type}, {env}, {name}, {region}, {org}
 * Missing optional tokens (region/org when undefined) are removed along with any
 * immediately adjacent separator character (-, _, .) to avoid double-separators.
 *
 * Constraints are applied after substitution:
 *   - lowercase: entire result lowercased
 *   - noHyphens: all hyphens stripped
 *   - maxLength: truncated to N characters
 */
export function applyNamingTemplate(
  template: string,
  tokens: NamingTokens,
  constraints?: NamingConstraints,
): string {
  const separators = '[-_.]';
  const optionalTokens: Array<keyof NamingTokens> = ['region', 'org'];

  let result = template;

  // Replace all tokens
  result = result.replace(/\{type\}/g, tokens.type);
  result = result.replace(/\{env\}/g, tokens.env);
  result = result.replace(/\{name\}/g, tokens.name);

  // Replace optional tokens — if value is missing, also eat adjacent separator
  for (const key of optionalTokens) {
    const value = tokens[key];
    if (!value) {
      // Remove token and any trailing separator, or any leading separator if no trailing one
      const re = new RegExp(`(?:${separators}\\{${key}\\}|\\{${key}\\}${separators}|\\{${key}\\})`, 'g');
      result = result.replace(re, '');
    } else {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  }

  // Apply constraints
  if (constraints?.lowercase) result = result.toLowerCase();
  if (constraints?.noHyphens) result = result.replace(/-/g, '');
  if (constraints?.maxLength && result.length > constraints.maxLength) {
    result = result.slice(0, constraints.maxLength);
  }

  return result;
}

/**
 * Reverse of applyNamingTemplate: given a full Azure name and the convention used to
 * generate it, extract the user-provided {name} slug.
 *
 * Returns the full name unchanged if the name doesn't appear to follow the template
 * (graceful fallback — user may have overridden the name manually).
 */
export function extractSlug(
  fullName: string,
  template: string,
  tokens: Omit<NamingTokens, 'name'>,
  constraints?: NamingConstraints,
): string {
  // Build the prefix and suffix by applying the template with a sentinel slug
  const sentinel = '___SLUG___';
  const withSentinel = applyNamingTemplate(
    template,
    { ...tokens, name: sentinel },
    constraints,
  );

  const parts = withSentinel.split(sentinel);
  if (parts.length !== 2) return fullName;

  const [prefix, suffix] = parts as [string, string];

  // Check if fullName starts with prefix and ends with suffix
  if (!fullName.startsWith(prefix)) return fullName;
  const withoutPrefix = fullName.slice(prefix.length);

  if (suffix && !withoutPrefix.endsWith(suffix)) return fullName;
  const slug = suffix ? withoutPrefix.slice(0, -suffix.length) : withoutPrefix;

  return slug || fullName;
}

/**
 * Convert an Azure resource name to a valid Terraform identifier.
 * Hyphens → underscores, removes any other non-identifier chars, lowercased.
 */
export function sanitizeTerraformName(name: string): string {
  return name
    .replace(/-/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .replace(/^[0-9_]+/, '') // must not start with digit or underscore
    || 'resource';
}

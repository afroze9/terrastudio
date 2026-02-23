/**
 * Project-level naming convention configuration.
 * When enabled, new resources dropped on the canvas are auto-named using the template.
 * The {name} token is filled per-resource; all other tokens are project-level settings.
 */
export interface NamingConvention {
  enabled: boolean;
  /** Template string, e.g. '{type}-{env}-{name}' or '{org}-{type}-{env}-{name}' */
  template: string;
  /** Environment short name, e.g. 'dev', 'prod', 'staging' */
  env: string;
  /** Optional Azure region shortcode, e.g. 'eus2', 'weu' */
  region?: string;
  /** Optional organisation/team prefix, e.g. 'contoso' */
  org?: string;
}

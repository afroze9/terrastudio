import { describe } from 'vitest';
import type { InfraPlugin } from '@terrastudio/types';
import { describeSchemaConformance } from './schema-checks.js';
import { describeHclGenerator } from './hcl-checks.js';
import { describeConnectionRules } from './connection-checks.js';
import { describePaletteCategories } from './palette-checks.js';
import { describePluginIntegration } from './integration-checks.js';

/**
 * Run the full conformance test suite for a plugin.
 * Call this from a plugin's test file — it auto-registers vitest describe/it blocks.
 *
 * Usage:
 * ```ts
 * import { testPlugin } from '@terrastudio/core/testing';
 * import plugin from './index.js';
 * testPlugin(plugin);
 * ```
 */
export function testPlugin(plugin: InfraPlugin): void {
  describe(plugin.name, () => {
    // Per-resource checks
    for (const [typeId, registration] of plugin.resourceTypes) {
      describeSchemaConformance(typeId, registration);
      describeHclGenerator(typeId, registration);
    }

    // Plugin-wide checks
    describeConnectionRules(plugin);
    describePaletteCategories(plugin);
    describePluginIntegration(plugin);
  });
}

// Re-export helpers for custom per-resource tests
export { createMockResourceInstance, createMockHclContext } from './mock-helpers.js';
export type { MockHclContext } from './mock-helpers.js';

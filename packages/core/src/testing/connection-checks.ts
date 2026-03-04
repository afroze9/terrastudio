import { describe, it, expect } from 'vitest';
import type { InfraPlugin } from '@terrastudio/types';

const TYPE_ID_REGEX = /^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/;

/**
 * Register vitest checks that validate connection rules reference real handles.
 */
export function describeConnectionRules(plugin: InfraPlugin): void {
  if (plugin.connectionRules.length === 0) {
    // No rules to validate — register a passing placeholder
    describe(`Connection Rules: ${plugin.name}`, () => {
      it('has no connection rules (ok)', () => {
        expect(plugin.connectionRules).toHaveLength(0);
      });
    });
    return;
  }

  describe(`Connection Rules: ${plugin.name}`, () => {
    for (const rule of plugin.connectionRules) {
      const label = `${rule.sourceType} [${rule.sourceHandle}] → ${rule.targetType} [${rule.targetHandle}]`;

      it(`${label}: sourceType format valid`, () => {
        expect(rule.sourceType).toMatch(TYPE_ID_REGEX);
      });

      it(`${label}: targetType format valid`, () => {
        expect(rule.targetType).toMatch(TYPE_ID_REGEX);
      });

      it(`${label}: sourceHandle exists on source schema`, () => {
        const reg = plugin.resourceTypes.get(rule.sourceType);
        // Source type may be in another plugin — skip if not found locally
        if (!reg) return;
        const handleIds = reg.schema.handles.map((h) => h.id);
        expect(
          handleIds,
          `handle "${rule.sourceHandle}" not found on ${rule.sourceType}`,
        ).toContain(rule.sourceHandle);
      });

      it(`${label}: targetHandle exists on target schema`, () => {
        const reg = plugin.resourceTypes.get(rule.targetType);
        // Target type may be in another plugin — skip if not found locally
        if (!reg) return;
        const handleIds = reg.schema.handles.map((h) => h.id);
        expect(
          handleIds,
          `handle "${rule.targetHandle}" not found on ${rule.targetType}`,
        ).toContain(rule.targetHandle);
      });

      if (rule.createsReference) {
        it(`${label}: createsReference.propertyKey is non-empty`, () => {
          expect(rule.createsReference!.propertyKey).toBeTruthy();
        });
      }
    }
  });
}

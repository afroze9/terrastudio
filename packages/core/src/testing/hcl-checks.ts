import { describe, it, expect } from 'vitest';
import type { ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { createMockResourceInstance, createMockHclContext } from './mock-helpers.js';

const VALID_BLOCK_TYPES = ['resource', 'data', 'locals', 'variable', 'output'] as const;

/**
 * Register vitest checks that smoke-test an HCL generator.
 * Calls generate() with mock data and asserts the output shape is valid.
 */
export function describeHclGenerator(
  typeId: ResourceTypeId,
  registration: ResourceTypeRegistration,
): void {
  const { schema, hclGenerator } = registration;

  describe(`HCL Generator: ${typeId}`, () => {
    it('generate() does not throw and returns array', () => {
      const instance = createMockResourceInstance(schema);
      const context = createMockHclContext();

      let blocks: unknown;
      expect(() => {
        blocks = hclGenerator.generate(instance, context);
      }).not.toThrow();

      expect(Array.isArray(blocks)).toBe(true);
    });

    it('each block has valid blockType and non-empty content', () => {
      const instance = createMockResourceInstance(schema);
      const context = createMockHclContext();
      const blocks = hclGenerator.generate(instance, context);

      for (const block of blocks) {
        expect(
          VALID_BLOCK_TYPES as readonly string[],
          `invalid blockType: ${block.blockType}`,
        ).toContain(block.blockType);
        expect(
          block.content,
          `block with type ${block.blockType} has empty content`,
        ).toBeTruthy();
        expect(typeof block.content).toBe('string');
      }
    });

    it('resource/data blocks have terraformType and name', () => {
      const instance = createMockResourceInstance(schema);
      const context = createMockHclContext();
      const blocks = hclGenerator.generate(instance, context);

      for (const block of blocks) {
        if (block.blockType === 'resource' || block.blockType === 'data') {
          expect(
            block.terraformType,
            `${block.blockType} block missing terraformType`,
          ).toBeTruthy();
          expect(
            block.name,
            `${block.blockType} block missing name`,
          ).toBeTruthy();
        }
      }
    });

    if (hclGenerator.resolveTerraformType) {
      it('resolveTerraformType returns non-empty string', () => {
        const props: Record<string, unknown> = {};
        for (const prop of schema.properties) {
          if (prop.defaultValue !== undefined) {
            props[prop.key] = prop.defaultValue;
          }
        }

        const result = hclGenerator.resolveTerraformType!(props);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    }
  });
}

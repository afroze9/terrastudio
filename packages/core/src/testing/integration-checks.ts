import { describe, it, expect } from 'vitest';
import type { InfraPlugin } from '@terrastudio/types';
import { PluginRegistry } from '../lib/registry/plugin-registry.js';

const TYPE_ID_REGEX = /^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/;

/**
 * Register vitest checks that test plugin integration with PluginRegistry.
 */
export function describePluginIntegration(plugin: InfraPlugin): void {
  describe(`Integration: ${plugin.name}`, () => {
    it('PluginRegistry accepts plugin without throwing', () => {
      const registry = new PluginRegistry();
      expect(() => {
        registry.registerPlugin(plugin);
      }).not.toThrow();
    });

    it('buildNodeTypesMap has entry for every resource type', () => {
      const registry = new PluginRegistry();
      registry.registerPlugin(plugin);
      const nodeTypesMap = registry.buildNodeTypesMap();

      for (const typeId of plugin.resourceTypes.keys()) {
        expect(
          typeId in nodeTypesMap,
          `nodeTypesMap missing key: ${typeId}`,
        ).toBe(true);
      }
    });

    it('getPaletteCategories returns all declared categories', () => {
      const registry = new PluginRegistry();
      registry.registerPlugin(plugin);
      const categories = registry.getPaletteCategories();
      const catIds = categories.map((c) => c.id);

      for (const cat of plugin.paletteCategories) {
        expect(
          catIds,
          `palette category "${cat.id}" not returned by registry`,
        ).toContain(cat.id);
      }
    });

    if (plugin.bindingGenerators && plugin.bindingGenerators.length > 0) {
      it('binding generators have valid targetType format', () => {
        for (const bg of plugin.bindingGenerators!) {
          expect(
            bg.targetType,
            'binding generator missing targetType',
          ).toMatch(TYPE_ID_REGEX);
          if (bg.sourceType) {
            expect(bg.sourceType).toMatch(TYPE_ID_REGEX);
          }
        }
      });
    }
  });
}

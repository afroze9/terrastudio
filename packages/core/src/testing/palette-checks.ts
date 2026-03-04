import { describe, it, expect } from 'vitest';
import type { InfraPlugin } from '@terrastudio/types';

/**
 * Register vitest checks for palette categories.
 */
export function describePaletteCategories(plugin: InfraPlugin): void {
  describe(`Palette Categories: ${plugin.name}`, () => {
    it('each category has non-empty id and label', () => {
      for (const cat of plugin.paletteCategories) {
        expect(cat.id, 'category missing id').toBeTruthy();
        expect(cat.label, `category ${cat.id} missing label`).toBeTruthy();
      }
    });

    it('each category has numeric order', () => {
      for (const cat of plugin.paletteCategories) {
        expect(
          typeof cat.order,
          `category ${cat.id} order should be number`,
        ).toBe('number');
      }
    });

    it('no duplicate order values', () => {
      const orders = plugin.paletteCategories.map((c) => c.order);
      const unique = new Set(orders);
      expect(
        unique.size,
        `duplicate palette category orders: ${orders.join(', ')}`,
      ).toBe(orders.length);
    });

    it('all resource categories are represented in palette', () => {
      const categoryIds = new Set(
        plugin.paletteCategories.map((c) => c.id),
      );
      for (const [typeId, reg] of plugin.resourceTypes) {
        expect(
          categoryIds.has(reg.schema.category),
          `resource ${typeId} has category "${reg.schema.category}" not found in paletteCategories`,
        ).toBe(true);
      }
    });
  });
}

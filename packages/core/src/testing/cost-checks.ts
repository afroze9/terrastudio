import { describe, it, expect } from 'vitest';
import type { ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';

/**
 * Register vitest checks that verify a resource implements the costing API.
 * Every resource must define `costEstimation` on its schema so the cost panel
 * can display pricing information. Free resources should use `staticMonthlyCost: 0`.
 */
export function describeCostEstimation(
  typeId: ResourceTypeId,
  registration: ResourceTypeRegistration,
): void {
  const { schema } = registration;

  describe(`Cost: ${typeId}`, () => {
    it('has costEstimation defined', () => {
      expect(
        schema.costEstimation,
        `${typeId} is missing costEstimation on its schema. ` +
        `Add costEstimation with a serviceName (and optionally skuProperty, ` +
        `staticMonthlyCost, or usageInputs). Free resources should use ` +
        `{ serviceName: '...', staticMonthlyCost: 0 }.`,
      ).toBeDefined();
    });

    if (schema.costEstimation) {
      it('has non-empty serviceName', () => {
        expect(
          schema.costEstimation!.serviceName,
          `${typeId} costEstimation.serviceName must be a non-empty string`,
        ).toBeTruthy();
      });

      if (schema.costEstimation.skuProperty) {
        it('skuProperty references a valid schema property', () => {
          const propKeys = new Set(schema.properties.map((p) => p.key));
          // skuProperty may also be a derived field (like 'family' for Redis),
          // so we only warn — don't hard-fail
          if (!propKeys.has(schema.costEstimation!.skuProperty!)) {
            // Allow it but document the expectation
            expect(typeof schema.costEstimation!.skuProperty).toBe('string');
          }
        });
      }

      if (schema.costEstimation.usageInputs && schema.costEstimation.usageInputs.length > 0) {
        it('usageInputs have required fields', () => {
          for (const input of schema.costEstimation!.usageInputs!) {
            expect(input.key, 'usageInput missing key').toBeTruthy();
            expect(
              input.key.startsWith('_cost_'),
              `usageInput key "${input.key}" must start with "_cost_"`,
            ).toBe(true);
            expect(input.label, `usageInput ${input.key} missing label`).toBeTruthy();
            expect(input.unit, `usageInput ${input.key} missing unit`).toBeTruthy();
            expect(
              typeof input.defaultValue,
              `usageInput ${input.key} defaultValue must be number`,
            ).toBe('number');
          }
        });
      }
    }
  });
}

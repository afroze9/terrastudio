import { describe, it, expect } from 'vitest';
import type {
  ResourceTypeId,
  ResourceTypeRegistration,
  PropertySchema,
} from '@terrastudio/types';

const TYPE_ID_REGEX = /^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/;
const VALID_POSITIONS = ['top', 'bottom', 'left', 'right'] as const;
const VALID_HANDLE_TYPES = ['source', 'target'] as const;

/**
 * Register vitest checks that verify a resource schema is well-formed.
 */
export function describeSchemaConformance(
  typeId: ResourceTypeId,
  registration: ResourceTypeRegistration,
): void {
  const { schema } = registration;

  describe(`Schema: ${typeId}`, () => {
    it('has valid typeId format', () => {
      expect(typeId).toMatch(TYPE_ID_REGEX);
    });

    it('schema.typeId matches registration key', () => {
      expect(schema.typeId).toBe(typeId);
    });

    it('typeId matches HCL generator typeId', () => {
      expect(registration.hclGenerator.typeId).toBe(typeId);
    });

    it('has non-empty terraformType', () => {
      expect(schema.terraformType).toBeTruthy();
      expect(typeof schema.terraformType).toBe('string');
    });

    it('has required string fields', () => {
      expect(schema.provider).toBeTruthy();
      expect(schema.displayName).toBeTruthy();
      expect(schema.category).toBeTruthy();
      expect(schema.description).toBeTruthy();
    });

    it('properties have required fields', () => {
      for (const prop of schema.properties) {
        expect(prop.key, `property missing key`).toBeTruthy();
        expect(prop.type, `property ${prop.key} missing type`).toBeTruthy();
        expect(prop.label, `property ${prop.key} missing label`).toBeTruthy();
      }
    });

    it('select/multiselect properties have options', () => {
      const selectProps = schema.properties.filter(
        (p) => p.type === 'select' || p.type === 'multiselect',
      );
      for (const prop of selectProps) {
        expect(
          prop.options,
          `${prop.key} (${prop.type}) must have options`,
        ).toBeDefined();
        expect(
          prop.options!.length,
          `${prop.key} options must be non-empty`,
        ).toBeGreaterThan(0);
      }
    });

    it('select option values are strings', () => {
      const selectProps = schema.properties.filter(
        (p) =>
          (p.type === 'select' || p.type === 'multiselect') && p.options,
      );
      for (const prop of selectProps) {
        for (const opt of prop.options!) {
          expect(
            typeof opt.value,
            `${prop.key} option "${opt.label}" value must be string, got ${typeof opt.value}`,
          ).toBe('string');
        }
      }
    });

    it('defaultValue types are consistent', () => {
      for (const prop of schema.properties) {
        if (prop.defaultValue === undefined) continue;
        assertDefaultValueType(prop);
      }
    });

    it('visibleWhen references existing property', () => {
      const propKeys = new Set(schema.properties.map((p) => p.key));
      for (const prop of schema.properties) {
        if (!prop.visibleWhen) continue;
        expect(
          propKeys.has(prop.visibleWhen.field),
          `${prop.key} visibleWhen.field "${prop.visibleWhen.field}" not found in properties`,
        ).toBe(true);
      }
    });

    it('handle IDs are unique', () => {
      const ids = schema.handles.map((h) => h.id);
      const unique = new Set(ids);
      expect(
        unique.size,
        `duplicate handle IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`,
      ).toBe(ids.length);
    });

    it('handles have valid fields', () => {
      for (const handle of schema.handles) {
        expect(handle.id, 'handle missing id').toBeTruthy();
        expect(handle.label, `handle ${handle.id} missing label`).toBeTruthy();
        expect(
          VALID_HANDLE_TYPES,
          `handle ${handle.id} invalid type: ${handle.type}`,
        ).toContain(handle.type);
        expect(
          VALID_POSITIONS,
          `handle ${handle.id} invalid position: ${handle.position}`,
        ).toContain(handle.position);
      }
    });

    if (schema.outputs && schema.outputs.length > 0) {
      it('outputs have required fields', () => {
        for (const output of schema.outputs!) {
          expect(output.key, 'output missing key').toBeTruthy();
          expect(
            output.label,
            `output ${output.key} missing label`,
          ).toBeTruthy();
          expect(
            output.terraformAttribute,
            `output ${output.key} missing terraformAttribute`,
          ).toBeTruthy();
        }
      });
    }

    if (schema.canBeChildOf && schema.canBeChildOf.length > 0) {
      it('canBeChildOf entries have valid format', () => {
        for (const parentTypeId of schema.canBeChildOf!) {
          expect(parentTypeId).toMatch(TYPE_ID_REGEX);
        }
      });
    }

    if (schema.parentReference) {
      it('parentReference.propertyKey is plausible', () => {
        // propertyKey may reference a property key or a reference key
        // (like 'virtual_network_name' or 'subnet_id')
        expect(schema.parentReference!.propertyKey).toBeTruthy();
        expect(typeof schema.parentReference!.propertyKey).toBe('string');
      });
    }
  });
}

function assertDefaultValueType(prop: PropertySchema): void {
  const val = prop.defaultValue;
  switch (prop.type) {
    case 'string':
    case 'cidr':
    case 'select':
      expect(
        typeof val,
        `${prop.key} defaultValue should be string for type ${prop.type}`,
      ).toBe('string');
      break;
    case 'number':
      expect(
        typeof val,
        `${prop.key} defaultValue should be number`,
      ).toBe('number');
      break;
    case 'boolean':
      expect(
        typeof val,
        `${prop.key} defaultValue should be boolean`,
      ).toBe('boolean');
      break;
    case 'array':
      expect(
        Array.isArray(val),
        `${prop.key} defaultValue should be array`,
      ).toBe(true);
      break;
    // multiselect, tags, key-value-map, object, reference — skip strict check
  }
}

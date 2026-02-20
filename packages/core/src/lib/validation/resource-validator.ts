import type {
  ResourceSchema,
  PropertySchema,
  ValidationError,
} from '@terrastudio/types';
import { isValidCidr } from '../networking/cidr-utils.js';

/**
 * Validates a single resource instance's properties against its schema.
 */
export function validateResourceProperties(
  schema: ResourceSchema,
  properties: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const propSchema of schema.properties) {
    const value = properties[propSchema.key];
    const propErrors = validateProperty(propSchema, value);
    errors.push(...propErrors);
  }

  return errors;
}

function validateProperty(
  schema: PropertySchema,
  value: unknown,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = schema.key;

  // Required check
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push({
      propertyKey: key,
      message: `${schema.label} is required`,
      severity: 'error',
    });
    return errors; // Skip further validation if missing
  }

  // Skip validation if value is empty and not required
  if (value === undefined || value === null || value === '') {
    return errors;
  }

  // Array item validation (CIDR format, etc.)
  if (schema.type === 'array') {
    errors.push(...validateArrayItems(schema, value));
  }

  const validation = schema.validation;
  if (!validation) return errors;

  // String validations
  if (typeof value === 'string') {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      errors.push({
        propertyKey: key,
        message: `${schema.label} must be at least ${validation.minLength} characters`,
        severity: 'error',
      });
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      errors.push({
        propertyKey: key,
        message: `${schema.label} must be at most ${validation.maxLength} characters`,
        severity: 'error',
      });
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          propertyKey: key,
          message: validation.patternMessage ?? `${schema.label} has invalid format`,
          severity: 'error',
        });
      }
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push({
        propertyKey: key,
        message: `${schema.label} must be at least ${validation.min}`,
        severity: 'error',
      });
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push({
        propertyKey: key,
        message: `${schema.label} must be at most ${validation.max}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validate array items with CIDR type checking.
 * Called from validateProperty when schema.type === 'array'.
 */
function validateArrayItems(
  schema: PropertySchema,
  value: unknown,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(value)) return errors;

  if (schema.itemSchema?.type === 'cidr') {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'string' && item.trim() !== '' && !isValidCidr(item)) {
        errors.push({
          propertyKey: schema.key,
          message: `${schema.label} item ${i + 1}: invalid CIDR format (expected x.x.x.x/n)`,
          severity: 'error',
        });
      }
    }
  }

  return errors;
}

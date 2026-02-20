import type { ResourceTypeId } from './resource-schema.js';

export interface ConnectionRule {
  readonly sourceType: ResourceTypeId;
  readonly sourceHandle: string;
  readonly targetType: ResourceTypeId;
  readonly targetHandle: string;
  readonly createsReference?: {
    side: 'source' | 'target';
    propertyKey: string;
  };
  readonly label?: string;
  /** Marks this rule as an output binding that generates intermediate HCL */
  readonly outputBinding?: {
    readonly sourceAttribute: string;
  };
}

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
}

import type {
  ConnectionRule,
  ResourceTypeId,
} from '@terrastudio/types';

export interface EdgeValidationResult {
  valid: boolean;
  rule?: ConnectionRule;
  reason?: string;
}

/**
 * Validates whether an edge can be created between two resource nodes.
 * Uses ConnectionRules from all registered plugins.
 */
export class EdgeRuleValidator {
  constructor(private rules: ConnectionRule[]) {}

  /**
   * Check if a connection between two resource types on given handles is valid.
   */
  validate(
    sourceType: ResourceTypeId,
    sourceHandle: string,
    targetType: ResourceTypeId,
    targetHandle: string,
  ): EdgeValidationResult {
    const matchingRule = this.rules.find(
      (rule) =>
        rule.sourceType === sourceType &&
        rule.sourceHandle === sourceHandle &&
        rule.targetType === targetType &&
        rule.targetHandle === targetHandle,
    );

    if (matchingRule) {
      return { valid: true, rule: matchingRule };
    }

    return {
      valid: false,
      reason: `No connection rule allows ${sourceType}[${sourceHandle}] -> ${targetType}[${targetHandle}]`,
    };
  }

  /**
   * Find all valid target types for a given source.
   */
  getValidTargets(
    sourceType: ResourceTypeId,
    sourceHandle: string,
  ): ConnectionRule[] {
    return this.rules.filter(
      (rule) =>
        rule.sourceType === sourceType &&
        rule.sourceHandle === sourceHandle,
    );
  }

  /**
   * Find all valid source types for a given target.
   */
  getValidSources(
    targetType: ResourceTypeId,
    targetHandle: string,
  ): ConnectionRule[] {
    return this.rules.filter(
      (rule) =>
        rule.targetType === targetType &&
        rule.targetHandle === targetHandle,
    );
  }

  /**
   * Given a connected edge and its matching rule, returns the reference
   * that should be set on the node data (if any).
   */
  getReferenceFromRule(
    rule: ConnectionRule,
    sourceInstanceId: string,
    targetInstanceId: string,
  ): { instanceId: string; propertyKey: string; side: 'source' | 'target' } | null {
    if (!rule.createsReference) return null;

    return {
      instanceId:
        rule.createsReference.side === 'source'
          ? targetInstanceId
          : sourceInstanceId,
      propertyKey: rule.createsReference.propertyKey,
      side: rule.createsReference.side,
    };
  }
}

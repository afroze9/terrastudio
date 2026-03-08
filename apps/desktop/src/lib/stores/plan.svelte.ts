import type { TerraformDiagnostic } from './terraform.svelte';

/** Planned action for a resource */
export type PlanAction = 'create' | 'update' | 'delete' | 'no-op' | 'read' | 'replace';

/** A single resource's planned change with before/after property values */
export interface PlanResourceChange {
  address: string;
  moduleAddress: string;
  action: PlanAction;
  actions: PlanAction[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedKeys: string[];
}

/** Extended result from terraform plan with full diffs */
export interface TerraformPlanResult {
  success: boolean;
  code: number;
  diagnostics: TerraformDiagnostic[];
  planChanges: PlanResourceChange[];
  planFilePath: string;
  capturedAt: string;
}

/** Parse raw plan result from Rust backend into typed PlanResourceChange[] */
export function parsePlanChanges(
  rawChanges: Array<{
    address: string;
    module_address: string;
    actions: string[];
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>,
): PlanResourceChange[] {
  return rawChanges.map((raw) => {
    // Determine primary action
    let action: PlanAction;
    if (raw.actions.includes('delete') && raw.actions.includes('create')) {
      action = 'replace';
    } else {
      action = (raw.actions[0] as PlanAction) ?? 'no-op';
    }

    // Compute changed keys
    const beforeKeys = raw.before ? Object.keys(raw.before) : [];
    const afterKeys = raw.after ? Object.keys(raw.after) : [];
    const allKeys = new Set([...beforeKeys, ...afterKeys]);
    const changedKeys: string[] = [];
    for (const key of allKeys) {
      const bVal = raw.before?.[key];
      const aVal = raw.after?.[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changedKeys.push(key);
      }
    }

    return {
      address: raw.address,
      moduleAddress: raw.module_address,
      action,
      actions: raw.actions as PlanAction[],
      before: raw.before,
      after: raw.after,
      changedKeys,
    };
  });
}

class PlanStore {
  active = $state(false);
  planResult = $state<TerraformPlanResult | null>(null);
  nodeActionMap = $state<Map<string, PlanAction>>(new Map());
  nodeChangeMap = $state<Map<string, PlanResourceChange>>(new Map());
  diffNodeId = $state<string | null>(null);

  /** Diagram hash at the time the plan was captured — used for staleness detection */
  diagramHash = $state<string | null>(null);

  summary = $derived.by(() => {
    let toCreate = 0;
    let toUpdate = 0;
    let toDelete = 0;
    let noOp = 0;
    for (const change of this.planResult?.planChanges ?? []) {
      if (change.action === 'create') toCreate++;
      else if (change.action === 'update') toUpdate++;
      else if (change.action === 'delete') toDelete++;
      else if (change.action === 'replace') {
        toDelete++;
        toCreate++;
      } else noOp++;
    }
    return { toCreate, toUpdate, toDelete, noOp };
  });

  /** Unmatched changes (no corresponding diagram node) */
  unmatchedChanges = $derived.by(() => {
    const matchedAddresses = new Set(
      Array.from(this.nodeChangeMap.values()).map((c) => c.address),
    );
    return (this.planResult?.planChanges ?? []).filter(
      (c) => !matchedAddresses.has(c.address),
    );
  });

  setPlanResult(
    result: TerraformPlanResult,
    nodeActionMap: Map<string, PlanAction>,
    nodeChangeMap: Map<string, PlanResourceChange>,
    diagramHash: string,
  ) {
    this.planResult = result;
    this.nodeActionMap = nodeActionMap;
    this.nodeChangeMap = nodeChangeMap;
    this.diagramHash = diagramHash;
    this.active = true;
    this.diffNodeId = null;
  }

  dismiss() {
    this.active = false;
    this.diffNodeId = null;
  }

  clear() {
    this.active = false;
    this.planResult = null;
    this.nodeActionMap = new Map();
    this.nodeChangeMap = new Map();
    this.diffNodeId = null;
    this.diagramHash = null;
  }

  getNodeAction(nodeId: string): PlanAction | undefined {
    return this.nodeActionMap.get(nodeId);
  }

  getNodeChange(nodeId: string): PlanResourceChange | undefined {
    return this.nodeChangeMap.get(nodeId);
  }
}

export const plan = new PlanStore();

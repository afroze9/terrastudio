import { calculateNodeCost } from '$lib/cost';
import type { DiagramNode } from './diagram.svelte';
import { broadcastSetting } from './settings-sync';

export interface CostEstimate {
  nodeId: string;
  displayName: string;
  typeId: string;
  monthlyCost: number | null;
  loading: boolean;
  breakdown: { label: string; cost: number }[];
}

/** A single group entry in the container or module breakdown views. */
export interface CostGroup {
  /** Stable identifier — nodeId for containers, moduleId/instanceId for modules */
  id: string;
  /** Display label shown in the panel */
  label: string;
  /** Sum of monthlyCost for all members where monthlyCost !== null */
  subtotal: number;
  /** True if at least one member has monthlyCost === null (usage-based) */
  hasUsageBased: boolean;
  /** Ordered member estimates within this group */
  members: CostEstimate[];
  /** For module groups only: 'module' | 'template' | 'instance'. */
  moduleKind?: 'module' | 'template' | 'instance';
  /** For template instances: the display name of the template they reference. */
  templateName?: string;
}

/** Which view is active in the cost panel. */
export type CostView = 'category' | 'container' | 'module';

const AZURE_REGIONS: { value: string; label: string }[] = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
  { value: 'centralus', label: 'Central US' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'ukwest', label: 'UK West' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'japaneast', label: 'Japan East' },
];

export { AZURE_REGIONS };

function loadRegion(): string {
  if (typeof localStorage === 'undefined') return 'eastus';
  return localStorage.getItem('ts-cost-region') ?? 'eastus';
}

class CostStore {
  estimates = $state<Map<string, CostEstimate>>(new Map());
  loading = $state(false);
  lastFetched = $state<Date | null>(null);
  region = $state(loadRegion());
  isDirty = $state(false);
  private _costSnapshot = $state<string>('');

  totalMonthly = $derived.by(() => {
    let total = 0;
    let hasAny = false;
    for (const est of this.estimates.values()) {
      if (est.monthlyCost !== null) {
        total += est.monthlyCost;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  });

  hasPrices = $derived(this.estimates.size > 0);

  pricedCount = $derived.by(() => {
    let n = 0;
    for (const est of this.estimates.values()) {
      if (est.monthlyCost !== null) n++;
    }
    return n;
  });

  setRegion(region: string) {
    this.region = region;
    localStorage.setItem('ts-cost-region', region);
    broadcastSetting('costRegion', region);
  }

  private static buildSnapshot(nodes: DiagramNode[]): string {
    return JSON.stringify(
      nodes
        .map((n) => ({ id: n.id, typeId: n.data.typeId, properties: n.data.properties }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }

  markSnapshot(nodes: DiagramNode[]): void {
    this._costSnapshot = CostStore.buildSnapshot(nodes);
    this.isDirty = false;
  }

  checkDirty(nodes: DiagramNode[]): void {
    if (!this.hasPrices) return;
    this.isDirty = CostStore.buildSnapshot(nodes) !== this._costSnapshot;
  }

  toJSON(): object {
    return {
      estimates: Array.from(this.estimates.values()),
      lastFetched: this.lastFetched?.toISOString() ?? null,
      snapshot: this._costSnapshot,
    };
  }

  loadSaved(data: { estimates: CostEstimate[]; lastFetched: string | null; snapshot: string }): void {
    this.estimates = new Map(data.estimates.map((e) => [e.nodeId, e]));
    this.lastFetched = data.lastFetched ? new Date(data.lastFetched) : null;
    this._costSnapshot = data.snapshot ?? '';
    this.isDirty = false;
  }

  clear() {
    this.estimates = new Map();
    this.lastFetched = null;
    this._costSnapshot = '';
    this.isDirty = false;
  }

  async fetchAll(nodes: DiagramNode[]) {
    this.loading = true;
    const fallbackRegion = this.region;

    // Build a nodeId → node map for quick parent lookup
    const nodeMap = new Map<string, DiagramNode>(nodes.map((n) => [n.id, n]));

    /**
     * Resolve the Azure region for a node:
     * 1. Own `location` property (if present)
     * 2. Walk parentId chain to find the nearest Resource Group's location
     * 3. Fall back to the user-configured default region
     *
     * Azure location values in Terraform are typically lowercased, e.g. "eastus".
     * We normalise by stripping spaces and lowercasing.
     */
    const resolveRegion = (node: DiagramNode): string => {
      const own = (node.data.properties as Record<string, unknown>)?.location as string | undefined;
      if (own) return own.toLowerCase().replace(/\s+/g, '');

      // Walk up the parent chain
      let current: DiagramNode | undefined = node;
      while (current?.parentId) {
        const parent = nodeMap.get(current.parentId as string);
        if (!parent) break;
        const loc = (parent.data.properties as Record<string, unknown>)?.location as string | undefined;
        if (loc) return loc.toLowerCase().replace(/\s+/g, '');
        current = parent;
      }

      return fallbackRegion;
    };

    // Seed all nodes as loading
    const initial = new Map<string, CostEstimate>();
    for (const node of nodes) {
      initial.set(node.id, {
        nodeId: node.id,
        displayName: node.data.displayLabel || node.data.label || node.id,
        typeId: node.data.typeId,
        monthlyCost: null,
        loading: true,
        breakdown: [],
      });
    }
    this.estimates = initial;

    // Fetch all in parallel, each using its resolved region
    await Promise.all(
      nodes.map(async (node) => {
        const region = resolveRegion(node);
        const result = await calculateNodeCost(
          node.data.typeId,
          node.data.properties as Record<string, unknown>,
          region
        );
        const updated = new Map(this.estimates);
        updated.set(node.id, {
          nodeId: node.id,
          displayName: node.data.displayLabel || node.data.label || node.id,
          typeId: node.data.typeId,
          monthlyCost: result.monthly,
          loading: false,
          breakdown: result.breakdown ?? [],
        });
        this.estimates = updated;
      })
    );

    this.loading = false;
    this.lastFetched = new Date();
    this.markSnapshot(nodes);
  }

  exportCsv(nodes: DiagramNode[], options?: { groupBy?: CostView; groups?: CostGroup[] }): string {
    const hasGroup = options?.groupBy && options?.groups;
    const header = hasGroup
      ? 'Resource Name,Group,Type,Est. Monthly Cost (USD),Notes'
      : 'Resource Name,Type,Est. Monthly Cost (USD),Notes';
    const lines: string[] = [header];

    // Build nodeId → group label map if grouping
    const nodeGroupMap = new Map<string, string>();
    if (hasGroup && options!.groups) {
      for (const group of options!.groups) {
        for (const member of group.members) {
          nodeGroupMap.set(member.nodeId, group.label);
        }
      }
    }

    for (const node of nodes) {
      const est = this.estimates.get(node.id);
      const name = node.data.displayLabel || node.data.label || node.id;
      const type = node.data.typeId.split('/').pop() ?? node.data.typeId;
      const costVal = est?.monthlyCost !== undefined && est?.monthlyCost !== null
        ? `$${est.monthlyCost.toFixed(2)}`
        : 'Usage-based';
      const notes = est?.monthlyCost === null ? 'Usage-based or unknown' : '';
      if (hasGroup) {
        const group = nodeGroupMap.get(node.id) ?? 'Unassigned';
        lines.push(`"${name}","${group}","${type}",${costVal},"${notes}"`);
      } else {
        lines.push(`"${name}","${type}",${costVal},"${notes}"`);
      }
    }

    const total = this.totalMonthly;
    if (hasGroup) {
      lines.push(`"TOTAL",,,"${total !== null ? `$${total.toFixed(2)}` : ''}","Excludes usage-based resources"`);
    } else {
      lines.push(`"TOTAL",,${total !== null ? `$${total.toFixed(2)}` : ''},"Excludes usage-based resources"`);
    }

    return lines.join('\n');
  }

  formatRelativeTime(): string {
    if (!this.lastFetched) return '';
    const diffMs = Date.now() - this.lastFetched.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr} hr ago`;
  }
}

export const cost = new CostStore();

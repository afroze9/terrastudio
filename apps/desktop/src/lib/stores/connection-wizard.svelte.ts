import type { ResourceTypeId } from '@terrastudio/types';
import { ui } from './ui.svelte';

/** Identifies a unique connection type for dismissal preferences. */
export type ConnectionTypeKey = string;

export type ConnectionWizardEntryKind = 'edge' | 'binding' | 'containment';

export interface AutoFilledProperty {
  readonly side: 'source' | 'target';
  readonly propertyKey: string;
  readonly propertyLabel: string;
  readonly value: string;
}

export interface ConnectionWizardEntry {
  readonly id: string;
  readonly kind: ConnectionWizardEntryKind;
  readonly timestamp: number;
  readonly sourceNodeId: string;
  readonly sourceLabel: string;
  readonly sourceTypeId: ResourceTypeId;
  readonly sourceDisplayName: string;
  readonly targetNodeId: string;
  readonly targetLabel: string;
  readonly targetTypeId: ResourceTypeId;
  readonly targetDisplayName: string;
  readonly connectionLabel: string;
  readonly description: string;
  readonly terraformSnippet?: string;
  readonly autoFilledProperties: AutoFilledProperty[];
  readonly bindingResourceType?: string;
  readonly parentPropertyKey?: string;
  readonly parentContainerLabel?: string;
}

const STORAGE_KEY = 'terrastudio-wizard-dismissed';
const MAX_HISTORY = 50;

export class ConnectionWizardStore {
  activeEntry = $state<ConnectionWizardEntry | null>(null);
  history = $state<ConnectionWizardEntry[]>([]);
  dismissedTypes = $state<Set<ConnectionTypeKey>>(this._loadDismissed());
  /** True when a new entry arrives while wizard tab is not active */
  hasNewEntry = $state(false);

  static typeKey(sourceTypeId: ResourceTypeId, targetTypeId: ResourceTypeId): ConnectionTypeKey {
    return `${sourceTypeId}->${targetTypeId}`;
  }

  notifyEdgeConnection(entry: ConnectionWizardEntry): void {
    this._pushEntry(entry);
  }

  notifyContainment(entry: ConnectionWizardEntry): void {
    this._pushEntry(entry);
  }

  isDismissed(key: ConnectionTypeKey): boolean {
    return this.dismissedTypes.has(key);
  }

  dismiss(key: ConnectionTypeKey): void {
    const next = new Set(this.dismissedTypes);
    next.add(key);
    this.dismissedTypes = next;
    this._saveDismissed();
  }

  undismiss(key: ConnectionTypeKey): void {
    const next = new Set(this.dismissedTypes);
    next.delete(key);
    this.dismissedTypes = next;
    this._saveDismissed();
  }

  undismissAll(): void {
    this.dismissedTypes = new Set();
    this._saveDismissed();
  }

  clearHistory(): void {
    this.history = [];
    this.activeEntry = null;
  }

  clearActive(): void {
    this.activeEntry = null;
  }

  private _pushEntry(entry: ConnectionWizardEntry): void {
    // Deduplicate
    if (this.history.length > 0 && this.history[0].id === entry.id) return;

    // Always add to history
    this.history = [entry, ...this.history].slice(0, MAX_HISTORY);

    const typeKey = ConnectionWizardStore.typeKey(entry.sourceTypeId, entry.targetTypeId);
    if (!this.isDismissed(typeKey)) {
      this.activeEntry = entry;
    }
    // Show badge dot when wizard tab is not active
    if (ui.activeBottomTab !== 'connection-wizard') {
      this.hasNewEntry = true;
    }
  }

  private _loadDismissed(): Set<ConnectionTypeKey> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return new Set();
      return new Set(JSON.parse(stored) as string[]);
    } catch {
      return new Set();
    }
  }

  private _saveDismissed(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.dismissedTypes]));
  }
}

export const connectionWizard = new ConnectionWizardStore();

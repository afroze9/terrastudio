import { validateDiagram, validateNetworkTopology } from '@terrastudio/core';
import type { DiagramError, TopologyError } from '@terrastudio/core';
import type { ValidationError } from '@terrastudio/types';
import { untrack } from 'svelte';
import { diagram } from './diagram.svelte';
import { project } from './project.svelte';
import { registry } from '$lib/bootstrap';
import { convertToResourceInstances } from '$lib/services/diagram-converter';

/** A single flat problem entry for display in the Problems tab. */
export interface ProblemEntry {
  instanceId: string;
  resourceLabel: string;
  typeId: string;
  propertyKey: string;
  message: string;
  severity: 'error' | 'warning';
  quickFix?: QuickFix;
}

export interface QuickFix {
  label: string;
  apply: (instanceId: string, propertyKey: string) => void;
}

/** Grouped view for display: one group per resource instance. */
export interface ProblemsGroup {
  instanceId: string;
  resourceLabel: string;
  typeId: string;
  errorCount: number;
  warningCount: number;
  problems: ProblemEntry[];
}

class ValidationStore {
  private _problems = $state<ProblemEntry[]>([]);
  private _pending = $state(false);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;

  readonly problems = $derived(this._problems);
  readonly pending = $derived(this._pending);

  readonly groups = $derived.by((): ProblemsGroup[] => {
    const map = new Map<string, ProblemsGroup>();
    for (const p of this._problems) {
      let group = map.get(p.instanceId);
      if (!group) {
        group = {
          instanceId: p.instanceId,
          resourceLabel: p.resourceLabel,
          typeId: p.typeId,
          errorCount: 0,
          warningCount: 0,
          problems: [],
        };
        map.set(p.instanceId, group);
      }
      group.problems.push(p);
      if (p.severity === 'error') group.errorCount++;
      else group.warningCount++;
    }
    return [...map.values()].sort((a, b) => {
      if (a.errorCount > 0 && b.errorCount === 0) return -1;
      if (a.errorCount === 0 && b.errorCount > 0) return 1;
      return a.resourceLabel.localeCompare(b.resourceLabel);
    });
  });

  readonly errorCount = $derived(this._problems.filter((p) => p.severity === 'error').length);
  readonly warningCount = $derived(this._problems.filter((p) => p.severity === 'warning').length);

  /** Call once on app bootstrap to start reactive watching. */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    $effect.root(() => {
      $effect(() => {
        // Touch reactive dependencies to trigger re-validation
        void diagram.nodes;
        void diagram.edges;

        this._pending = true;
        if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          this.runValidation();
        }, 500);
      });
    });
  }

  private runValidation() {
    // Use untrack to prevent diagram mutations (setNodeValidationErrors, clearAll)
    // from re-triggering the $effect that watches diagram.nodes/edges.
    untrack(() => {
      const nodes = diagram.nodes;
      const edges = diagram.edges;

      // Filter out synthetic module nodes
      const realNodes = nodes.filter(
        (n) => !n.id.startsWith('_mod_') && !n.id.startsWith('_modinst_') && !n.id.startsWith('_instmem_') && !n.type?.startsWith('_annotation/'),
      );

      diagram.clearAllValidationErrors();

      const resources = convertToResourceInstances(
        realNodes,
        edges,
        registry.connectionRules,
        (typeId) => registry.getResourceSchema(typeId),
        project.projectConfig,
      );

      const diagramResult = validateDiagram(resources, registry.inner);
      const topologyErrors = validateNetworkTopology(realNodes as any);

      const allEntries: ProblemEntry[] = [];

      for (const de of diagramResult.errors) {
        diagram.setNodeValidationErrors(de.instanceId, de.errors);
        for (const err of de.errors) {
          allEntries.push({
            instanceId: de.instanceId,
            resourceLabel: de.label,
            typeId: de.typeId,
            propertyKey: err.propertyKey,
            message: err.message,
            severity: err.severity,
            quickFix: this.resolveQuickFix(err.propertyKey, err.severity),
          });
        }
      }

      for (const te of topologyErrors) {
        const node = realNodes.find((n) => n.id === te.instanceId);
        const label = (node?.data as any)?.label ?? te.instanceId;
        const typeId = node?.type ?? '';
        diagram.setNodeValidationErrors(te.instanceId, te.errors);
        for (const err of te.errors) {
          allEntries.push({
            instanceId: te.instanceId,
            resourceLabel: label,
            typeId,
            propertyKey: err.propertyKey,
            message: err.message,
            severity: err.severity,
          });
        }
      }

      // Sort: errors before warnings
      allEntries.sort((a, b) => {
        if (a.severity === 'error' && b.severity === 'warning') return -1;
        if (a.severity === 'warning' && b.severity === 'error') return 1;
        return 0;
      });

      this._problems = allEntries;
      this._pending = false;
    });
  }

  private resolveQuickFix(propertyKey: string, severity: 'error' | 'warning'): QuickFix | undefined {
    if (severity !== 'error') return undefined;
    if (propertyKey.startsWith('_')) return undefined;
    return {
      label: 'Focus field',
      apply: (instanceId: string, key: string) => {
        // Lazy import to avoid circular dependency
        import('$lib/services/problem-navigation').then((m) => m.focusPropertyField(instanceId, key));
      },
    };
  }
}

export const validation = new ValidationStore();

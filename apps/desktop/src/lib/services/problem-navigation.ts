import { diagram } from '$lib/stores/diagram.svelte';
import { ui } from '$lib/stores/ui.svelte';
import type { ProblemEntry } from '$lib/stores/validation.svelte';

/**
 * Selects the resource node, pans to it, opens the properties panel,
 * and highlights the specific property field.
 */
export function navigateToProblem(problem: ProblemEntry): void {
  // 1. Select the node
  diagram.selectedNodeId = problem.instanceId;

  // 2. Ensure properties panel is visible
  ui.showPropertiesPanel = true;

  // 3. Pan canvas to the node
  ui.navigateToNode(problem.instanceId);

  // 4. Signal the PropertiesPanel to scroll + highlight the field
  ui.highlightedPropertyKey = problem.propertyKey;
}

/**
 * Quick Fix: select the node, open properties panel, and focus the input
 * for the given property key.
 */
export function focusPropertyField(instanceId: string, propertyKey: string): void {
  navigateToProblem({
    instanceId,
    propertyKey,
    resourceLabel: '',
    typeId: '',
    message: '',
    severity: 'error',
  });
}

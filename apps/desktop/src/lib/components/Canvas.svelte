<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { buildNodeTypes } from '$lib/bootstrap';
  import DnDFlow from './DnDFlow.svelte';

  const nodeTypes = buildNodeTypes();
</script>

<svelte:window onkeydown={(event) => {
  const tag = (event.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    diagram.undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    event.preventDefault();
    diagram.redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    event.preventDefault();
    diagram.selectAll();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const hasSelected = diagram.nodes.some((n) => n.selected);
    if (hasSelected) {
      diagram.removeSelectedNodes();
    } else if (diagram.selectedNodeId) {
      diagram.removeNode(diagram.selectedNodeId);
    }
  }
}} />

<div class="canvas-wrapper">
  <SvelteFlowProvider>
    <DnDFlow {nodeTypes} />
  </SvelteFlowProvider>
</div>

<style>
  .canvas-wrapper {
    flex: 1;
    height: 100%;
    position: relative;
  }
</style>

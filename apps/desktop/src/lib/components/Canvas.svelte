<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { buildNodeTypes } from '$lib/bootstrap';
  import DnDFlow from './DnDFlow.svelte';

  const nodeTypes = buildNodeTypes();
</script>

<svelte:window onkeydown={(event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (diagram.selectedNodeId) {
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

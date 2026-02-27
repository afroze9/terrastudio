<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { buildNodeTypes } from '$lib/bootstrap';
  import DnDFlow from './DnDFlow.svelte';
  import CanvasToolbar from './CanvasToolbar.svelte';
  import SelectionToolbar from './SelectionToolbar.svelte';

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
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (ids.length === 0 && diagram.selectedNodeId) ids.push(diagram.selectedNodeId);
    if (ids.length > 0) { event.preventDefault(); diagram.copyNodes(ids); }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    if (diagram.hasClipboard) { event.preventDefault(); diagram.pasteNodes(); }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    const ids = diagram.nodes.filter((n) => n.selected).map((n) => n.id);
    if (ids.length === 0 && diagram.selectedNodeId) ids.push(diagram.selectedNodeId);
    if (ids.length > 0) { diagram.copyNodes(ids); diagram.pasteNodes(); }
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const hasSelected = diagram.nodes.some((n) => n.selected);
    if (hasSelected) {
      diagram.confirmAndRemoveSelectedNodes();
    } else if (diagram.selectedNodeId) {
      diagram.confirmAndRemoveNode(diagram.selectedNodeId);
    }
  }
}} />

<div class="canvas-wrapper">
  <SvelteFlowProvider>
    <DnDFlow {nodeTypes} />
    <CanvasToolbar />
    <SelectionToolbar />
  </SvelteFlowProvider>
</div>

<style>
  .canvas-wrapper {
    flex: 1;
    height: 100%;
    position: relative;
  }
</style>

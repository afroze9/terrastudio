<script lang="ts">
  import { NodeResizer } from '@xyflow/svelte';
  import type { AnnotationNodeData, AnnotationColor } from '@terrastudio/types';
  import { ANNOTATION_COLOR_THEMES, ANNOTATION_SIZE_DEFAULTS } from '@terrastudio/types';
  import { renderMarkdownLite } from './markdown-lite';
  import { diagram } from '$lib/stores/diagram.svelte';

  let { data, id, selected }: { data: AnnotationNodeData; id: string; selected?: boolean } = $props();

  let editing = $state(false);
  let editText = $state('');

  let theme = $derived(ANNOTATION_COLOR_THEMES[data.color] ?? ANNOTATION_COLOR_THEMES.yellow);
  let renderedHtml = $derived(renderMarkdownLite(data.text));

  const ALL_COLORS: AnnotationColor[] = ['yellow', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'grey'];

  function startEdit() {
    editText = data.text;
    editing = true;
  }

  function save() {
    if (!editing) return;
    const textToSave = editText;
    editing = false;
    if (textToSave !== data.text) {
      diagram.updateAnnotation(id, { text: textToSave });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      save();
    }
  }

  function setColor(color: AnnotationColor) {
    diagram.updateAnnotation(id, { color });
  }

  function setSize(size: 'small' | 'medium' | 'large') {
    const dims = ANNOTATION_SIZE_DEFAULTS[size];
    diagram.updateAnnotation(id, { size });
    // Update node dimensions via diagram store
    const node = diagram.nodes.find((n) => n.id === id);
    if (node) {
      node.measured = { width: dims.width, height: dims.height };
      node.width = dims.width;
      node.height = dims.height;
      diagram.saveSnapshot();
    }
  }

  function handleDelete() {
    diagram.removeNode(id);
  }

  function handleResizeEnd() {
    diagram.saveSnapshot();
  }
</script>

<NodeResizer minWidth={120} minHeight={80} isVisible={selected ?? false} onResizeEnd={handleResizeEnd} />

{#if selected}
  <div class="annotation-toolbar">
    <div class="color-swatches">
      {#each ALL_COLORS as c}
        <button
          class="swatch"
          class:active={data.color === c}
          style="background: {ANNOTATION_COLOR_THEMES[c].header};"
          onclick={() => setColor(c)}
          title={c}
        ></button>
      {/each}
    </div>
    <div class="size-btns">
      <button class="size-btn" class:active={data.size === 'small'} onclick={() => setSize('small')}>S</button>
      <button class="size-btn" class:active={data.size === 'medium'} onclick={() => setSize('medium')}>M</button>
      <button class="size-btn" class:active={data.size === 'large'} onclick={() => setSize('large')}>L</button>
    </div>
    <button class="delete-btn" onclick={handleDelete} title="Delete annotation">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
      </svg>
    </button>
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="annotation-node"
  style="border-color: {theme.border}; background: {theme.body}; color: {theme.text};"
  ondblclick={startEdit}
>
  <div class="annotation-header" style="background: {theme.header};"></div>
  <div class="annotation-body">
    {#if editing}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        class="annotation-editor nodrag nowheel"
        bind:value={editText}
        onblur={save}
        onkeydown={handleKeydown}
        autofocus
        style="color: {theme.text};"
      ></textarea>
    {:else if data.text}
      <div class="annotation-content">{@html renderedHtml}</div>
    {:else}
      <div class="annotation-placeholder">Double-click to edit...</div>
    {/if}
  </div>
</div>

<style>
  .annotation-node {
    width: 100%;
    height: 100%;
    border: 1.5px solid;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);
  }

  .annotation-header {
    height: 8px;
    flex-shrink: 0;
  }

  .annotation-body {
    flex: 1;
    min-height: 0;
    padding: 8px 10px;
    overflow: hidden;
  }

  .annotation-content {
    font-size: var(--font-12);
    line-height: 1.5;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .annotation-content :global(ul) {
    margin: 2px 0;
    padding-left: 16px;
    list-style-type: disc;
  }

  .annotation-content :global(li) {
    margin: 1px 0;
    display: list-item;
  }

  .annotation-content :global(strong) {
    font-weight: 600;
  }

  .annotation-placeholder {
    font-size: var(--font-12);
    opacity: 0.5;
    font-style: italic;
  }

  .annotation-editor {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    font-family: inherit;
    font-size: var(--font-12);
    line-height: 1.5;
  }

  .annotation-toolbar {
    position: absolute;
    top: -34px;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .color-swatches {
    display: flex;
    gap: 3px;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: var(--color-text);
    box-shadow: 0 0 0 1px var(--color-bg);
  }

  .size-btns {
    display: flex;
    gap: 1px;
    margin-left: 2px;
  }

  .size-btn {
    padding: 1px 5px;
    font-size: var(--font-9);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 2px;
  }

  .size-btn.active {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 2px;
    padding: 0;
    margin-left: 2px;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
</style>

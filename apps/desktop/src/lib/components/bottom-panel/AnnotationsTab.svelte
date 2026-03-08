<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import type { AnnotationNodeData } from '@terrastudio/types';
  import { ANNOTATION_COLOR_THEMES } from '@terrastudio/types';

  let annotations = $derived(
    diagram.nodes
      .filter((n) => n.type === '_annotation_')
      .map((n) => ({
        id: n.id,
        data: n.data as unknown as AnnotationNodeData,
      }))
  );

  function navigateToAnnotation(id: string) {
    diagram.selectedNodeId = id;
    ui.activeTabId = 'canvas';
  }

  function deleteAnnotation(id: string) {
    diagram.removeNode(id);
  }

  function addAnnotation() {
    diagram.addAnnotation({ x: 0, y: 0 });
    ui.activeTabId = 'canvas';
  }
</script>

{#if annotations.length === 0}
  <div class="placeholder-tab">
    <div class="placeholder-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="13" y2="16" />
      </svg>
    </div>
    <span class="placeholder-text">No annotations yet</span>
    <button class="add-btn" onclick={addAnnotation}>Add Annotation</button>
  </div>
{:else}
  <div class="annotations-list">
    <div class="list-header">
      <span class="list-count">{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
      <button class="add-btn-small" onclick={addAnnotation} title="Add Annotation">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
    {#each annotations as ann (ann.id)}
      {@const theme = ANNOTATION_COLOR_THEMES[ann.data.color] ?? ANNOTATION_COLOR_THEMES.yellow}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="annotation-row" onclick={() => navigateToAnnotation(ann.id)}>
        <span class="color-dot" style="background: {theme.header};"></span>
        <span class="annotation-text">{ann.data.text || 'Empty annotation'}</span>
        <button
          class="delete-row-btn"
          onclick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
          title="Delete"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .placeholder-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    color: var(--color-text-muted);
    opacity: 0.5;
  }
  .placeholder-icon {
    opacity: 0.4;
  }
  .placeholder-text {
    font-size: var(--font-12);
  }

  .add-btn {
    margin-top: 4px;
    padding: 4px 12px;
    font-size: var(--font-11);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 1;
  }
  .add-btn:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.08));
    color: var(--color-text);
  }

  .annotations-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    height: 100%;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }

  .list-count {
    font-size: var(--font-10);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .add-btn-small {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
  }
  .add-btn-small:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.08));
    color: var(--color-text);
  }

  .annotation-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    font-size: var(--font-12);
    width: 100%;
  }
  .annotation-row:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.05));
  }

  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .annotation-text {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .delete-row-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 2px;
    padding: 0;
    flex-shrink: 0;
    opacity: 0;
  }
  .annotation-row:hover .delete-row-btn {
    opacity: 1;
  }
  .delete-row-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
</style>

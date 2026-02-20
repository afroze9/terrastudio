<script lang="ts">
  import { slide } from 'svelte/transition';
  import { registry } from '$lib/bootstrap';
  import { ui } from '$lib/stores/ui.svelte';

  const categories = registry.getPaletteCategories();

  function onDragStart(event: DragEvent, typeId: string) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/terrastudio-type', typeId);
    event.dataTransfer.effectAllowed = 'copyMove';
  }
</script>

<aside class="palette">
  <div class="palette-header">Resources</div>
  {#each categories as category}
    {@const resources = registry.getResourceTypesForCategory(category.id)}
    {@const collapsed = ui.isCategoryCollapsed(category.id)}
    <div class="palette-category">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="category-header"
        onclick={() => ui.toggleCategory(category.id)}
      >
        <svg
          class="chevron"
          class:collapsed
          width="12" height="12" viewBox="0 0 12 12"
        >
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="category-label">{category.label}</span>
        <span class="category-count">{resources.length}</span>
      </div>
      {#if !collapsed}
        <div class="category-items" transition:slide={{ duration: 150 }}>
          {#each resources as reg}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="palette-item"
              draggable="true"
              ondragstart={(e) => onDragStart(e, reg.schema.typeId)}
              title={reg.schema.description}
            >
              {#if reg.icon.type === 'svg' && reg.icon.svg}
                <span class="palette-icon">{@html reg.icon.svg}</span>
              {/if}
              <span class="palette-label">{reg.schema.displayName}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</aside>

<style>
  .palette {
    width: 220px;
    min-width: 220px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .palette-header {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
  }
  .palette-category {
    border-bottom: 1px solid var(--color-border);
  }
  .category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s;
  }
  .category-header:hover {
    background: var(--color-surface-hover);
  }
  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
    transform: rotate(90deg);
    color: var(--color-text-muted);
  }
  .chevron.collapsed {
    transform: rotate(0deg);
  }
  .category-label {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .category-count {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.6;
  }
  .category-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px 8px;
  }
  .palette-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: grab;
    border-radius: 6px;
    font-size: 13px;
    text-align: left;
    transition: background 0.15s;
  }
  .palette-item:hover {
    background: var(--color-surface-hover);
  }
  .palette-item:active {
    cursor: grabbing;
  }
  .palette-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .palette-icon :global(svg) {
    width: 20px;
    height: 20px;
  }
  .palette-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

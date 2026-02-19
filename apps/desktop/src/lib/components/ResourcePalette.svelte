<script lang="ts">
  import { registry } from '$lib/bootstrap';

  const categories = registry.getPaletteCategories();

  function onDragStart(event: DragEvent, typeId: string) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/terrastudio-type', typeId);
    event.dataTransfer.effectAllowed = 'move';
  }
</script>

<aside class="palette">
  <div class="palette-header">Resources</div>
  {#each categories as category}
    {@const resources = registry.getResourceTypesForCategory(category.id)}
    <div class="palette-category">
      <div class="category-label">{category.label}</div>
      <div class="category-items">
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
    padding: 8px 0;
  }
  .category-label {
    padding: 4px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .category-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
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

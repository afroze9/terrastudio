<script lang="ts">
  import { slide } from 'svelte/transition';
  import { registry } from '$lib/bootstrap';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';

  let searchQuery = $state('');

  // Reactive: re-evaluates whenever registry.paletteCategories changes (new plugins loaded)
  // or project.projectConfig.activeProviders changes (user switches provider)
  let filteredCategories = $derived(
    registry.paletteCategories
      .map((category) => {
        let resources = registry.getResourceTypesForCategory(category.id);

        // Filter by active providers
        const active = project.projectConfig.activeProviders;
        if (active?.length) {
          resources = resources.filter((r) => active.includes(r.schema.provider as any));
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          resources = resources.filter(
            (reg) =>
              reg.schema.displayName.toLowerCase().includes(q) ||
              reg.schema.typeId.toLowerCase().includes(q) ||
              (reg.schema.description ?? '').toLowerCase().includes(q),
          );
        }

        return { category, resources };
      })
      .filter((c) => c.resources.length > 0),
  );

  function onDragStart(event: DragEvent, typeId: string) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/terrastudio-type', typeId);
    event.dataTransfer.effectAllowed = 'copyMove';
  }
</script>

<aside class="palette">
  <div class="palette-header">Resources</div>
  <div class="search-box">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      type="text"
      class="search-input"
      placeholder="Search resources..."
      bind:value={searchQuery}
    />
    {#if searchQuery}
      <button class="search-clear" onclick={() => (searchQuery = '')} aria-label="Clear search">&times;</button>
    {/if}
  </div>

  {#if registry.isLoading}
    <div class="palette-loading">Loading resources...</div>
  {:else if filteredCategories.length === 0}
    <div class="palette-empty">
      {#if searchQuery}
        No resources match your search.
      {:else}
        No resources for the selected provider.<br />
        Change in Project Settings &rarr; Cloud Provider.
      {/if}
    </div>
  {:else}
    {#each filteredCategories as { category, resources }}
      {@const collapsed = !searchQuery && ui.isCategoryCollapsed(category.id)}
      <div class="palette-category">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="category-header"
          onclick={() => { if (!searchQuery) ui.toggleCategory(category.id); }}
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
                {#if reg.icon?.type === 'svg' && reg.icon.svg}
                  <span class="palette-icon">{@html reg.icon.svg}</span>
                {:else}
                  <span class="palette-icon"></span>
                {/if}
                <span class="palette-label">{reg.schema.displayName}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</aside>

<style>
  .palette {
    width: 100%;
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .palette-header {
    display: none;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 10px;
    padding: 5px 8px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg);
    transition: border-color 0.15s;
  }
  .search-box:focus-within {
    border-color: var(--color-accent);
  }
  .search-icon {
    flex-shrink: 0;
    color: var(--color-text-muted);
    opacity: 0.5;
  }
  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 12px;
    outline: none;
    min-width: 0;
  }
  .search-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.5;
  }
  .search-clear {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }
  .search-clear:hover {
    color: var(--color-text);
  }
  .palette-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
  }
  .palette-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.5;
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

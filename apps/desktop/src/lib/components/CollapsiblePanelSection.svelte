<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ui } from '$lib/stores/ui.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    label: string;
    count?: number;
    children: Snippet;
  }

  let { id, label, count, children }: Props = $props();

  const collapsed = $derived(ui.isCategoryCollapsed(id));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="collapsible-panel-section">
  <div class="section-header" onclick={() => ui.toggleCategory(id)}>
    <svg
      class="chevron"
      class:collapsed
      width="10" height="10" viewBox="0 0 12 12"
    >
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="section-label">{label}</span>
    {#if count !== undefined}
      <span class="section-count">{count}</span>
    {/if}
  </div>
  {#if !collapsed}
    <div class="section-content" transition:slide={{ duration: 150 }}>
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .collapsible-panel-section {
    margin-top: 12px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid var(--color-border);
  }
  .section-header:hover .section-label {
    opacity: 0.8;
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
  .section-label {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .section-count {
    font-size: 10px;
    color: var(--color-text-muted);
    background: var(--color-bg);
    padding: 1px 6px;
    border-radius: 8px;
  }
  .section-content {
    padding: 8px 0;
  }
</style>

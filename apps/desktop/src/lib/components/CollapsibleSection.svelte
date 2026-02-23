<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ui } from '$lib/stores/ui.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    label: string;
    count?: number;
    /** When true, always renders expanded regardless of the ui store state (used during search). */
    forceExpand?: boolean;
    children: Snippet;
  }

  let { id, label, count, forceExpand = false, children }: Props = $props();

  const collapsed = $derived(!forceExpand && ui.isCategoryCollapsed(id));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="collapsible-section">
  <div class="section-header" onclick={() => ui.toggleCategory(id)}>
    <svg
      class="chevron"
      class:collapsed
      width="12" height="12" viewBox="0 0 12 12"
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
  .collapsible-section {
    border-bottom: 1px solid var(--color-border);
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s;
  }
  .section-header:hover {
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
    opacity: 0.6;
  }
  .section-content {
    padding: 4px 12px 8px;
  }
</style>

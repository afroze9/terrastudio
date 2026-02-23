<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
  }

  let { value = $bindable(''), placeholder = 'Search...' }: Props = $props();
</script>

<div class="search-box">
  <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
  <input
    type="text"
    class="search-input"
    {placeholder}
    bind:value
  />
  {#if value}
    <button class="search-clear" onclick={() => (value = '')} aria-label="Clear search">&times;</button>
  {/if}
</div>

<style>
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
</style>

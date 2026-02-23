<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';

  interface AzSubscription {
    id: string;
    name: string;
    tenantId: string;
    isDefault: boolean;
    state: string;
  }

  interface AzListResult {
    status: 'ok' | 'not_installed' | 'not_logged_in' | 'no_subscriptions' | 'error';
    subscriptions: AzSubscription[];
    error?: string;
  }

  let {
    displayName = '',
    subscriptionId = '',
    onSelect,
  }: {
    displayName: string;
    subscriptionId: string;
    onSelect: (name: string, id: string) => void;
  } = $props();

  type PickerState = 'idle' | 'loading' | 'open';

  let pickerState: PickerState = $state('idle');
  let result: AzListResult | null = $state(null);
  let filter = $state('');

  let filteredSubs = $derived.by(() => {
    if (!result || result.status !== 'ok') return [];
    const q = filter.toLowerCase();
    if (!q) return result.subscriptions;
    return result.subscriptions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  });

  async function browse() {
    if (pickerState === 'open') {
      pickerState = 'idle';
      return;
    }
    pickerState = 'loading';
    filter = '';
    try {
      result = await invoke<AzListResult>('az_list_subscriptions');
    } catch (e) {
      result = { status: 'error', subscriptions: [], error: String(e) };
    }
    pickerState = result!.status === 'ok' ? 'open' : 'idle';
  }

  function selectSubscription(sub: AzSubscription) {
    onSelect(sub.name, sub.id);
    pickerState = 'idle';
    filter = '';
  }

  function truncateId(id: string) {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }
</script>

<div class="subscription-picker">
  <!-- Current value display -->
  <div class="current-value">
    {#if subscriptionId}
      <span class="sub-name">{displayName || 'Unnamed'}</span>
      <span class="sub-id">{subscriptionId}</span>
    {:else}
      <span class="placeholder">No subscription selected</span>
    {/if}
  </div>

  <!-- Browse button -->
  <button
    class="browse-btn"
    class:active={pickerState === 'open'}
    onclick={browse}
    disabled={pickerState === 'loading'}
  >
    {#if pickerState === 'loading'}
      <span class="spinner"></span> Loading…
    {:else if pickerState === 'open'}
      Browse Azure Subscriptions ▲
    {:else}
      Browse Azure Subscriptions ▾
    {/if}
  </button>

  <!-- Expanded list -->
  {#if pickerState === 'open' && result?.status === 'ok'}
    <div class="picker-panel">
      <input
        class="filter-input"
        type="text"
        placeholder="Filter subscriptions…"
        bind:value={filter}
      />
      <div class="sub-list">
        {#each filteredSubs as sub (sub.id)}
          <button
            class="sub-row"
            class:selected={sub.id === subscriptionId}
            onclick={() => selectSubscription(sub)}
          >
            <span class="sub-row-dot" class:dot-visible={sub.isDefault}></span>
            <span class="sub-row-name">{sub.name}</span>
            <span class="sub-row-id">{truncateId(sub.id)}</span>
          </button>
        {:else}
          <div class="no-results">No subscriptions match</div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Not logged in -->
  {#if pickerState === 'idle' && result?.status === 'not_logged_in'}
    <div class="status-panel column">
      <span class="status-msg">Not signed in to Azure CLI. Run <code>az login</code> in a terminal, then click Browse again.</span>
    </div>
  {/if}

  <!-- Not installed -->
  {#if pickerState === 'idle' && result?.status === 'not_installed'}
    <div class="status-panel">
      <span class="status-icon">✕</span>
      <span class="status-msg">Azure CLI not installed</span>
      <a
        class="action-link"
        href="https://docs.microsoft.com/cli/azure/install-azure-cli"
        target="_blank"
        rel="noreferrer"
      >Install Azure CLI</a>
    </div>
  {/if}

  <!-- No subscriptions accessible -->
  {#if pickerState === 'idle' && result?.status === 'no_subscriptions'}
    <div class="status-panel column">
      <span class="status-msg">No subscriptions found for this account. If your subscriptions are in a specific tenant, run <code>az login --tenant &lt;TENANT_ID&gt;</code> in a terminal, then click Browse again.</span>
    </div>
  {/if}

  <!-- Error -->
  {#if pickerState === 'idle' && result?.status === 'error'}
    <div class="status-panel error">
      <span class="status-icon">✕</span>
      <span class="status-msg">{result.error ?? 'Unknown error'}</span>
    </div>
  {/if}
</div>

<style>
  .subscription-picker {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .current-value {
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 38px;
    justify-content: center;
  }

  .sub-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub-id {
    font-size: 10px;
    color: var(--color-text-muted);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .placeholder {
    font-size: 12px;
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .browse-btn {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: border-color 0.15s, background 0.15s;
  }

  .browse-btn:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: rgba(59, 130, 246, 0.05);
  }

  .browse-btn.active {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .browse-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .picker-panel {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-bg);
  }

  .filter-input {
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }

  .filter-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .sub-list {
    max-height: 180px;
    overflow-y: auto;
  }

  .sub-row {
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    transition: background 0.1s;
  }

  .sub-row:hover {
    background: rgba(59, 130, 246, 0.08);
  }

  .sub-row.selected {
    background: rgba(59, 130, 246, 0.12);
  }

  .sub-row-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: transparent;
  }

  .sub-row-dot.dot-visible {
    background: var(--color-accent);
  }

  .sub-row-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub-row-id {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .no-results {
    padding: 10px;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
    opacity: 0.6;
  }

  .status-panel {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 12px;
    flex-wrap: wrap;
  }

  .status-panel.column {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .status-panel code {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 10px;
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .status-panel.error {
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .status-icon {
    font-size: 13px;
    opacity: 0.8;
    flex-shrink: 0;
  }

  .status-msg {
    flex: 1;
    color: var(--color-text-muted);
  }


  .action-link {
    padding: 3px 8px;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    color: var(--color-accent);
    font-size: 11px;
    text-decoration: none;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }

  .action-link:hover {
    background: var(--color-accent);
    color: #fff;
  }

  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

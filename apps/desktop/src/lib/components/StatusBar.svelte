<script lang="ts">
  import { terraform } from '$lib/stores/terraform.svelte';
  import { ui } from '$lib/stores/ui.svelte';

  const statusLabel = $derived.by(() => {
    switch (terraform.status) {
      case 'idle':
        return 'Ready';
      case 'generating':
        return 'Generating HCL...';
      case 'writing':
        return 'Writing files...';
      case 'running':
        return `Running terraform ${terraform.currentCommand ?? ''}...`;
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  });

  const statusColor = $derived.by(() => {
    switch (terraform.status) {
      case 'running':
      case 'generating':
      case 'writing':
        return '#3b82f6';
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  });
</script>

<footer class="status-bar">
  <div class="status-left">
    <span
      class="status-dot"
      class:pulse={terraform.isRunning}
      style="background: {statusColor}"
    ></span>
    <span class="status-label">{statusLabel}</span>
    {#if terraform.terraformVersion}
      <span class="version-badge">Terraform v{terraform.terraformVersion}</span>
    {/if}
    {#if terraform.terraformInstalled === false}
      <span class="warning-badge">Terraform not found</span>
    {/if}
  </div>
  <div class="status-right">
    <button
      class="status-btn"
      class:active={ui.showTerminal}
      onclick={() => ui.toggleTerminal()}
    >
      Terminal
    </button>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 22px;
    padding: 0 8px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .status-label {
    font-size: 11px;
  }
  .version-badge {
    padding: 0 4px;
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.7;
  }
  .warning-badge {
    padding: 0 4px;
    font-size: 10px;
    color: #ef4444;
  }
  .status-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 11px;
    cursor: pointer;
    padding: 0 6px;
    height: 22px;
    line-height: 22px;
  }
  .status-btn:hover, .status-btn.active {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
</style>

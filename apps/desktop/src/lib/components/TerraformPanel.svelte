<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
</script>

{#if ui.showTerraformPanel}
  <div class="terraform-panel" style="height: {ui.terraformPanelHeight}px">
    <div class="panel-header">
      <div class="panel-actions">
        <button class="action-btn" disabled>Init</button>
        <button class="action-btn" disabled>Validate</button>
        <button class="action-btn" disabled>Plan</button>
        <button class="action-btn action-btn-primary" disabled>Apply</button>
      </div>
      <div class="panel-status">
        <span class="status-dot"></span>
        Ready
      </div>
    </div>
    <div class="panel-output">
      <pre class="output-console">Terraform output will appear here...</pre>
    </div>
  </div>
{/if}

<style>
  .terraform-panel {
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .panel-actions {
    display: flex;
    gap: 8px;
  }
  .action-btn {
    padding: 4px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .action-btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }
  .action-btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .panel-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }
  .panel-output {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
  }
  .output-console {
    margin: 0;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    color: var(--color-text-muted);
    white-space: pre-wrap;
  }
</style>

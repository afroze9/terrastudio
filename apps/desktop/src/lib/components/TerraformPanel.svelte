<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { terraform, type TerraformCommand } from '$lib/stores/terraform.svelte';
  import { runTerraformCommand } from '$lib/services/terraform-service';
  import { tick } from 'svelte';

  let outputEl: HTMLPreElement | undefined = $state();

  const canRunCommand = $derived(project.isOpen && terraform.canRun);

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

  async function handleCommand(command: TerraformCommand) {
    await runTerraformCommand(command);
  }

  // Auto-scroll when output changes
  $effect(() => {
    // Access outputLines to track it
    terraform.outputLines;
    tick().then(() => {
      if (outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });
  });
</script>

{#if ui.showTerraformPanel}
  <div class="terraform-panel" style="height: {ui.terraformPanelHeight}px">
    <div class="panel-header">
      <div class="panel-actions">
        <button
          class="action-btn"
          disabled={!canRunCommand}
          onclick={() => handleCommand('init')}
        >
          Init
        </button>
        <button
          class="action-btn"
          disabled={!canRunCommand}
          onclick={() => handleCommand('validate')}
        >
          Validate
        </button>
        <button
          class="action-btn"
          disabled={!canRunCommand}
          onclick={() => handleCommand('plan')}
        >
          Plan
        </button>
        <button
          class="action-btn action-btn-primary"
          disabled={!canRunCommand}
          onclick={() => handleCommand('apply')}
        >
          Apply
        </button>
        <span class="separator"></span>
        <button
          class="action-btn action-btn-danger"
          disabled={!canRunCommand}
          onclick={() => handleCommand('destroy')}
        >
          Destroy
        </button>
      </div>
      <div class="panel-status">
        <span
          class="status-dot"
          class:pulse={terraform.isRunning}
          style="background: {statusColor}"
        ></span>
        {statusLabel}
        {#if terraform.terraformVersion}
          <span class="version-badge">v{terraform.terraformVersion}</span>
        {/if}
        {#if terraform.terraformInstalled === false}
          <span class="warning-badge">Terraform not found</span>
        {/if}
        <button class="clear-btn" onclick={() => terraform.clearOutput()}>
          Clear
        </button>
      </div>
    </div>
    <pre class="panel-output" bind:this={outputEl}>{#each terraform.outputLines as line}<span class={line.stream === 'stderr' ? 'line-stderr' : 'line-stdout'}>{line.line}
</span>{/each}</pre>
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
    align-items: center;
  }
  .separator {
    width: 1px;
    height: 20px;
    background: var(--color-border);
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
  .action-btn-danger {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }
  .action-btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
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
    flex-shrink: 0;
  }
  .status-dot.pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .version-badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--color-bg);
    font-size: 10px;
    color: var(--color-text-muted);
  }
  .warning-badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.1);
    font-size: 10px;
    color: #ef4444;
  }
  .clear-btn {
    padding: 2px 8px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    margin-left: 4px;
  }
  .clear-btn:hover {
    background: var(--color-surface-hover);
  }
  .panel-output {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    margin: 0;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .line-stdout {
    color: var(--color-text-muted);
  }
  .line-stderr {
    color: #ef4444;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { generateAndWrite, runTerraformCommand, refreshDeploymentStatus } from '$lib/services/terraform-service';
  import type { TerraformCommand } from '$lib/stores/terraform.svelte';

  const canGenerate = $derived(
    project.isOpen && diagram.nodes.length > 0 && !terraform.isRunning,
  );
  const canRunCommand = $derived(project.isOpen && terraform.canRun);

  /** Variables that have no default and no user-supplied value */
  const missingRequiredVars = $derived(
    terraform.collectedVariables.filter(
      (v) =>
        (v.defaultValue === undefined || v.defaultValue === '') &&
        !(project.projectConfig.variableValues[v.name]),
    ),
  );

  let showVarWarning = $state(false);

  // Auto-load existing .tf files when the sidebar mounts or the project changes
  onMount(() => {
    loadExistingFiles();
  });

  async function loadExistingFiles() {
    if (!project.path) return;
    try {
      const files = await invoke<string[]>('list_terraform_files', {
        projectPath: project.path,
      });
      if (files.length > 0) {
        ui.generatedFiles = files;
      }
    } catch {
      // No terraform directory yet — that's fine
    }
  }

  async function handleGenerate() {
    terraform.clearOutput();
    ui.showTerminal = true;
    try {
      await generateAndWrite();
    } catch {
      // Error already logged to terraform store
    }
  }

  async function handleCommand(command: TerraformCommand) {
    if (command === 'apply' && missingRequiredVars.length > 0) {
      showVarWarning = true;
      return;
    }
    showVarWarning = false;
    ui.showTerminal = true;

    const success = await runTerraformCommand(command);
    if ((command === 'apply' || command === 'destroy') && success) {
      await refreshDeploymentStatus();
    }
  }

  async function forceApply() {
    showVarWarning = false;
    ui.showTerminal = true;
    const success = await runTerraformCommand('apply');
    if (success) {
      await refreshDeploymentStatus();
    }
  }

  function openFile(filename: string) {
    ui.openFileTab(filename);
  }
</script>

<div class="tf-sidebar">
  <!-- Generated Files (top) -->
  <div class="section files-section">
    <div class="section-header">FILES</div>
    {#if ui.generatedFiles.length === 0}
      <p class="empty-hint">No terraform files yet. Add resources and generate.</p>
    {:else}
      <div class="file-list">
        {#each ui.generatedFiles as filename (filename)}
          <button class="file-item" onclick={() => openFile(filename)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>{filename}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Spacer to push commands to bottom -->
  <div class="spacer"></div>

  {#if showVarWarning}
    <div class="var-warning">
      <span>Missing {missingRequiredVars.length} required variable{missingRequiredVars.length > 1 ? 's' : ''}:</span>
      <span class="var-names">{missingRequiredVars.map(v => v.name).join(', ')}</span>
      <div class="var-warning-actions">
        <button class="warn-btn" onclick={forceApply}>Apply Anyway</button>
        <button class="warn-btn" onclick={() => (showVarWarning = false)}>Dismiss</button>
      </div>
    </div>
  {/if}

  <!-- Commands (bottom) -->
  <div class="section commands-section">
    <div class="section-header">COMMANDS</div>
    <div class="cmd-buttons">
      <button class="cmd-btn cmd-btn-accent" disabled={!canGenerate} onclick={handleGenerate}>
        Generate
      </button>
      <div class="cmd-row">
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('init')}>Init</button>
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('validate')}>Validate</button>
      </div>
      <div class="cmd-row">
        <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('plan')}>Plan</button>
        <button class="cmd-btn cmd-btn-primary" disabled={!canRunCommand} onclick={() => handleCommand('apply')}>Apply</button>
      </div>
      <button class="cmd-btn cmd-btn-danger" disabled={!canRunCommand} onclick={() => handleCommand('destroy')}>
        Destroy
      </button>
      <button
        class="cmd-btn"
        disabled={terraform.isRunning || !project.isOpen}
        onclick={async () => {
          terraform.appendInfo('\n--- Refreshing deployment status ---');
          await refreshDeploymentStatus();
          terraform.appendInfo('Status refreshed.');
        }}
      >
        Refresh Status
      </button>
    </div>
  </div>
</div>

<style>
  .tf-sidebar {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .section {
    flex-shrink: 0;
  }
  .files-section {
    flex-shrink: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .spacer {
    flex: 1;
  }
  .section-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    padding: 6px 0 4px;
    opacity: 0.7;
  }
  .cmd-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cmd-row {
    display: flex;
    gap: 4px;
  }
  .cmd-row .cmd-btn {
    flex: 1;
  }
  .cmd-btn {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    text-align: center;
  }
  .cmd-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .cmd-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cmd-btn-accent {
    border-color: rgba(96, 165, 250, 0.25);
    color: rgba(96, 165, 250, 0.85);
  }
  .cmd-btn-accent:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.4);
    color: #60a5fa;
  }
  .cmd-btn-primary {
    border-color: rgba(96, 165, 250, 0.25);
    color: rgba(96, 165, 250, 0.85);
  }
  .cmd-btn-primary:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.4);
    color: #60a5fa;
  }
  .cmd-btn-danger {
    color: rgba(239, 68, 68, 0.6);
    border-color: rgba(239, 68, 68, 0.15);
  }
  .cmd-btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  .var-warning {
    padding: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    font-size: 11px;
    color: #f59e0b;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .var-names {
    display: block;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 10px;
    margin: 4px 0;
  }
  .var-warning-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }
  .warn-btn {
    padding: 2px 8px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 3px;
    background: transparent;
    color: #f59e0b;
    font-size: 10px;
    cursor: pointer;
  }
  .warn-btn:hover {
    background: rgba(245, 158, 11, 0.15);
  }
  .empty-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 4px 0;
    opacity: 0.7;
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .file-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .file-item svg {
    flex-shrink: 0;
    opacity: 0.6;
  }
</style>

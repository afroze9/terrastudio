<script lang="ts">
  import { createProject, pickFolder } from '$lib/services/project-service';

  let {
    open = false,
    onclose,
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  let projectName = $state('');
  let folderPath = $state('');
  let error = $state('');
  let creating = $state(false);

  async function handlePickFolder() {
    const selected = await pickFolder();
    if (selected) {
      folderPath = selected;
    }
  }

  async function handleCreate() {
    error = '';

    if (!projectName.trim()) {
      error = 'Project name is required';
      return;
    }
    if (!folderPath) {
      error = 'Please select a folder';
      return;
    }

    creating = true;
    try {
      await createProject(projectName.trim(), folderPath);
      projectName = '';
      folderPath = '';
      onclose();
    } catch (e) {
      error = String(e);
    } finally {
      creating = false;
    }
  }

  function handleCancel() {
    projectName = '';
    folderPath = '';
    error = '';
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && projectName && folderPath) handleCreate();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onkeydown={handleKeydown} onclick={handleCancel}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="dialog-title">New Project</h2>

      <div class="field">
        <label class="field-label" for="project-name">Project Name</label>
        <input
          id="project-name"
          type="text"
          class="field-input"
          placeholder="my-infrastructure"
          bind:value={projectName}
          disabled={creating}
        />
      </div>

      <div class="field">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="field-label">Location</label>
        <div class="folder-picker">
          <span class="folder-path">{folderPath || 'No folder selected'}</span>
          <button class="browse-btn" onclick={handlePickFolder} disabled={creating}>
            Browse
          </button>
        </div>
      </div>

      {#if folderPath && projectName}
        <div class="preview">
          Will create: <code>{folderPath}/{projectName.trim()}/</code>
        </div>
      {/if}

      {#if error}
        <div class="error">{error}</div>
      {/if}

      <div class="dialog-actions">
        <button class="btn btn-secondary" onclick={handleCancel} disabled={creating}>
          Cancel
        </button>
        <button
          class="btn btn-primary"
          onclick={handleCreate}
          disabled={creating || !projectName.trim() || !folderPath}
        >
          {creating ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .dialog {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 24px;
    width: 480px;
    max-width: 90vw;
  }
  .dialog-title {
    margin: 0 0 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }
  .field {
    margin-bottom: 16px;
  }
  .field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .field-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }
  .field-input:focus {
    border-color: var(--color-accent);
  }
  .folder-picker {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .folder-path {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .browse-btn {
    padding: 8px 16px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .browse-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
  }
  .preview {
    margin-bottom: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--color-bg);
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .preview code {
    color: var(--color-accent);
  }
  .error {
    margin-bottom: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 12px;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    padding: 8px 20px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-surface-hover);
  }
  .btn-primary {
    background: var(--color-accent);
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
</style>

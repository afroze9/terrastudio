<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';

  function handleSave() {
    ui.resolveUnsaved('save');
  }

  function handleDiscard() {
    ui.resolveUnsaved('discard');
  }

  function handleCancel() {
    ui.resolveUnsaved('cancel');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter') handleSave();
  }
</script>

{#if ui.unsavedDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onkeydown={handleKeydown} onclick={handleCancel}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="dialog-title">Unsaved Changes</h2>
      <p class="dialog-message">You have unsaved changes. Do you want to save before closing?</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-discard" onclick={handleDiscard}>Don't Save</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" onclick={handleCancel}>Cancel</button>
        <button class="btn btn-primary" onclick={handleSave}>Save</button>
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
    z-index: 2000;
  }
  .dialog {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 24px;
    width: 420px;
    max-width: 90vw;
  }
  .dialog-title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }
  .dialog-message {
    margin: 0 0 20px;
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .dialog-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .spacer {
    flex: 1;
  }
  .btn {
    padding: 8px 20px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-secondary {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  .btn-secondary:hover {
    background: var(--color-surface-hover);
  }
  .btn-primary {
    background: var(--color-accent);
    color: white;
  }
  .btn-primary:hover {
    background: var(--color-accent-hover);
  }
</style>

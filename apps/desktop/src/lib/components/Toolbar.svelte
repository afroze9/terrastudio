<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <span class="app-logo">TerraStudio</span>
  </div>
  <div class="toolbar-center">
    <button
      class="toolbar-btn"
      class:active={ui.showPalette}
      onclick={() => (ui.showPalette = !ui.showPalette)}
    >
      Palette
    </button>
    <button
      class="toolbar-btn"
      class:active={ui.showSidebar}
      onclick={() => (ui.showSidebar = !ui.showSidebar)}
    >
      Properties
    </button>
    <button
      class="toolbar-btn"
      class:active={ui.showTerraformPanel}
      onclick={() => (ui.showTerraformPanel = !ui.showTerraformPanel)}
    >
      Terraform
    </button>
  </div>
  <div class="toolbar-right">
    <button class="toolbar-btn toolbar-btn-accent" disabled>Generate</button>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 44px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .toolbar-left, .toolbar-center, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .app-logo {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.02em;
    color: var(--color-accent);
  }
  .toolbar-btn {
    padding: 4px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .toolbar-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .toolbar-btn.active {
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .toolbar-btn-accent {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }
  .toolbar-btn-accent:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

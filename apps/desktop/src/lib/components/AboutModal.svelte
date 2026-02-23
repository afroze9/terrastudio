<script lang="ts">
  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') onclose(); }} />

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={onclose}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <button class="close-btn" onclick={onclose} aria-label="Close">&#215;</button>

      <div class="logo-wrap">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="10" fill="var(--color-accent)" opacity="0.15"/>
          <rect x="10" y="10" width="28" height="28" rx="4" stroke="var(--color-accent)" stroke-width="1.5" fill="none"/>
          <line x1="10" y1="20" x2="38" y2="20" stroke="var(--color-accent)" stroke-width="1.5"/>
          <line x1="20" y1="38" x2="20" y2="20" stroke="var(--color-accent)" stroke-width="1.5"/>
          <circle cx="30" cy="30" r="3" fill="var(--color-accent)"/>
          <circle cx="15" cy="30" r="2" fill="var(--color-accent)" opacity="0.6"/>
          <line x1="17" y1="30" x2="27" y2="30" stroke="var(--color-accent)" stroke-width="1" stroke-dasharray="2 2"/>
        </svg>
      </div>

      <h2 class="app-name">TerraStudio</h2>
      <p class="version">Version 0.3.2</p>
      <p class="tagline">Visual infrastructure diagram builder<br>that generates and executes Terraform.</p>

      <div class="divider"></div>

      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Author</span>
          <span class="meta-value">Afroze Amjad (<span class="github">afroze9</span>)</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Built with</span>
          <span class="meta-value">Tauri 2 · Svelte 5 · @xyflow/svelte</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">License</span>
          <span class="meta-value">AGPL-3.0</span>
        </div>
      </div>

      <button class="ok-btn" onclick={onclose}>OK</button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .modal {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    width: 340px;
    padding: 32px 28px 24px;
    text-align: center;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  }

  .close-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
  }
  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .logo-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 14px;
  }

  .app-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 4px;
    letter-spacing: 0.01em;
  }

  .version {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 0 0 12px;
  }

  .tagline {
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .divider {
    height: 1px;
    background: var(--color-border);
    margin: 20px 0;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .meta-label {
    color: var(--color-text-muted);
  }

  .meta-value {
    color: var(--color-text);
    font-weight: 500;
  }

  .github {
    color: var(--color-accent);
    font-weight: 400;
  }

  .ok-btn {
    width: 100%;
    padding: 8px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .ok-btn:hover {
    opacity: 0.85;
  }
</style>

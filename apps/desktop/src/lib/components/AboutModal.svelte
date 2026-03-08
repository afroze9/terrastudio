<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { t } from '$lib/i18n';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let showThirdParty = $state(false);

  const thirdPartyDeps = [
    { name: '@dagrejs/dagre', license: 'MIT', author: 'Chris Pettitt' },
    { name: '@tauri-apps/api', license: 'Apache-2.0 OR MIT', author: 'Tauri Programme' },
    { name: '@tauri-apps/plugin-dialog', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: '@tauri-apps/plugin-fs', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: '@tauri-apps/plugin-log', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: '@tauri-apps/plugin-notification', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: '@tauri-apps/plugin-opener', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: '@xyflow/svelte', license: 'MIT', author: 'XY Flow Contributors' },
    { name: 'bits-ui', license: 'MIT', author: 'Hunter Johnston' },
    { name: 'highlight.js', license: 'BSD-3-Clause', author: 'Josh Goebel' },
    { name: 'html-to-image', license: 'MIT', author: 'bubkoo' },
    { name: 'svelte', license: 'MIT', author: 'Svelte Contributors' },
    { name: 'tailwindcss', license: 'MIT', author: 'Tailwind Labs' },
    { name: 'serde', license: 'MIT OR Apache-2.0', author: 'David Tolnay' },
    { name: 'tokio', license: 'MIT', author: 'Tokio Contributors' },
    { name: 'reqwest', license: 'MIT OR Apache-2.0', author: 'Sean McArthur' },
    { name: 'tauri', license: 'MIT OR Apache-2.0', author: 'Tauri Programme' },
    { name: 'uuid', license: 'MIT OR Apache-2.0', author: 'uuid-rs Contributors' },
  ];
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') onclose(); }} />

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={onclose}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <button class="close-btn" onclick={onclose} aria-label="Close">&#215;</button>

      <div class="logo-wrap">
        <svg width="48" height="48" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="about-frame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2a2f42"/>
              <stop offset="100%" stop-color="#181b24"/>
            </linearGradient>
            <linearGradient id="about-blue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#60a5fa"/>
              <stop offset="100%" stop-color="#3b82f6"/>
            </linearGradient>
            <linearGradient id="about-teal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#5eead4"/>
              <stop offset="100%" stop-color="#14b8a6"/>
            </linearGradient>
            <linearGradient id="about-purple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#c084fc"/>
              <stop offset="100%" stop-color="#9333ea"/>
            </linearGradient>
            <clipPath id="about-frameClip">
              <rect x="32" y="32" width="448" height="448" rx="36" ry="36"/>
            </clipPath>
          </defs>
          <rect x="32" y="32" width="448" height="448" rx="36" ry="36" fill="url(#about-frame)"/>
          <g clip-path="url(#about-frameClip)">
            <rect x="32" y="32" width="448" height="44" fill="#13151d"/>
            <circle cx="68" cy="54" r="6.5" fill="#ff5f57" opacity="0.9"/>
            <circle cx="90" cy="54" r="6.5" fill="#febc2e" opacity="0.9"/>
            <circle cx="112" cy="54" r="6.5" fill="#28c840" opacity="0.9"/>
            <line x1="256" y1="190" x2="148" y2="340" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
            <line x1="256" y1="190" x2="364" y2="340" stroke="#5eead4" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
            <line x1="148" y1="340" x2="364" y2="340" stroke="#a855f7" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
            <rect x="214" y="148" width="84" height="84" rx="18" ry="18" fill="url(#about-blue)"/>
            <circle cx="148" cy="340" r="44" fill="url(#about-teal)"/>
            <polygon points="364,298 400,319 400,361 364,382 328,361 328,319" fill="url(#about-purple)" stroke="url(#about-purple)" stroke-width="10" stroke-linejoin="round"/>
          </g>
          <rect x="32" y="32" width="448" height="448" rx="36" ry="36" fill="none" stroke="#3b4559" stroke-width="3"/>
          <line x1="30.5" y1="76" x2="481.5" y2="76" stroke="#3b4559" stroke-width="3" clip-path="url(#about-frameClip)"/>
        </svg>
      </div>

      <h2 class="app-name">{t('app.name')}</h2>
      <p class="version">{t('dialog.about.version', { version: __APP_VERSION__ })}</p>
      <p class="tagline">{t('dialog.about.description')}</p>

      <div class="divider"></div>

      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">{t('dialog.about.author')}</span>
          <span class="meta-value">Afroze Amjad (<button class="link" onclick={() => openUrl('https://github.com/afroze9')}>afroze9</button>)</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{t('dialog.about.builtWith')}</span>
          <span class="meta-value">{t('dialog.about.techStack')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{t('dialog.about.license')}</span>
          <span class="meta-value">AGPL-3.0 (Community)</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{t('dialog.about.source')}</span>
          <span class="meta-value"><button class="link" onclick={() => openUrl('https://github.com/afroze9/terrastudio')}>{t('dialog.about.github')}</button></span>
        </div>
      </div>

      <div class="divider"></div>

      <button class="toggle-btn" onclick={() => showThirdParty = !showThirdParty}>
        <span class="toggle-arrow" class:expanded={showThirdParty}>&#9654;</span>
        Third-Party Licenses
      </button>

      {#if showThirdParty}
        <div class="third-party">
          {#each thirdPartyDeps as dep}
            <div class="dep-row">
              <span class="dep-name">{dep.name}</span>
              <span class="dep-license">{dep.license}</span>
            </div>
          {/each}
        </div>
      {/if}

      <button class="ok-btn" onclick={onclose}>{t('dialog.confirm.ok')}</button>
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
    font-size: var(--font-18);
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
    font-size: var(--font-18);
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 4px;
    letter-spacing: 0.01em;
  }

  .version {
    font-size: var(--font-12);
    color: var(--color-text-muted);
    margin: 0 0 12px;
  }

  .tagline {
    font-size: var(--font-12);
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
    font-size: var(--font-12);
  }

  .meta-label {
    color: var(--color-text-muted);
  }

  .meta-value {
    color: var(--color-text);
    font-weight: 500;
  }

  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-accent);
    font-weight: 400;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    cursor: pointer;
    padding: 0;
    margin-bottom: 12px;
    transition: color 0.1s;
  }
  .toggle-btn:hover {
    color: var(--color-text);
  }

  .toggle-arrow {
    font-size: 8px;
    transition: transform 0.15s;
    display: inline-block;
  }
  .toggle-arrow.expanded {
    transform: rotate(90deg);
  }

  .third-party {
    max-height: 160px;
    overflow-y: auto;
    margin-bottom: 16px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 8px;
  }

  .dep-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    padding: 3px 0;
  }
  .dep-row:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .dep-name {
    color: var(--color-text);
    font-weight: 500;
  }

  .dep-license {
    color: var(--color-text-muted);
    font-size: 10px;
  }

  .ok-btn {
    width: 100%;
    padding: 8px;
    background: var(--color-accent);
    color: var(--color-accent-text);
    border: none;
    border-radius: 5px;
    font-size: var(--font-13);
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .ok-btn:hover {
    opacity: 0.85;
  }
</style>

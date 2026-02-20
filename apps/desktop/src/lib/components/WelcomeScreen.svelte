<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openProject, loadProjectByPath } from '$lib/services/project-service';
  import WindowControls from './WindowControls.svelte';

  let { onNewProject }: { onNewProject: () => void } = $props();

  interface RecentProject {
    name: string;
    path: string;
    opened_at: number;
  }

  let recentProjects = $state<RecentProject[]>([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      recentProjects = await invoke<RecentProject[]>('get_recent_projects');
    } catch {
      // Silently fail — empty list is fine
    } finally {
      loading = false;
    }
  });

  function formatRelativeTime(epochMs: number): string {
    const now = Date.now();
    const diff = now - epochMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'Just now';
  }

  async function handleOpenRecent(path: string) {
    error = '';
    try {
      await loadProjectByPath(path);
    } catch (e) {
      error = `Failed to open project: ${e}`;
      // Remove broken entry from list
      await invoke('remove_recent_project', { path });
      recentProjects = recentProjects.filter((p) => p.path !== path);
    }
  }

  async function handleRemoveRecent(e: MouseEvent, path: string) {
    e.stopPropagation();
    await invoke('remove_recent_project', { path });
    recentProjects = recentProjects.filter((p) => p.path !== path);
  }

  async function handleOpenProject() {
    error = '';
    try {
      await openProject();
    } catch {
      // User cancelled or error
    }
  }
</script>

<div class="welcome">
  <div class="welcome-titlebar" data-tauri-drag-region>
    <svg class="titlebar-icon" width="16" height="16" viewBox="0 0 512 512" data-tauri-drag-region>
      <line x1="256" y1="128" x2="128" y2="340" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
      <line x1="256" y1="128" x2="384" y2="340" stroke="#5eead4" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
      <line x1="128" y1="340" x2="384" y2="340" stroke="#a855f7" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
      <rect x="206" y="78" width="100" height="100" rx="22" fill="#3b82f6"/>
      <circle cx="128" cy="340" r="54" fill="#14b8a6"/>
      <polygon points="384,290 424,313 424,367 384,390 344,367 344,313" fill="#9333ea" stroke="#9333ea" stroke-width="14" stroke-linejoin="round"/>
    </svg>
    <span class="welcome-logo" data-tauri-drag-region>TerraStudio</span>
    <div class="titlebar-spacer" data-tauri-drag-region></div>
    <WindowControls />
  </div>
  <div class="welcome-inner">
    <div class="recent-section">
      <h2 class="section-title">Recent Projects</h2>
      {#if loading}
        <div class="empty-state">Loading...</div>
      {:else if recentProjects.length === 0}
        <div class="empty-state">
          <p class="empty-title">No recent projects</p>
          <p class="empty-sub">Create a new project or open an existing one to get started.</p>
        </div>
      {:else}
        <div class="project-list">
          {#each recentProjects as proj}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="project-card"
              onclick={() => handleOpenRecent(proj.path)}
            >
              <div class="project-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="project-info">
                <span class="project-name">{proj.name}</span>
                <span class="project-path">{proj.path}</span>
                <span class="project-time">{formatRelativeTime(proj.opened_at)}</span>
              </div>
              <button
                class="remove-btn"
                onclick={(e) => handleRemoveRecent(e, proj.path)}
                title="Remove from recents"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="actions-section">
      <div class="branding">
        <svg class="hero-icon" width="48" height="48" viewBox="0 0 512 512">
          <line x1="256" y1="128" x2="128" y2="340" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
          <line x1="256" y1="128" x2="384" y2="340" stroke="#5eead4" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
          <line x1="128" y1="340" x2="384" y2="340" stroke="#a855f7" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
          <rect x="206" y="78" width="100" height="100" rx="22" fill="#3b82f6"/>
          <circle cx="128" cy="340" r="54" fill="#14b8a6"/>
          <polygon points="384,290 424,313 424,367 384,390 344,367 344,313" fill="#9333ea" stroke="#9333ea" stroke-width="14" stroke-linejoin="round"/>
        </svg>
        <h1 class="app-title">TerraStudio</h1>
        <p class="app-subtitle">Visual infrastructure diagram builder</p>
        <p class="app-desc">Design Azure architectures visually and generate Terraform configurations.</p>
      </div>

      <div class="action-buttons">
        <button class="action-btn action-btn-primary" onclick={onNewProject}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Project
        </button>
        <button class="action-btn" onclick={handleOpenProject}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Open Project
        </button>
      </div>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    background: var(--color-bg);
  }

  .titlebar-icon {
    flex-shrink: 0;
    margin-left: 12px;
    margin-right: 6px;
  }
  .welcome-logo {
    font-weight: 700;
    font-size: 12px;
    letter-spacing: -0.02em;
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .titlebar-spacer {
    flex: 1;
  }
  .welcome-titlebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 30px;
    width: 100%;
    -webkit-app-region: drag;
    z-index: 10;
  }

  .welcome-inner {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    max-width: 900px;
    width: 100%;
    padding: 48px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 16px;
  }

  .empty-state {
    padding: 32px 0;
    text-align: center;
  }

  .empty-title {
    font-size: 14px;
    color: var(--color-text-muted);
    margin: 0 0 8px;
  }

  .empty-sub {
    font-size: 12px;
    color: var(--color-text-muted);
    opacity: 0.7;
    margin: 0;
  }

  .project-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;
  }

  .project-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
    color: inherit;
    font-family: inherit;
  }

  .project-card:hover {
    background: var(--color-surface);
    border-color: var(--color-border);
  }

  .project-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    border-radius: 6px;
    color: var(--color-accent);
  }

  .project-card:hover .project-icon {
    background: var(--color-surface-hover);
  }

  .project-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .project-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .project-path {
    font-size: 11px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-time {
    font-size: 11px;
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .remove-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .project-card:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    background: var(--color-surface-hover);
    color: #ef4444;
  }

  .actions-section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 32px;
  }

  .branding {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hero-icon {
    margin-bottom: 4px;
  }
  .app-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-accent);
    margin: 0;
  }

  .app-subtitle {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text);
    margin: 0;
  }

  .app-desc {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .action-btn:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-accent);
  }

  .action-btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .action-btn-primary:hover {
    background: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
  }

  .error-msg {
    padding: 10px 14px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 12px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { createProject, pickFolder } from '$lib/services/project-service';
  import { registry } from '$lib/bootstrap';
  import { getTemplateCategories } from '$lib/templates/service';
  import type { Template, TemplateCategory } from '$lib/templates/types';

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

  let categories = $state<TemplateCategory[]>([]);
  let activeCategory = $state('');
  let selectedTemplate = $state<Template | null>(null);
  let loadingTemplates = $state(true);

  let allTemplates = $derived(() => {
    const seen = new Set<string>();
    const result: Template[] = [];
    for (const c of categories) {
      for (const t of c.templates) {
        if (!seen.has(t.metadata.id)) {
          seen.add(t.metadata.id);
          result.push(t);
        }
      }
    }
    return result;
  });

  let visibleTemplates = $derived(
    activeCategory
      ? categories.find((c) => c.name === activeCategory)?.templates ?? []
      : allTemplates(),
  );

  $effect(() => {
    if (open) {
      loadTemplates();
      if (!folderPath) loadLastLocation();
    }
  });

  async function loadTemplates() {
    loadingTemplates = true;
    try {
      categories = await getTemplateCategories(registry);
      // Default select the blank template
      const blank = categories
        .flatMap((c) => c.templates)
        .find((t) => t.metadata.id === 'blank');
      selectedTemplate = blank ?? categories[0]?.templates[0] ?? null;
      activeCategory = '';
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      loadingTemplates = false;
    }
  }

  async function loadLastLocation() {
    try {
      const saved = await invoke<string | null>('get_last_project_location');
      if (saved) folderPath = saved;
    } catch {
      // Not available — that's fine
    }
  }

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
    if (!selectedTemplate) {
      error = 'Please select a template';
      return;
    }

    creating = true;
    try {
      await createProject(projectName.trim(), folderPath, selectedTemplate);
      invoke('set_last_project_location', { location: folderPath }).catch(() => {});
      projectName = '';
      folderPath = '';
      selectedTemplate = null;
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
    selectedTemplate = null;
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && projectName && folderPath && selectedTemplate) handleCreate();
  }

  async function handleOpenTemplatesFolder() {
    try {
      await invoke('open_templates_folder');
    } catch (e) {
      console.error('Failed to open templates folder:', e);
    }
  }

  const iconMap: Record<string, string> = {
    blank: `<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2" /><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
    web: `<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M2 12h20M12 2c-3 3-3 7 0 10s3 7 0 10" fill="none" stroke="currentColor" stroke-width="1.5" />`,
    network: `<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><circle cx="5" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><circle cx="19" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M12 7.5v4M8.5 17.5l2-4M15.5 17.5l-2-4" stroke="currentColor" stroke-width="1.5" />`,
    database: `<ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" fill="none" stroke="currentColor" stroke-width="1.5" />`,
    security: `<path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`,
    compute: `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 9h6v6H9z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
  };

  function getIconSvg(icon: string): string {
    return iconMap[icon] || iconMap['blank'];
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onkeydown={handleKeydown} onclick={handleCancel}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="dialog-title">New Project</h2>

      <!-- Template Gallery -->
      <div class="template-section">
        <div class="category-tabs">
          <button
            class="tab"
            class:active={activeCategory === ''}
            onclick={() => (activeCategory = '')}
          >
            All
          </button>
          {#each categories as cat}
            <button
              class="tab"
              class:active={activeCategory === cat.name}
              onclick={() => (activeCategory = cat.name)}
            >
              {cat.name}
            </button>
          {/each}
          <div class="tab-spacer"></div>
          <button class="tab tab-action" onclick={handleOpenTemplatesFolder} title="Open user templates folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Import
          </button>
        </div>

        <div class="template-grid">
          {#if loadingTemplates}
            <div class="loading">Loading templates...</div>
          {:else}
            {#each visibleTemplates as template}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="template-card"
                class:selected={selectedTemplate?.metadata.id === template.metadata.id}
                onclick={() => (selectedTemplate = template)}
              >
                <div class="template-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    {@html getIconSvg(template.metadata.icon)}
                  </svg>
                </div>
                <div class="template-info">
                  <div class="template-name">{template.metadata.name}</div>
                  <div class="template-desc">{template.metadata.description}</div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Project Details -->
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
          Will create: <code>{folderPath}{folderPath.includes('\\') ? '\\' : '/'}{projectName.trim()}</code>
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
          disabled={creating || !projectName.trim() || !folderPath || !selectedTemplate}
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
    width: 700px;
    max-width: 90vw;
    max-height: 85vh;
    overflow-y: auto;
  }
  .dialog-title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  /* Template Section */
  .template-section {
    margin-bottom: 20px;
  }
  .category-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0;
    overflow-x: auto;
    align-items: center;
  }
  .tab {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    margin-bottom: -1px;
  }
  .tab:hover {
    color: var(--color-text);
  }
  .tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  .tab-spacer {
    flex: 1;
  }
  .tab-action {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .tab-action:hover {
    color: var(--color-accent);
  }
  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
    max-height: 220px;
    overflow-y: auto;
    padding: 2px;
  }
  .loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .template-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .template-card:hover {
    border-color: var(--color-text-muted);
    background: var(--color-surface-hover);
  }
  .template-card.selected {
    border-color: var(--color-accent);
    background: var(--color-surface-hover);
  }
  .template-icon {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
  }
  .template-card.selected .template-icon {
    color: var(--color-accent);
  }
  .template-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .template-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }
  .template-desc {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Project Details */
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

<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { generateThumbnailPng } from '$lib/services/export-service';
  import type { Template } from '$lib/templates/types';

  let { open, onclose, onsaved }: {
    open: boolean;
    onclose: () => void;
    onsaved?: () => void;
  } = $props();

  // ── Form state ────────────────────────────────────────────────────────────
  let name        = $state(project.name || '');
  let id          = $state('');
  let description = $state('');
  let category    = $state('My Templates');
  let icon        = $state('blank');
  let saving      = $state(false);
  let error       = $state('');
  let idTouched   = $state(false);

  const SUGGESTED_CATEGORIES = [
    'Getting Started',
    'Web Applications',
    'Networking',
    'Compute',
    'Security',
    'Databases',
    'Serverless',
    'My Templates',
  ];

  const ICONS = [
    { value: 'blank',    label: 'Blank'     },
    { value: 'web',      label: 'Web'       },
    { value: 'network',  label: 'Network'   },
    { value: 'database', label: 'Database'  },
    { value: 'security', label: 'Security'  },
    { value: 'compute',  label: 'Compute'   },
  ];

  // Auto-generate id from name (unless user has edited it manually)
  $effect(() => {
    if (!idTouched && name) {
      id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
  });

  // Reset when dialog opens
  $effect(() => {
    if (open) {
      name        = project.name || '';
      id          = '';
      idTouched   = false;
      description = '';
      category    = 'My Templates';
      icon        = 'blank';
      saving      = false;
      error       = '';
    }
  });

  async function handleSave() {
    error = '';

    // Validation
    if (!name.trim()) { error = 'Template name is required'; return; }
    if (!id.trim())   { error = 'Template ID is required'; return; }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
      error = 'ID must start with a letter or digit and contain only lowercase letters, numbers, hyphens, and underscores';
      return;
    }
    if (!category.trim()) { error = 'Category is required'; return; }

    saving = true;
    try {
      // Generate thumbnail from the live canvas
      const thumbnail = await generateThumbnailPng();

      // Build the template object from the current diagram
      const rawNodes = JSON.parse(JSON.stringify(diagram.nodes));
      const rawEdges = JSON.parse(JSON.stringify(diagram.edges));
      // Assign stable template-prefixed IDs so the file is deterministic
      const idMap = new Map<string, string>();
      rawNodes.forEach((node: any, i: number) => {
        const tmplId = `tmpl-${i}`;
        idMap.set(node.id, tmplId);
        node.id = tmplId;
      });
      rawNodes.forEach((node: any) => {
        if (node.parentId && idMap.has(node.parentId)) node.parentId = idMap.get(node.parentId);
        if (node.data?.references) {
          for (const key of Object.keys(node.data.references)) {
            if (idMap.has(node.data.references[key])) {
              node.data.references[key] = idMap.get(node.data.references[key]);
            }
          }
        }
      });
      rawEdges.forEach((edge: any, i: number) => {
        if (idMap.has(edge.source)) edge.source = idMap.get(edge.source);
        if (idMap.has(edge.target)) edge.target = idMap.get(edge.target);
        edge.id = `tmpl-edge-${i}`;
      });

      const template: Template = {
        templateVersion: 1,
        metadata: {
          id: id.trim(),
          name: name.trim(),
          description: description.trim(),
          categories: [category.trim()],
          icon,
          ...(thumbnail ? { thumbnail } : {}),
        },
        diagram: { nodes: rawNodes, edges: rawEdges },
      };

      await invoke('save_user_template', {
        category: category.trim(),
        id: id.trim(),
        json: JSON.stringify(template, null, 2),
      });

      onsaved?.();
      onclose();
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Save as Template">
      <div class="dialog-header">
        <h2 class="dialog-title">Save as Template</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Name -->
        <div class="field">
          <label class="field-label" for="tmpl-name">Template Name <span class="required">*</span></label>
          <input
            id="tmpl-name"
            type="text"
            class="field-input"
            placeholder="e.g. Three-Tier Web App"
            bind:value={name}
          />
        </div>

        <!-- ID -->
        <div class="field">
          <label class="field-label" for="tmpl-id">
            ID <span class="required">*</span>
            <span class="field-hint">used as filename — lowercase, hyphens only</span>
          </label>
          <input
            id="tmpl-id"
            type="text"
            class="field-input"
            placeholder="e.g. three-tier-web-app"
            bind:value={id}
            oninput={() => (idTouched = true)}
          />
        </div>

        <!-- Description -->
        <div class="field">
          <label class="field-label" for="tmpl-desc">Description</label>
          <textarea
            id="tmpl-desc"
            class="field-textarea"
            placeholder="What does this template do?"
            rows="2"
            bind:value={description}
          ></textarea>
        </div>

        <!-- Category + Icon side by side -->
        <div class="row-fields">
          <div class="field flex2">
            <label class="field-label" for="tmpl-cat">Category <span class="required">*</span></label>
            <input
              id="tmpl-cat"
              type="text"
              class="field-input"
              list="category-suggestions"
              placeholder="e.g. Web Applications"
              bind:value={category}
            />
            <datalist id="category-suggestions">
              {#each SUGGESTED_CATEGORIES as cat}
                <option value={cat}></option>
              {/each}
            </datalist>
          </div>

          <div class="field flex1">
            <label class="field-label" for="tmpl-icon">Icon</label>
            <select id="tmpl-icon" class="field-select" bind:value={icon}>
              {#each ICONS as ic}
                <option value={ic.value}>{ic.label}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if error}
          <div class="error-msg">{error}</div>
        {/if}
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick={onclose} disabled={saving}>Cancel</button>
        <button class="btn btn-primary" onclick={handleSave} disabled={saving || !name.trim() || !id.trim()}>
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .dialog {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    width: 440px;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .dialog-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .close-btn:hover { background: var(--color-surface-hover); color: var(--color-text); }

  .dialog-body {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .row-fields {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .flex1 { flex: 1; }
  .flex2 { flex: 2; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .field-label {
    font-size: 12px;
    color: var(--color-text-muted);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .required { color: #ef4444; }

  .field-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.6;
    font-style: italic;
  }

  .field-input,
  .field-textarea,
  .field-select {
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    font-family: inherit;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .field-input:focus,
  .field-textarea:focus,
  .field-select:focus { border-color: var(--color-accent); }

  .field-textarea {
    resize: vertical;
    line-height: 1.4;
  }

  .field-select { cursor: pointer; }

  .error-msg {
    padding: 8px 12px;
    border-radius: 5px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 12px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: 7px 18px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: var(--color-surface-hover);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  .btn-secondary:hover:not(:disabled) { color: var(--color-text); }
  .btn-primary {
    background: var(--color-accent);
    color: white;
  }
  .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
</style>

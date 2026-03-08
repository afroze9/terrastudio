<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { project } from '$lib/stores/project.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { generateAndWrite, runTerraformCommand, runTerraformPlan, refreshDeploymentStatus } from '$lib/services/terraform-service';
  import type { TerraformCommand } from '$lib/stores/terraform.svelte';
  import { registry } from '$lib/bootstrap';
  import type { ResourceTypeId, TerraformVariable, PropertySchema } from '@terrastudio/types';
  import { t } from '$lib/i18n';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import SearchBox from './SearchBox.svelte';

  /**
   * Variables derived directly from diagram nodes' variableOverrides.
   * Updates in real-time as the user toggles properties to variable mode —
   * no need to wait for a generation run.
   */
  const diagramVariables = $derived.by((): TerraformVariable[] => {
    const vars: TerraformVariable[] = [];
    for (const node of diagram.nodes) {
      // Skip synthetic/transient nodes
      if (node.id.startsWith('_mod_') || node.id.startsWith('_modinst_') || node.id.startsWith('_instmem_')) continue;
      const overrides = node.data.variableOverrides as Record<string, string> | undefined;
      if (!overrides) continue;
      const schema = registry.getResourceSchema(node.data.typeId as ResourceTypeId);
      if (!schema) continue;
      for (const [propKey, mode] of Object.entries(overrides)) {
        if (mode !== 'variable') continue;
        const propSchema = schema.properties.find((p: PropertySchema) => p.key === propKey);
        if (!propSchema) continue;
        const varName = `${node.data.terraformName}_${propKey}`;
        let varType = 'string';
        if (propSchema.type === 'number') varType = 'number';
        else if (propSchema.type === 'boolean') varType = 'bool';
        const currentValue = node.data.properties[propKey];
        vars.push({
          name: varName,
          type: varType,
          description: `${propSchema.label} for ${node.data.label || node.data.terraformName}`,
          defaultValue: currentValue !== undefined && currentValue !== '' ? currentValue : undefined,
          sensitive: propSchema.sensitive ?? false,
        });
      }
    }
    return vars;
  });

  /**
   * Merged display list: diagram-derived variables are the real-time source of truth.
   * After generation, collectedVariables (from the pipeline) take precedence for any
   * matching names since they carry richer metadata (sensitive flag, actual default).
   */
  const displayVariables = $derived.by((): TerraformVariable[] => {
    if (terraform.collectedVariables.length === 0) return diagramVariables;
    const collectedNames = new Set(terraform.collectedVariables.map(v => v.name));
    const extra = diagramVariables.filter(v => !collectedNames.has(v.name));
    return [...terraform.collectedVariables, ...extra];
  });

  // Debounce timer for auto-regenerate
  let autoRegenTimer: ReturnType<typeof setTimeout> | null = null;

  // Watch for diagram changes when auto-regenerate is enabled
  $effect(() => {
    // Track the filesStale state
    const isStale = terraform.filesStale;
    const autoRegen = terraform.autoRegenerate;
    const isOpen = project.isOpen;
    const hasNodes = diagram.nodes.length > 0;
    const isRunning = terraform.isRunning;
    const isBlocked = terraform.autoRegenBlocked;

    // Use untrack for the regeneration logic to prevent re-triggering
    untrack(() => {
      if (autoRegen && isStale && isOpen && hasNodes && !isRunning && !isBlocked) {
        // Clear any existing timer
        if (autoRegenTimer) {
          clearTimeout(autoRegenTimer);
        }
        // Debounce the regeneration to avoid excessive calls during rapid changes
        autoRegenTimer = setTimeout(async () => {
          autoRegenTimer = null;
          try {
            await generateAndWrite();
          } catch {
            // Block auto-regen until the diagram actually changes
            terraform.autoRegenBlocked = true;
          }
        }, 1000);
      }
    });
  });

  const canGenerate = $derived(
    project.isOpen && diagram.nodes.length > 0 && !terraform.isRunning,
  );
  const canRunCommand = $derived(project.isOpen && terraform.canRun);

  /** Variables that have no default and no user-supplied value */
  const missingRequiredVars = $derived(
    displayVariables.filter(
      (v) =>
        (v.defaultValue === undefined || v.defaultValue === '') &&
        !(project.projectConfig.variableValues[v.name]),
    ),
  );

  // ─── Search ──────────────────────────────────────────────────────────────
  let searchQuery = $state('');

  const filteredFiles = $derived(
    searchQuery.trim()
      ? ui.generatedFiles.filter((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
      : ui.generatedFiles,
  );

  // ─── File tree ─────────────────────────────────────────────────────────
  interface FileTreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children: FileTreeNode[];
  }

  /** Build a nested tree from flat file paths like "modules/net/main.tf" */
  function buildFileTree(files: string[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];

    for (const filePath of files) {
      const parts = filePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        let existing = current.find((n) => n.name === part);
        if (!existing) {
          existing = {
            name: part,
            path: isLast ? filePath : parts.slice(0, i + 1).join('/'),
            isDir: !isLast,
            children: [],
          };
          current.push(existing);
        }
        current = existing.children;
      }
    }

    // Sort: folders first, then files, alphabetically within each group
    function sortNodes(nodes: FileTreeNode[]) {
      nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const n of nodes) {
        if (n.children.length > 0) sortNodes(n.children);
      }
    }
    sortNodes(root);

    return root;
  }

  const fileTree = $derived(buildFileTree(filteredFiles));

  /** Track which folders are expanded (all expanded by default) */
  let expandedFolders = $state(new Set<string>());

  /** Initialize expanded folders when files change */
  $effect(() => {
    const folders = new Set<string>();
    for (const f of ui.generatedFiles) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join('/'));
      }
    }
    expandedFolders = folders;
  });

  function toggleFolder(path: string) {
    const next = new Set(expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    expandedFolders = next;
  }

  const filteredVariables = $derived(
    searchQuery.trim()
      ? displayVariables.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : displayVariables,
  );

  let showVarWarning = $state(false);

  // Debounce timer for variable value changes
  let varDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onVariableValueChange(varName: string, value: unknown) {
    if (varDebounceTimer) clearTimeout(varDebounceTimer);
    varDebounceTimer = setTimeout(() => {
      project.projectConfig.variableValues = {
        ...project.projectConfig.variableValues,
        [varName]: value,
      };
      project.markDirty();
    }, 300);
  }

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

    // Route plan through the plan visualization pipeline
    if (command === 'plan') {
      await runTerraformPlan();
      return;
    }

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

  // ─── Context menu ───────────────────────────────────────────────────────
  let contextMenu = $state<{ x: number; y: number; filename: string } | null>(null);

  function onFileContextMenu(e: MouseEvent, filename: string) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, filename };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function revealFile(filename: string) {
    if (!project.path) return;
    const filePath = `${project.path}/terraform/${filename}`;
    revealItemInDir(filePath);
  }
</script>

<div class="tf-sidebar">
  <SearchBox bind:value={searchQuery} placeholder={t('terraform.panel.searchPlaceholder')} />

  <!-- Generated Files (top, scrollable) -->
  {#if !searchQuery || filteredFiles.length > 0}
    <div class="files-wrapper">
      <CollapsibleSection id="tf-files" label={t('terraform.panel.files')} count={filteredFiles.length} forceExpand={!!searchQuery}>
        {#if ui.generatedFiles.length === 0}
          <p class="empty-hint">{t('terraform.panel.noFiles')}</p>
        {:else if filteredFiles.length === 0}
          <p class="empty-hint">{t('terraform.panel.noFilesMatch')} "{searchQuery}".</p>
        {:else}
          <div class="file-list">
            {#snippet fileTreeNodes(nodes: FileTreeNode[], depth: number)}
              {#each nodes as node (node.path)}
                {#if node.isDir}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="folder-item"
                    style:padding-left="{depth * 12 + 8}px"
                    onclick={() => toggleFolder(node.path)}
                  >
                    <svg class="folder-chevron" class:expanded={expandedFolders.has(node.path)} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <span>{node.name}</span>
                  </div>
                  {#if expandedFolders.has(node.path)}
                    {@render fileTreeNodes(node.children, depth + 1)}
                  {/if}
                {:else}
                  <button
                    class="file-item"
                    style:padding-left="{depth * 12 + 8}px"
                    onclick={() => openFile(node.path)}
                    oncontextmenu={(e) => onFileContextMenu(e, node.path)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>{node.name}</span>
                  </button>
                {/if}
              {/each}
            {/snippet}
            {@render fileTreeNodes(fileTree, 0)}
          </div>
        {/if}
      </CollapsibleSection>
    </div>
  {/if}

  <!-- Variables Section -->
  {#if displayVariables.length > 0 && (!searchQuery || filteredVariables.length > 0)}
    <div class="variables-wrapper">
      <CollapsibleSection id="tf-variables" label={t('terraform.panel.variables')} count={filteredVariables.length} forceExpand={!!searchQuery}>
        {#each filteredVariables as v (v.name)}
          {@const isList = v.type.startsWith('list(')}
          {@const rawValue = project.projectConfig.variableValues[v.name]}
          {@const currentValue = rawValue ?? (isList ? [] : '')}
          {@const hasDefault = v.defaultValue !== undefined && v.defaultValue !== ''}
          {@const hasValue = isList ? (Array.isArray(currentValue) && currentValue.length > 0) : !!currentValue}
          {@const isMissing = !hasDefault && !hasValue}
          <div class="var-row" class:var-missing={isMissing}>
            <div class="var-header">
              <span class="var-name" title={v.name}>{v.name}</span>
              <span class="var-type-badge">{v.type}</span>
            </div>
            {#if hasDefault}
              <span class="var-default">{t('terraform.panel.default')} {Array.isArray(v.defaultValue) ? v.defaultValue.join(', ') : v.defaultValue}</span>
            {/if}
            {#if isList}
              {@const items = Array.isArray(currentValue) ? currentValue as string[] : []}
              <div class="var-list-field">
                {#each items as item, index (index)}
                  <div class="var-list-item">
                    <input
                      type="text"
                      class="var-input"
                      value={item}
                      oninput={(e) => {
                        const updated = [...items];
                        updated[index] = (e.target as HTMLInputElement).value;
                        onVariableValueChange(v.name, updated);
                      }}
                    />
                    <button
                      class="var-list-remove"
                      onclick={() => {
                        const updated = items.filter((_: string, i: number) => i !== index);
                        onVariableValueChange(v.name, updated);
                      }}
                    >&times;</button>
                  </div>
                {/each}
                <button
                  class="var-list-add"
                  onclick={() => onVariableValueChange(v.name, [...items, ''])}
                >{t('terraform.panel.add')}</button>
              </div>
            {:else}
              <input
                type={v.sensitive ? 'password' : 'text'}
                class="var-input"
                placeholder={hasDefault ? String(v.defaultValue) : t('terraform.panel.required')}
                value={currentValue}
                oninput={(e) => onVariableValueChange(v.name, (e.target as HTMLInputElement).value)}
              />
            {/if}
          </div>
        {/each}
      </CollapsibleSection>
    </div>
  {/if}

  <!-- Spacer to push commands to bottom -->
  <div class="spacer"></div>

  {#if showVarWarning}
    <div class="var-warning">
      <span>{t('terraform.panel.missing')} {missingRequiredVars.length} {missingRequiredVars.length > 1 ? t('terraform.panel.requiredVariables') : t('terraform.panel.requiredVariable')}:</span>
      <span class="var-names">{missingRequiredVars.map(v => v.name).join(', ')}</span>
      <div class="var-warning-actions">
        <button class="warn-btn" onclick={forceApply}>{t('terraform.panel.applyAnyway')}</button>
        <button class="warn-btn" onclick={() => (showVarWarning = false)}>{t('terraform.panel.dismiss')}</button>
      </div>
    </div>
  {/if}

  <!-- Stale files warning -->
  {#if terraform.filesStale && ui.generatedFiles.length > 0}
    <div class="stale-warning">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>{t('terraform.panel.diagramChanged')}</span>
    </div>
  {/if}

  <!-- Commands (bottom, no border below last section) -->
  <div class="commands-wrapper">
    <CollapsibleSection id="tf-commands" label={t('terraform.panel.commands')}>
      <div class="cmd-buttons">
        <div class="generate-row">
          <button class="cmd-btn cmd-btn-accent generate-btn" class:cmd-btn-stale={terraform.filesStale && ui.generatedFiles.length > 0} disabled={!canGenerate} onclick={handleGenerate}>
            {#if terraform.filesStale && ui.generatedFiles.length > 0}
              {t('terraform.panel.regenerate')}
            {:else}
              {t('terraform.panel.generate')}
            {/if}
          </button>
          <label class="auto-toggle" title={t('terraform.panel.autoRegenerate')}>
            <input
              type="checkbox"
              checked={terraform.autoRegenerate}
              onchange={(e) => terraform.setAutoRegenerate((e.target as HTMLInputElement).checked)}
            />
            <span class="auto-label">{t('terraform.panel.auto')}</span>
          </label>
        </div>
        <div class="cmd-row">
          <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('init')}>{t('terraform.panel.init')}</button>
          <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('validate')}>{t('terraform.panel.validate')}</button>
        </div>
        <div class="cmd-row">
          <button class="cmd-btn" disabled={!canRunCommand} onclick={() => handleCommand('plan')}>{t('terraform.panel.plan')}</button>
          <button class="cmd-btn cmd-btn-primary" disabled={!canRunCommand} onclick={() => handleCommand('apply')}>{t('terraform.panel.apply')}</button>
        </div>
        <button class="cmd-btn cmd-btn-danger" disabled={!canRunCommand} onclick={() => handleCommand('destroy')}>
          {t('terraform.panel.destroy')}
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
          {t('terraform.panel.refreshStatus')}
        </button>
      </div>
    </CollapsibleSection>
  </div>
</div>

{#if contextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="ctx-backdrop" onclick={closeContextMenu} oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
    <div class="ctx-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
      <button class="ctx-item" onclick={() => { openFile(contextMenu!.filename); closeContextMenu(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        {t('terraform.panel.open')}
      </button>
      <button class="ctx-item" onclick={() => { revealFile(contextMenu!.filename); closeContextMenu(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        {t('terraform.panel.revealInExplorer')}
      </button>
    </div>
  </div>
{/if}

<style>
  .tf-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .files-wrapper {
    flex-shrink: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .variables-wrapper {
    max-height: 200px;
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
    margin-bottom: 8px;
  }
  .spacer {
    flex: 1;
  }
  .commands-wrapper {
    flex-shrink: 0;
  }
  .commands-wrapper :global(.collapsible-section) {
    border-bottom: none;
  }
  .cmd-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .generate-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .generate-btn {
    flex: 1;
  }
  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .auto-toggle:hover {
    background: var(--color-surface-hover);
  }
  .auto-toggle input {
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-accent);
  }
  .auto-toggle:has(input:checked) {
    border-color: rgba(96, 165, 250, 0.4);
    background: rgba(96, 165, 250, 0.08);
  }
  .auto-label {
    font-size: var(--font-10);
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .auto-toggle:has(input:checked) .auto-label {
    color: #60a5fa;
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
    font-size: var(--font-12);
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
    font-size: var(--font-11);
    color: #f59e0b;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .var-names {
    display: block;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: var(--font-10);
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
    font-size: var(--font-10);
    cursor: pointer;
  }
  .warn-btn:hover {
    background: rgba(245, 158, 11, 0.15);
  }
  .empty-hint {
    font-size: var(--font-11);
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
    font-size: var(--font-12);
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
  .folder-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }
  .folder-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .folder-item svg {
    flex-shrink: 0;
    opacity: 0.6;
  }
  .folder-chevron {
    transition: transform 0.15s;
  }
  .folder-chevron.expanded {
    transform: rotate(90deg);
  }
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }
  .ctx-menu {
    position: fixed;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 4px;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 10000;
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
  }
  .ctx-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .ctx-item svg {
    flex-shrink: 0;
    opacity: 0.6;
  }
  .stale-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 4px;
    font-size: var(--font-10);
    color: #f59e0b;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .stale-warning svg {
    flex-shrink: 0;
  }
  .cmd-btn-stale {
    border-color: rgba(245, 158, 11, 0.4) !important;
    color: #f59e0b !important;
    animation: pulse-stale 2s ease-in-out infinite;
  }
  .cmd-btn-stale:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15) !important;
    border-color: rgba(245, 158, 11, 0.5) !important;
  }
  @keyframes pulse-stale {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .var-row {
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .var-row:last-child {
    border-bottom: none;
  }
  .var-missing {
    border-left: 2px solid #f59e0b;
    padding-left: 6px;
  }
  .var-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
    min-width: 0;
  }
  .var-name {
    font-size: var(--font-11);
    font-weight: 500;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .var-type-badge {
    font-size: var(--font-8);
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    font-weight: 500;
  }
  .var-default {
    display: block;
    font-size: var(--font-9);
    color: var(--color-text-muted);
    font-style: italic;
    margin-bottom: 3px;
  }
  .var-input {
    width: 100%;
    padding: 3px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--font-11);
    outline: none;
    box-sizing: border-box;
  }
  .var-input:focus {
    border-color: var(--color-accent);
  }
  .var-list-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .var-list-item {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .var-list-item .var-input {
    flex: 1;
  }
  .var-list-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--font-14);
    padding: 0 2px;
    line-height: 1;
  }
  .var-list-remove:hover {
    color: var(--color-danger, #ef4444);
  }
  .var-list-add {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--font-10);
    padding: 2px 6px;
    margin-top: 2px;
  }
  .var-list-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>

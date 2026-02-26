<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { createProject, pickFolder } from '$lib/services/project-service';
  import { registry } from '$lib/bootstrap';
  import type { ProviderId } from '@terrastudio/types';
  import { getTemplateCategories } from '$lib/templates/service';
  import type { Template, TemplateCategory } from '$lib/templates/types';
  import type { NamingConvention } from '@terrastudio/types';
  import type { LayoutAlgorithm } from '@terrastudio/core';
  import { applyNamingTemplate, buildTokens } from '@terrastudio/core';
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';

  let {
    open = false,
    onclose,
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  // ── Wizard step ────────────────────────────────────────────────────────────
  let step = $state(1);

  // ── Step 1: Template & Details ─────────────────────────────────────────────
  let projectName = $state('');
  let folderPath = $state('');
  let error = $state('');
  let creating = $state(false);

  // Cloud Provider selection
  const CLOUD_PROVIDERS: { id: string; label: string; available: boolean; icon: string }[] = [
    { id: 'azurerm', label: 'Azure',       available: true,  icon: `<path d="M11.5 2L2 19.5h7.5L13 14l4 5.5H22L11.5 2zm0 4l5 7.5H13l-1.5-2L11.5 6z" fill="currentColor"/>` },
    { id: 'aws',     label: 'AWS',         available: false, icon: `<path d="M6.5 14.5c-2 .5-3.5-.5-3.5-2.5S4.5 9 6.5 9.5m11 5c2 .5 3.5-.5 3.5-2.5S17.5 9 15.5 9.5M12 5v14M8 7l4-4 4 4M8 17l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` },
    { id: 'google',  label: 'GCP',         available: false, icon: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 12h4M5 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` },
    { id: 'all',     label: 'Multi-Cloud', available: true,  icon: `<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3a9 9 0 0 1 9 9M12 3a9 9 0 0 0-9 9m9-9v2m0 16v-2m9-7h-2M5 12H3m12.2-5.2-1.4 1.4M8.2 15.8 6.8 17.2M17.2 15.8l-1.4-1.4M8.2 8.2 6.8 6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` },
  ];
  let selectedProvider = $state<string>('azurerm');

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

  // ── Step 2: Configuration ──────────────────────────────────────────────────

  // Naming convention
  const CONV_PRESETS = [
    { label: 'CAF Standard', template: '{type}-{env}-{name}' },
    { label: 'CAF + Region', template: '{type}-{env}-{region}-{name}' },
    { label: 'Org Prefix',   template: '{org}-{type}-{env}-{name}' },
  ];
  let conventionEnabled = $state(false);
  let conventionTemplate = $state('{type}-{env}-{name}');
  let conventionEnv = $state('dev');
  let conventionRegion = $state('');
  let conventionOrg = $state('');

  // Layout
  let layoutAlgorithm = $state<LayoutAlgorithm>('dagre');

  // Edge style
  let edgeStyle = $state<EdgeStyle>('default');

  // Derived previews
  let convPreviewExamples = $derived.by(() => {
    if (!conventionEnabled) return [];
    const conv = { enabled: true, template: conventionTemplate, env: conventionEnv || 'dev', region: conventionRegion || undefined, org: conventionOrg || undefined };
    return [
      { abbr: 'app', slug: 'api', label: 'App Service' },
      { abbr: 'st',  slug: 'data', label: 'Storage', noHyphens: true, lowercase: true, maxLength: 24 },
      { abbr: 'vm',  slug: 'main', label: 'Virtual Machine' },
    ].map(({ abbr, slug, label, ...constraints }) => {
      const tokens = buildTokens(conv, abbr, slug);
      const constraintObj = Object.keys(constraints).length ? constraints as { lowercase?: boolean; noHyphens?: boolean; maxLength?: number } : undefined;
      return { label, result: applyNamingTemplate(conventionTemplate, tokens, constraintObj) };
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  $effect(() => {
    if (open) {
      step = 1;
      error = '';
      loadTemplates();
      if (!folderPath) loadLastLocation();
    }
  });

  async function loadTemplates() {
    loadingTemplates = true;
    try {
      categories = await getTemplateCategories(registry);
      const blank = categories.flatMap((c) => c.templates).find((t) => t.metadata.id === 'blank');
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
    } catch { /* not available */ }
  }

  async function handlePickFolder() {
    const selected = await pickFolder();
    if (selected) folderPath = selected;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goNext() {
    error = '';
    if (!projectName.trim()) { error = 'Project name is required'; return; }
    if (!folderPath)          { error = 'Please select a folder'; return; }
    if (!selectedTemplate)    { error = 'Please select a template'; return; }
    step = 2;
  }

  function goBack() {
    error = '';
    step = 1;
  }

  async function handleCreate() {
    error = '';
    creating = true;
    try {
      const namingConvention: NamingConvention | undefined = conventionEnabled
        ? { enabled: true, template: conventionTemplate, env: conventionEnv, region: conventionRegion || undefined, org: conventionOrg || undefined }
        : undefined;

      ui.setEdgeType(edgeStyle);
      const activeProviders: ProviderId[] | undefined = selectedProvider === 'all'
        ? undefined
        : [selectedProvider as ProviderId];
      await createProject(projectName.trim(), folderPath, selectedTemplate!, namingConvention, layoutAlgorithm, activeProviders);
      invoke('set_last_project_location', { location: folderPath }).catch(() => {});
      resetState();
      onclose();
    } catch (e) {
      error = String(e);
    } finally {
      creating = false;
    }
  }

  function handleCancel() {
    resetState();
    onclose();
  }

  function resetState() {
    projectName = '';
    folderPath = '';
    error = '';
    selectedTemplate = null;
    conventionEnabled = false;
    conventionEnv = 'dev';
    conventionRegion = '';
    conventionOrg = '';
    layoutAlgorithm = 'dagre';
    edgeStyle = 'default';
    selectedProvider = 'azurerm';
    step = 1;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter') {
      if (step === 1 && projectName && folderPath && selectedTemplate) goNext();
      else if (step === 2 && !creating) handleCreate();
    }
  }

  async function handleOpenTemplatesFolder() {
    try { await invoke('open_templates_folder'); } catch {}
  }

  const iconMap: Record<string, string> = {
    blank:    `<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2" /><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
    web:      `<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M2 12h20M12 2c-3 3-3 7 0 10s3 7 0 10" fill="none" stroke="currentColor" stroke-width="1.5" />`,
    network:  `<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><circle cx="5" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><circle cx="19" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M12 7.5v4M8.5 17.5l2-4M15.5 17.5l-2-4" stroke="currentColor" stroke-width="1.5" />`,
    database: `<ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" fill="none" stroke="currentColor" stroke-width="1.5" />`,
    security: `<path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`,
    compute:  `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 9h6v6H9z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
  };

  function getIconSvg(icon: string): string {
    return iconMap[icon] || iconMap['blank'];
  }

  // Edge style definitions
  const EDGE_STYLES: { value: EdgeStyle; label: string; desc: string; path: string }[] = [
    {
      value: 'default',
      label: 'Bezier',
      desc: 'Smooth curves',
      path: 'M 6,24 C 20,24 28,8 42,8',
    },
    {
      value: 'smoothstep',
      label: 'Smooth Step',
      desc: 'Rounded corners',
      path: 'M 6,24 L 16,24 Q 24,24 24,16 L 24,8 Q 24,8 32,8 L 42,8',
    },
    {
      value: 'step',
      label: 'Step',
      desc: 'Right angles',
      path: 'M 6,24 L 24,24 L 24,8 L 42,8',
    },
    {
      value: 'straight',
      label: 'Straight',
      desc: 'Direct line',
      path: 'M 6,24 L 42,8',
    },
  ];

  const LAYOUT_OPTIONS: { value: LayoutAlgorithm; label: string; desc: string; icon: string }[] = [
    {
      value: 'dagre',
      label: 'Dagre',
      desc: 'Hierarchical layout based on connections',
      icon: `<circle cx="12" cy="4" r="2" fill="currentColor"/><circle cx="6" cy="14" r="2" fill="currentColor"/><circle cx="18" cy="14" r="2" fill="currentColor"/><circle cx="12" cy="22" r="2" fill="currentColor"/><path d="M12 6v6M10 8l-4 4M14 8l4 4M8 16l4 4M16 16l-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
    },
    {
      value: 'hybrid',
      label: 'Hybrid Grid',
      desc: 'Grid layout with reference-aware clustering',
      icon: `<rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="14" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6h4M6 10v4M18 10v4M10 18h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
    },
  ];
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onkeydown={handleKeydown} onclick={handleCancel}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>

      <!-- Step indicator -->
      <div class="step-indicator">
        <div class="step" class:active={step === 1} class:done={step > 1}>
          <div class="step-circle">{step > 1 ? '✓' : '1'}</div>
          <span class="step-label">Template & Details</span>
        </div>
        <div class="step-connector" class:done={step > 1}></div>
        <div class="step" class:active={step === 2}>
          <div class="step-circle">2</div>
          <span class="step-label">Configuration</span>
        </div>
      </div>

      <!-- ── STEP 1 ──────────────────────────────────────────────────────── -->
      {#if step === 1}
        <div class="step-content">
          <!-- Cloud Provider -->
          <div class="provider-section">
            <div class="section-label">Cloud Provider</div>
            <div class="provider-grid">
              {#each CLOUD_PROVIDERS as provider}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="provider-card"
                  class:selected={selectedProvider === provider.id}
                  class:unavailable={!provider.available}
                  onclick={() => { if (provider.available) selectedProvider = provider.id; }}
                >
                  <div class="provider-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">{@html provider.icon}</svg>
                  </div>
                  <div class="provider-label">{provider.label}</div>
                  {#if !provider.available}
                    <div class="provider-soon">Soon</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Template Gallery -->
          <div class="template-section">
            <div class="section-label">Template</div>
            <div class="category-tabs">
              <button class="tab" class:active={activeCategory === ''} onclick={() => (activeCategory = '')}>All</button>
              {#each categories as cat}
                <button class="tab" class:active={activeCategory === cat.name} onclick={() => (activeCategory = cat.name)}>{cat.name}</button>
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
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{@html getIconSvg(template.metadata.icon)}</svg>
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

          <!-- Project Name -->
          <div class="field">
            <label class="field-label" for="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              class="field-input"
              placeholder="my-infrastructure"
              bind:value={projectName}
            />
          </div>

          <!-- Location -->
          <div class="field">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="field-label">Location</label>
            <div class="folder-picker">
              <span class="folder-path">{folderPath || 'No folder selected'}</span>
              <button class="browse-btn" onclick={handlePickFolder}>Browse</button>
            </div>
          </div>

          {#if folderPath && projectName}
            <div class="path-preview">
              Will create: <code>{folderPath}{folderPath.includes('\\') ? '\\' : '/'}{projectName.trim()}</code>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ── STEP 2 ──────────────────────────────────────────────────────── -->
      {#if step === 2}
        <div class="step-content step2-content">

          <!-- Naming Convention -->
          <div class="config-section">
            <div class="config-section-header">
              <div class="config-section-title">Naming Convention</div>
              <label class="toggle-inline">
                <input type="checkbox" bind:checked={conventionEnabled} />
                <span class="toggle-text">{conventionEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            {#if !conventionEnabled}
              <p class="section-hint">Enable to auto-generate names like <code>asp-dev-myapi</code> from a configurable template.</p>
            {:else}
              <div class="preset-row">
                {#each CONV_PRESETS as preset}
                  <button
                    class="preset-btn"
                    class:active={conventionTemplate === preset.template}
                    onclick={() => (conventionTemplate = preset.template)}
                  >{preset.label}</button>
                {/each}
              </div>

              <div class="conv-tokens">
                <div class="conv-field">
                  <span class="conv-label">Environment <span class="required">*</span></span>
                  <input type="text" class="conv-input" placeholder="dev" bind:value={conventionEnv} />
                </div>
                <div class="conv-field">
                  <span class="conv-label">Region <span class="optional">(optional)</span></span>
                  <input type="text" class="conv-input" placeholder="eus2" bind:value={conventionRegion} />
                </div>
                <div class="conv-field">
                  <span class="conv-label">Org <span class="optional">(optional)</span></span>
                  <input type="text" class="conv-input" placeholder="contoso" bind:value={conventionOrg} />
                </div>
              </div>

              {#if convPreviewExamples.length > 0}
                <div class="conv-preview">
                  {#each convPreviewExamples as ex}
                    <div class="conv-preview-row">
                      <span class="conv-preview-label">{ex.label}</span>
                      <span class="conv-preview-result">{ex.result}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>

          <!-- Layout Algorithm -->
          <div class="config-section">
            <div class="config-section-title">Auto Layout</div>
            <div class="option-grid cols-2">
              {#each LAYOUT_OPTIONS as opt}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="option-card"
                  class:selected={layoutAlgorithm === opt.value}
                  onclick={() => (layoutAlgorithm = opt.value)}
                >
                  <div class="option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">{@html opt.icon}</svg>
                  </div>
                  <div class="option-info">
                    <div class="option-label">{opt.label}</div>
                    <div class="option-desc">{opt.desc}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Connection Style -->
          <div class="config-section">
            <div class="config-section-title">Connection Style</div>
            <div class="option-grid cols-4">
              {#each EDGE_STYLES as style}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="option-card edge-card"
                  class:selected={edgeStyle === style.value}
                  onclick={() => (edgeStyle = style.value)}
                >
                  <svg class="edge-preview" viewBox="0 0 48 32" fill="none">
                    <path d={style.path} stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                    <circle cx="6" cy="24" r="3" fill="currentColor" opacity="0.4"/>
                    <circle cx="42" cy="8" r="3" fill="currentColor" opacity="0.4"/>
                  </svg>
                  <div class="option-label">{style.label}</div>
                  <div class="option-desc">{style.desc}</div>
                </div>
              {/each}
            </div>
          </div>

        </div>
      {/if}

      <!-- Error -->
      {#if error}
        <div class="error">{error}</div>
      {/if}

      <!-- Actions -->
      <div class="dialog-actions">
        {#if step === 1}
          <button class="btn btn-secondary" onclick={handleCancel}>Cancel</button>
          <button
            class="btn btn-primary"
            onclick={goNext}
            disabled={!projectName.trim() || !folderPath || !selectedTemplate}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        {:else}
          <button class="btn btn-secondary" onclick={goBack} disabled={creating}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Back
          </button>
          <button class="btn btn-primary" onclick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        {/if}
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
    border-radius: 10px;
    padding: 24px;
    width: 680px;
    max-width: 90vw;
    max-height: 88vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Step Indicator ─────────────────────────────────────────── */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 20px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    border: 1.5px solid var(--color-border);
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .step.active .step-circle {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .step.done .step-circle {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: white;
  }

  .step-label {
    font-size: 12px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .step.active .step-label,
  .step.done .step-label {
    color: var(--color-text);
    font-weight: 500;
  }

  .step-connector {
    flex: 1;
    height: 1px;
    background: var(--color-border);
    margin: 0 10px;
    transition: background 0.15s;
  }

  .step-connector.done {
    background: var(--color-accent);
  }

  /* ── Step Content ───────────────────────────────────────────── */
  .step-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  .step2-content {
    gap: 20px;
  }

  /* ── Provider Section ───────────────────────────────────────── */
  .provider-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .provider-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 8px;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
    text-align: center;
    position: relative;
  }
  .provider-card:hover:not(.unavailable) {
    border-color: var(--color-text-muted);
    background: var(--color-surface-hover);
  }
  .provider-card.selected {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }
  .provider-card.unavailable {
    cursor: default;
    opacity: 0.45;
  }
  .provider-icon {
    color: var(--color-text-muted);
  }
  .provider-card.selected .provider-icon {
    color: var(--color-accent);
  }
  .provider-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text);
  }
  .provider-soon {
    font-size: 9px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 1px 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Template Section ───────────────────────────────────────── */
  .template-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin-bottom: 2px;
  }

  .category-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    align-items: center;
  }

  .tab {
    padding: 5px 12px;
    font-size: 12px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    margin-bottom: -1px;
  }

  .tab:hover { color: var(--color-text); }

  .tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .tab-spacer { flex: 1; }

  .tab-action {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }

  .tab-action:hover { color: var(--color-accent); }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    max-height: 200px;
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
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
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

  .template-card.selected .template-icon { color: var(--color-accent); }

  .template-name {
    font-size: 12px;
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

  /* ── Fields ─────────────────────────────────────────────────── */
  .field { display: flex; flex-direction: column; gap: 6px; }

  .field-label {
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

  .field-input:focus { border-color: var(--color-accent); }

  .folder-picker { display: flex; gap: 8px; align-items: center; }

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

  .browse-btn:hover { background: var(--color-surface-hover); }

  .path-preview {
    padding: 7px 10px;
    border-radius: 4px;
    background: var(--color-bg);
    font-size: 11px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .path-preview code { color: var(--color-accent); }

  /* ── Config Sections (step 2) ───────────────────────────────── */
  .config-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
  }

  .config-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .config-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .toggle-inline {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 11px;
    color: var(--color-text-muted);
    user-select: none;
  }

  .section-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .section-hint code {
    font-size: 11px;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    padding: 1px 4px;
    border-radius: 3px;
  }

  /* Naming convention fields */
  .preset-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .preset-btn:hover { border-color: var(--color-accent); color: var(--color-text); }

  .preset-btn.active {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }

  .conv-tokens {
    display: flex;
    gap: 8px;
  }

  .conv-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .conv-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .required { color: #ef4444; }

  .optional { font-style: italic; }

  .conv-input {
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  .conv-input:focus { border-color: var(--color-accent); }

  .conv-preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .conv-preview-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .conv-preview-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .conv-preview-result {
    font-size: 11px;
    font-family: monospace;
    color: var(--color-accent);
  }

  /* Option cards (layout + edge) */
  .option-grid {
    display: grid;
    gap: 8px;
  }

  .option-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .option-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

  .option-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
    text-align: center;
  }

  .option-card:hover {
    border-color: var(--color-text-muted);
    background: var(--color-surface-hover);
  }

  .option-card.selected {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }

  /* Layout cards have row layout */
  .option-grid.cols-2 .option-card {
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    gap: 10px;
    padding: 12px;
  }

  .option-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .option-card.selected .option-icon { color: var(--color-accent); }

  .option-info { display: flex; flex-direction: column; gap: 2px; }

  .option-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
  }

  .option-desc {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.3;
  }

  .edge-card { gap: 4px; }

  .edge-preview {
    width: 100%;
    height: 32px;
    color: var(--color-text-muted);
  }

  .edge-card.selected .edge-preview { color: var(--color-accent); }

  .edge-card .option-label { font-size: 11px; font-weight: 500; }

  .edge-card .option-desc { font-size: 10px; }

  /* ── Error ──────────────────────────────────────────────────── */
  .error {
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 12px;
  }

  /* ── Actions ────────────────────────────────────────────────── */
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 5px;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid transparent;
    font-weight: 500;
  }

  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }

  .btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover); }

  .btn-primary {
    background: var(--color-accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
</style>

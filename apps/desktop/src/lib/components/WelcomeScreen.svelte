<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openProject, createProject, loadProjectByPath, pickFolder } from '$lib/services/project-service';
  import { registry } from '$lib/bootstrap';
  import { getTemplateCategories } from '$lib/templates/service';
  import type { Template, TemplateCategory } from '$lib/templates/types';
  import type { NamingConvention } from '@terrastudio/types';
  import type { LayoutAlgorithm } from '@terrastudio/core';
  import { applyNamingTemplate, buildTokens } from '@terrastudio/core';
  import { ui, type EdgeStyle } from '$lib/stores/ui.svelte';
  import WindowControls from './WindowControls.svelte';

  // ── View state ─────────────────────────────────────────────────────────────
  type View = 'home' | 'step1' | 'step2';
  let view = $state<View>('home');

  // ── Recent projects ────────────────────────────────────────────────────────
  interface RecentProject { name: string; path: string; opened_at: number; }
  let recentProjects = $state<RecentProject[]>([]);
  let recentLoading = $state(true);
  let homeError = $state('');

  onMount(async () => {
    try {
      recentProjects = await invoke<RecentProject[]>('get_recent_projects');
    } catch { /* empty list is fine */ }
    finally { recentLoading = false; }
  });

  function formatRelativeTime(epochMs: number): string {
    const diff = Date.now() - epochMs;
    const s = Math.floor(diff / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 30) return `${Math.floor(d / 30)}mo ago`;
    if (d > 0)  return `${d}d ago`;
    if (h > 0)  return `${h}h ago`;
    if (m > 0)  return `${m}m ago`;
    return 'Just now';
  }

  async function handleOpenRecent(path: string) {
    homeError = '';
    try {
      await loadProjectByPath(path);
    } catch (e) {
      homeError = `Failed to open: ${e}`;
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
    homeError = '';
    try { await openProject(); } catch { /* user cancelled */ }
  }

  // ── Wizard: Step 1 ─────────────────────────────────────────────────────────
  let projectName = $state('');
  let folderPath = $state('');
  let step1Error = $state('');

  let categories = $state<TemplateCategory[]>([]);
  let activeCategory = $state('');
  let selectedTemplate = $state<Template | null>(null);
  let loadingTemplates = $state(false);

  let allTemplates = $derived(() => {
    const seen = new Set<string>();
    const result: Template[] = [];
    for (const c of categories) {
      for (const t of c.templates) {
        if (!seen.has(t.metadata.id)) { seen.add(t.metadata.id); result.push(t); }
      }
    }
    return result;
  });

  let visibleTemplates = $derived(
    activeCategory
      ? categories.find((c) => c.name === activeCategory)?.templates ?? []
      : allTemplates(),
  );

  async function enterWizard() {
    view = 'step1';
    step1Error = '';
    step2Error = '';
    if (categories.length === 0) {
      loadingTemplates = true;
      try {
        categories = await getTemplateCategories(registry);
        const blank = categories.flatMap((c) => c.templates).find((t) => t.metadata.id === 'blank');
        selectedTemplate = blank ?? categories[0]?.templates[0] ?? null;
      } catch (e) { console.error('Failed to load templates:', e); }
      finally { loadingTemplates = false; }
    }
    if (!folderPath) {
      try {
        const saved = await invoke<string | null>('get_last_project_location');
        if (saved) folderPath = saved;
      } catch { /* ok */ }
    }
  }

  async function handlePickFolder() {
    const selected = await pickFolder();
    if (selected) folderPath = selected;
  }

  function goToStep2() {
    step1Error = '';
    if (!projectName.trim()) { step1Error = 'Project name is required'; return; }
    if (!folderPath)          { step1Error = 'Please select a folder'; return; }
    if (!selectedTemplate)    { step1Error = 'Please select a template'; return; }
    view = 'step2';
  }

  function goBackToStep1() { step2Error = ''; view = 'step1'; }

  function goHome() {
    view = 'home';
    step1Error = '';
    step2Error = '';
  }

  // ── Wizard: Step 2 ─────────────────────────────────────────────────────────
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
  let layoutAlgorithm = $state<LayoutAlgorithm>('dagre');
  let edgeStyle = $state<EdgeStyle>('default');
  let creating = $state(false);
  let step2Error = $state('');

  let convPreviewExamples = $derived.by(() => {
    if (!conventionEnabled) return [];
    const conv = { enabled: true, template: conventionTemplate, env: conventionEnv || 'dev', region: conventionRegion || undefined, org: conventionOrg || undefined };
    return [
      { abbr: 'app', slug: 'api',  label: 'App Service' },
      { abbr: 'st',  slug: 'data', label: 'Storage Account', constraints: { lowercase: true, noHyphens: true, maxLength: 24 } },
      { abbr: 'vm',  slug: 'main', label: 'Virtual Machine' },
    ].map(({ abbr, slug, label, constraints }) => ({
      label,
      result: applyNamingTemplate(conventionTemplate, buildTokens(conv, abbr, slug), constraints),
    }));
  });

  async function handleCreate() {
    step2Error = '';
    creating = true;
    try {
      const namingConvention: NamingConvention | undefined = conventionEnabled
        ? { enabled: true, template: conventionTemplate, env: conventionEnv, region: conventionRegion || undefined, org: conventionOrg || undefined }
        : undefined;
      ui.setEdgeType(edgeStyle);
      await createProject(projectName.trim(), folderPath, selectedTemplate!, namingConvention, layoutAlgorithm);
      invoke('set_last_project_location', { location: folderPath }).catch(() => {});
      resetWizard();
    } catch (e) {
      step2Error = String(e);
    } finally {
      creating = false;
    }
  }

  function resetWizard() {
    projectName = '';
    selectedTemplate = null;
    conventionEnabled = false;
    conventionEnv = 'dev';
    conventionRegion = '';
    conventionOrg = '';
    layoutAlgorithm = 'dagre';
    edgeStyle = 'default';
    step1Error = '';
    step2Error = '';
    view = 'home';
  }

  // ── Template icons ─────────────────────────────────────────────────────────
  const iconMap: Record<string, string> = {
    blank:    `<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    web:      `<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 12h20M12 2c-3 3-3 7 0 10s3 7 0 10" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    network:  `<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.5v4M8.5 17.5l2-4M15.5 17.5l-2-4" stroke="currentColor" stroke-width="1.5"/>`,
    database: `<ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    security: `<path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    compute:  `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 9h6v6H9z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  };
  const getIcon = (icon: string) => iconMap[icon] || iconMap['blank'];

  // ── Option data ────────────────────────────────────────────────────────────
  const EDGE_STYLES: { value: EdgeStyle; label: string; desc: string; path: string }[] = [
    { value: 'default',    label: 'Bezier',      desc: 'Smooth curves',     path: 'M 6,24 C 20,24 28,8 42,8' },
    { value: 'smoothstep', label: 'Smooth Step', desc: 'Rounded corners',   path: 'M 6,24 L 16,24 Q 24,24 24,16 L 24,8 Q 24,8 32,8 L 42,8' },
    { value: 'step',       label: 'Step',        desc: 'Right angles',      path: 'M 6,24 L 24,24 L 24,8 L 42,8' },
    { value: 'straight',   label: 'Straight',    desc: 'Direct line',       path: 'M 6,24 L 42,8' },
  ];

  const LAYOUT_OPTIONS: { value: LayoutAlgorithm; label: string; desc: string; icon: string }[] = [
    {
      value: 'dagre', label: 'Dagre', desc: 'Hierarchical layout based on connections',
      icon: `<circle cx="12" cy="4" r="2" fill="currentColor"/><circle cx="6" cy="14" r="2" fill="currentColor"/><circle cx="18" cy="14" r="2" fill="currentColor"/><circle cx="12" cy="22" r="2" fill="currentColor"/><path d="M12 6v6M10 8l-4 4M14 8l4 4M8 16l4 4M16 16l-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
    },
    {
      value: 'hybrid', label: 'Hybrid Grid', desc: 'Grid layout with reference-aware clustering',
      icon: `<rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="14" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6h4M6 10v4M18 10v4M10 18h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
    },
  ];
</script>

<div class="welcome">
  <!-- Titlebar -->
  <div class="welcome-titlebar" data-tauri-drag-region>
    {#if view !== 'home'}
      <button class="back-btn" onclick={goHome}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        Home
      </button>
    {:else}
      <svg class="titlebar-icon" width="16" height="16" viewBox="0 0 512 512" data-tauri-drag-region>
        <line x1="256" y1="128" x2="128" y2="340" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
        <line x1="256" y1="128" x2="384" y2="340" stroke="#5eead4" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
        <line x1="128" y1="340" x2="384" y2="340" stroke="#a855f7" stroke-width="20" stroke-linecap="round" opacity="0.6"/>
        <rect x="206" y="78" width="100" height="100" rx="22" fill="#3b82f6"/>
        <circle cx="128" cy="340" r="54" fill="#14b8a6"/>
        <polygon points="384,290 424,313 424,367 384,390 344,367 344,313" fill="#9333ea" stroke="#9333ea" stroke-width="14" stroke-linejoin="round"/>
      </svg>
      <span class="welcome-logo" data-tauri-drag-region>TerraStudio</span>
    {/if}
    <div class="titlebar-spacer" data-tauri-drag-region></div>
    <WindowControls />
  </div>

  <!-- ── HOME ──────────────────────────────────────────────────────────────── -->
  {#if view === 'home'}
    <div class="welcome-inner">
      <div class="recent-section">
        <h2 class="section-title">Recent Projects</h2>
        {#if recentLoading}
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
              <div class="project-card" onclick={() => handleOpenRecent(proj.path)}>
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
                <button class="remove-btn" onclick={(e) => handleRemoveRecent(e, proj.path)} title="Remove from recents">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
          <button class="action-btn action-btn-primary" onclick={enterWizard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

        {#if homeError}
          <div class="error-msg">{homeError}</div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── WIZARD ────────────────────────────────────────────────────────────── -->
  {#if view === 'step1' || view === 'step2'}
    <div class="wizard-shell">

      <!-- Step indicator -->
      <div class="step-indicator">
        <div class="step" class:active={view === 'step1'} class:done={view === 'step2'}>
          <div class="step-circle">{view === 'step2' ? '✓' : '1'}</div>
          <span class="step-label">Template &amp; Details</span>
        </div>
        <div class="step-connector" class:done={view === 'step2'}></div>
        <div class="step" class:active={view === 'step2'}>
          <div class="step-circle">2</div>
          <span class="step-label">Configuration</span>
        </div>
      </div>

      <!-- ── Step 1 ─────────────────────────────────────────────────────────── -->
      {#if view === 'step1'}
        <div class="step1-layout">
          <!-- Left: template gallery -->
          <div class="template-col">
            <div class="col-label">Choose a template</div>

            <div class="category-tabs">
              <button class="tab" class:active={activeCategory === ''} onclick={() => (activeCategory = '')}>All</button>
              {#each categories as cat}
                <button class="tab" class:active={activeCategory === cat.name} onclick={() => (activeCategory = cat.name)}>{cat.name}</button>
              {/each}
              <div class="tab-spacer"></div>
              <button class="tab tab-action" onclick={async () => { try { await invoke('open_templates_folder'); } catch {} }} title="Import user templates">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Import
              </button>
            </div>

            <div class="template-grid">
              {#if loadingTemplates}
                <div class="loading">Loading templates...</div>
              {:else}
                {#each visibleTemplates as tmpl}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="template-card"
                    class:selected={selectedTemplate?.metadata.id === tmpl.metadata.id}
                    onclick={() => (selectedTemplate = tmpl)}
                  >
                    <div class="template-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">{@html getIcon(tmpl.metadata.icon)}</svg>
                    </div>
                    <div class="template-info">
                      <div class="template-name">{tmpl.metadata.name}</div>
                      <div class="template-desc">{tmpl.metadata.description}</div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Right: project details -->
          <div class="details-col">
            <div class="col-label">Project details</div>

            <div class="field">
              <label class="field-label" for="proj-name">Name</label>
              <input
                id="proj-name"
                type="text"
                class="field-input"
                placeholder="my-infrastructure"
                bind:value={projectName}
                onkeydown={(e) => e.key === 'Enter' && goToStep2()}
              />
            </div>

            <div class="field">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="field-label">Location</label>
              <div class="folder-picker">
                <span class="folder-path">{folderPath || 'No folder selected'}</span>
                <button class="browse-btn" onclick={handlePickFolder}>Browse</button>
              </div>
            </div>

            {#if folderPath && projectName.trim()}
              <div class="path-preview">
                <code>{folderPath}{folderPath.includes('\\') ? '\\' : '/'}{projectName.trim()}</code>
              </div>
            {/if}

            {#if step1Error}
              <div class="field-error">{step1Error}</div>
            {/if}

            <div class="step-actions">
              <button
                class="wizard-btn wizard-btn-primary"
                onclick={goToStep2}
                disabled={!projectName.trim() || !folderPath || !selectedTemplate}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- ── Step 2 ─────────────────────────────────────────────────────────── -->
      {#if view === 'step2'}
        <div class="step2-layout">

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
              <div class="convention-body">
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
              </div>
            {/if}
          </div>

          <!-- Layout + Connection side-by-side -->
          <div class="options-row">
            <!-- Layout -->
            <div class="config-section flex1">
              <div class="config-section-title">Auto Layout</div>
              <div class="option-grid cols-1">
                {#each LAYOUT_OPTIONS as opt}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div class="option-card" class:selected={layoutAlgorithm === opt.value} onclick={() => (layoutAlgorithm = opt.value)}>
                    <div class="option-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{@html opt.icon}</svg>
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
            <div class="config-section flex2">
              <div class="config-section-title">Connection Style</div>
              <div class="option-grid cols-4">
                {#each EDGE_STYLES as style}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div class="option-card edge-card" class:selected={edgeStyle === style.value} onclick={() => (edgeStyle = style.value)}>
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

          {#if step2Error}
            <div class="field-error">{step2Error}</div>
          {/if}

          <div class="step-actions">
            <button class="wizard-btn wizard-btn-secondary" onclick={goBackToStep1} disabled={creating}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Back
            </button>
            <button class="wizard-btn wizard-btn-primary" onclick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>

        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  /* ── Shell ──────────────────────────────────────────────────────────────── */
  .welcome {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--color-bg);
    overflow: hidden;
  }

  /* ── Titlebar ───────────────────────────────────────────────────────────── */
  .welcome-titlebar {
    position: relative;
    display: flex;
    align-items: center;
    height: 30px;
    width: 100%;
    -webkit-app-region: drag;
    z-index: 10;
    flex-shrink: 0;
  }

  .titlebar-icon { flex-shrink: 0; margin-left: 12px; margin-right: 6px; }
  .welcome-logo { font-weight: 700; font-size: 12px; letter-spacing: -0.02em; color: var(--color-accent); flex-shrink: 0; }
  .titlebar-spacer { flex: 1; }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 4px 10px;
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    -webkit-app-region: no-drag;
  }

  .back-btn:hover { color: var(--color-text); background: var(--color-surface-hover); }

  /* ── Home layout ────────────────────────────────────────────────────────── */
  .welcome-inner {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    max-width: 900px;
    width: 100%;
    padding: 48px;
    margin: auto;
    flex: 1;
    overflow-y: auto;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 16px;
  }

  .empty-state { padding: 32px 0; text-align: center; }
  .empty-title { font-size: 14px; color: var(--color-text-muted); margin: 0 0 8px; }
  .empty-sub { font-size: 12px; color: var(--color-text-muted); opacity: 0.7; margin: 0; }

  .project-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }

  .project-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    color: inherit;
    font-family: inherit;
    background: transparent;
    text-align: left;
    width: 100%;
  }
  .project-card:hover { background: var(--color-surface); border-color: var(--color-border); }

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
  .project-card:hover .project-icon { background: var(--color-surface-hover); }

  .project-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .project-name { font-size: 13px; font-weight: 500; color: var(--color-text); }
  .project-path { font-size: 11px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .project-time { font-size: 11px; color: var(--color-text-muted); opacity: 0.6; }

  .remove-btn {
    flex-shrink: 0;
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border: none; border-radius: 4px;
    background: transparent; color: var(--color-text-muted);
    cursor: pointer; opacity: 0; transition: all 0.15s;
  }
  .project-card:hover .remove-btn { opacity: 1; }
  .remove-btn:hover { background: var(--color-surface-hover); color: #ef4444; }

  .actions-section { display: flex; flex-direction: column; justify-content: center; gap: 32px; }
  .branding { display: flex; flex-direction: column; gap: 8px; }
  .hero-icon { margin-bottom: 4px; }
  .app-title { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-accent); margin: 0; }
  .app-subtitle { font-size: 15px; font-weight: 500; color: var(--color-text); margin: 0; }
  .app-desc { font-size: 13px; color: var(--color-text-muted); margin: 0; line-height: 1.5; }

  .action-buttons { display: flex; flex-direction: column; gap: 10px; }
  .action-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .action-btn:hover { background: var(--color-surface-hover); border-color: var(--color-accent); }
  .action-btn-primary { background: var(--color-accent); border-color: var(--color-accent); color: white; }
  .action-btn-primary:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }
  .error-msg { padding: 10px 14px; border-radius: 6px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 12px; }

  /* ── Wizard shell ───────────────────────────────────────────────────────── */
  .wizard-shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 48px 32px;
    overflow-y: auto;
    gap: 20px;
  }

  /* ── Step indicator ─────────────────────────────────────────────────────── */
  .step-indicator { display: flex; align-items: center; }

  .step { display: flex; align-items: center; gap: 8px; }

  .step-circle {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600;
    border: 1.5px solid var(--color-border);
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .step.active .step-circle { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); }
  .step.done .step-circle { border-color: var(--color-accent); background: var(--color-accent); color: white; }

  .step-label { font-size: 13px; color: var(--color-text-muted); white-space: nowrap; }
  .step.active .step-label, .step.done .step-label { color: var(--color-text); font-weight: 500; }

  .step-connector { flex: 1; height: 1px; background: var(--color-border); margin: 0 12px; transition: background 0.15s; }
  .step-connector.done { background: var(--color-accent); }

  /* ── Step 1: two-column ─────────────────────────────────────────────────── */
  .step1-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 32px;
    flex: 1;
    min-height: 0;
  }

  .template-col, .details-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .col-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .category-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    align-items: center;
  }

  .tab {
    padding: 5px 12px; font-size: 12px;
    color: var(--color-text-muted);
    background: none; border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer; white-space: nowrap; margin-bottom: -1px;
  }
  .tab:hover { color: var(--color-text); }
  .tab.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
  .tab-spacer { flex: 1; }
  .tab-action { display: flex; align-items: center; gap: 4px; font-size: 11px; }
  .tab-action:hover { color: var(--color-accent); }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    padding: 2px;
    max-height: 380px;
  }

  .loading { grid-column: 1/-1; text-align: center; padding: 32px; color: var(--color-text-muted); font-size: 13px; }

  .template-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-surface);
    cursor: pointer; transition: border-color 0.12s, background 0.12s;
  }
  .template-card:hover { border-color: var(--color-text-muted); background: var(--color-surface-hover); }
  .template-card.selected { border-color: var(--color-accent); background: var(--color-surface-hover); }
  .template-icon { color: var(--color-text-muted); display: flex; align-items: center; }
  .template-card.selected .template-icon { color: var(--color-accent); }
  .template-name { font-size: 12px; font-weight: 500; color: var(--color-text); }
  .template-desc { font-size: 11px; color: var(--color-text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* Details column */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 12px; color: var(--color-text-muted); }
  .field-input {
    width: 100%; padding: 8px 12px;
    border: 1px solid var(--color-border); border-radius: 5px;
    background: var(--color-surface); color: var(--color-text); font-size: 13px;
    outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--color-accent); }

  .folder-picker { display: flex; gap: 8px; align-items: center; }
  .folder-path {
    flex: 1; padding: 8px 12px;
    border: 1px solid var(--color-border); border-radius: 5px;
    background: var(--color-surface); color: var(--color-text-muted);
    font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .browse-btn {
    padding: 8px 14px;
    border: 1px solid var(--color-border); border-radius: 5px;
    background: var(--color-surface); color: var(--color-text);
    font-size: 12px; cursor: pointer; flex-shrink: 0;
  }
  .browse-btn:hover { background: var(--color-surface-hover); }

  .path-preview {
    padding: 6px 10px;
    border-radius: 4px; background: var(--color-surface);
    border: 1px solid var(--color-border); font-size: 11px;
    color: var(--color-text-muted); overflow: hidden;
  }
  .path-preview code { color: var(--color-accent); font-size: 11px; word-break: break-all; }

  .field-error { padding: 7px 10px; border-radius: 4px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 12px; }

  /* Navigation buttons */
  .step-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: auto; padding-top: 8px; }

  .wizard-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 20px; border-radius: 5px;
    font-size: 13px; font-weight: 500;
    cursor: pointer; border: 1px solid transparent;
  }
  .wizard-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .wizard-btn-secondary {
    background: var(--color-surface); border-color: var(--color-border); color: var(--color-text-muted);
  }
  .wizard-btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover); }
  .wizard-btn-primary { background: var(--color-accent); color: white; }
  .wizard-btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }

  /* ── Step 2 ─────────────────────────────────────────────────────────────── */
  .step2-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  .options-row { display: flex; gap: 16px; align-items: flex-start; }
  .flex1 { flex: 1; }
  .flex2 { flex: 2; }

  .config-section {
    display: flex; flex-direction: column; gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px; background: var(--color-surface);
  }

  .config-section-header { display: flex; align-items: center; justify-content: space-between; }
  .config-section-title { font-size: 13px; font-weight: 600; color: var(--color-text); }

  .toggle-inline { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; color: var(--color-text-muted); user-select: none; }

  .section-hint { font-size: 12px; color: var(--color-text-muted); margin: 0; line-height: 1.5; }
  .section-hint code { font-size: 11px; color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 10%, transparent); padding: 1px 4px; border-radius: 3px; }

  .convention-body { display: flex; flex-direction: column; gap: 10px; }

  .preset-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .preset-btn {
    padding: 4px 10px; font-size: 11px;
    border: 1px solid var(--color-border); border-radius: 4px;
    background: none; color: var(--color-text-muted); cursor: pointer;
  }
  .preset-btn:hover { border-color: var(--color-accent); color: var(--color-text); }
  .preset-btn.active { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }

  .conv-tokens { display: flex; gap: 10px; }
  .conv-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .conv-label { font-size: 11px; color: var(--color-text-muted); }
  .required { color: #ef4444; }
  .optional { font-style: italic; }
  .conv-input {
    padding: 6px 8px;
    border: 1px solid var(--color-border); border-radius: 4px;
    background: var(--color-bg); color: var(--color-text);
    font-size: 12px; outline: none; width: 100%; box-sizing: border-box;
  }
  .conv-input:focus { border-color: var(--color-accent); }

  .conv-preview {
    display: flex; flex-direction: column; gap: 4px;
    padding: 8px 10px; border-radius: 5px;
    background: var(--color-bg); border: 1px solid var(--color-border);
  }
  .conv-preview-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .conv-preview-label { font-size: 11px; color: var(--color-text-muted); }
  .conv-preview-result { font-size: 11px; font-family: monospace; color: var(--color-accent); }

  .option-grid { display: grid; gap: 8px; }
  .option-grid.cols-1 { grid-template-columns: 1fr; }
  .option-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

  .option-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border: 1.5px solid var(--color-border); border-radius: 6px;
    cursor: pointer; transition: border-color 0.12s, background 0.12s;
  }
  .option-card:hover { border-color: var(--color-text-muted); background: var(--color-surface-hover); }
  .option-card.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }

  .option-icon { color: var(--color-text-muted); flex-shrink: 0; }
  .option-card.selected .option-icon { color: var(--color-accent); }
  .option-info { display: flex; flex-direction: column; gap: 2px; }
  .option-label { font-size: 12px; font-weight: 500; color: var(--color-text); }
  .option-desc { font-size: 11px; color: var(--color-text-muted); line-height: 1.3; }

  /* Edge style cards (column layout) */
  .edge-card { flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 10px 6px; }
  .edge-card .option-label { font-size: 11px; }
  .edge-card .option-desc { font-size: 10px; }

  .edge-preview { width: 100%; height: 28px; color: var(--color-text-muted); }
  .edge-card.selected .edge-preview { color: var(--color-accent); }
</style>

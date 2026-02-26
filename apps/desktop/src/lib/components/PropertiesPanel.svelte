<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { registry } from '$lib/bootstrap';
  import { applyNamingTemplate, extractSlug, sanitizeTerraformName, buildTokens } from '@terrastudio/core';
  import PropertyRenderer from './PropertyRenderer.svelte';
  import SubscriptionPicker from './SubscriptionPicker.svelte';
  import KeyVaultAccessControlSection from './KeyVaultAccessControlSection.svelte';
  import CollapsiblePanelSection from './CollapsiblePanelSection.svelte';
  import EdgeStyleEditor from './EdgeStyleEditor.svelte';
  import type { ResourceTypeId, PropertyVariableMode, AccessModel, AccessGrant, EdgeStyleSettings, EdgeCategoryId } from '@terrastudio/types';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
      : null
  );

  // ─── Naming convention ────────────────────────────────────────────────────

  /** True when a naming convention is active and this resource has a cafAbbreviation */
  let conventionActive = $derived.by(() => {
    const conv = project.projectConfig.namingConvention;
    return !!(conv?.enabled && schema?.cafAbbreviation && schema.properties.some(p => p.key === 'name'));
  });

  // Local state for the slug input — prevents feedback loop from derived values
  let localSlugValue = $state('');
  let lastSelectedNodeId = $state<string | null>(null);

  // Sync local slug from stored name when node selection changes
  $effect(() => {
    const nodeId = diagram.selectedNode?.id ?? null;
    if (nodeId !== lastSelectedNodeId) {
      lastSelectedNodeId = nodeId;
      if (conventionActive && diagram.selectedNode && schema?.cafAbbreviation) {
        const conv = project.projectConfig.namingConvention!;
        const fullName = (diagram.selectedNode.data.properties['name'] as string) ?? '';
        const tokens = buildTokens(conv, schema.cafAbbreviation);
        localSlugValue = extractSlug(fullName, conv.template, tokens, schema.namingConstraints);
      } else {
        localSlugValue = '';
      }
    }
  });

  /** Preview of the full Azure name as the user types */
  let namePreview = $derived.by(() => {
    if (!conventionActive || !schema?.cafAbbreviation) return '';
    const conv = project.projectConfig.namingConvention!;
    const tokens = buildTokens(conv, schema.cafAbbreviation, localSlugValue);
    return applyNamingTemplate(conv.template, tokens, schema.namingConstraints);
  });

  let isSubscription = $derived(schema?.typeId === 'azurerm/core/subscription');
  let isKeyVault = $derived(schema?.typeId === 'azurerm/security/key_vault');

  /** Properties to pass to PropertyRenderer — exclude 'name' when convention is active,
   *  exclude display_name/subscription_id when subscription picker is shown,
   *  exclude access_grants for Key Vault (rendered by custom section) */
  let renderedProperties = $derived.by(() => {
    let props = schema?.properties ?? [];
    if (conventionActive) {
      props = props.filter(p => p.key !== 'name');
    }
    if (isSubscription) {
      props = props.filter(p => p.key !== 'display_name' && p.key !== 'subscription_id');
    }
    if (isKeyVault) {
      props = props.filter(p => p.key !== 'access_model' && p.key !== 'access_grants');
    }
    return props;
  });

  function onConventionNameChange(slug: string) {
    if (!diagram.selectedNode || !schema?.cafAbbreviation) return;
    // Update local state first to prevent feedback loop
    localSlugValue = slug;
    const conv = project.projectConfig.namingConvention!;
    const tokens = buildTokens(conv, schema.cafAbbreviation, slug);
    const fullName = applyNamingTemplate(conv.template, tokens, schema.namingConstraints);
    const newProps = { ...diagram.selectedNode.data.properties, name: fullName };
    const tfName = sanitizeTerraformName(fullName) || diagram.selectedNode.data.terraformName;
    diagram.updateNodeData(diagram.selectedNode.id, {
      properties: newProps,
      label: fullName || schema.displayName,
      terraformName: tfName,
    });
  }

  /** Edges connected to handles with acceptsOutputs (e.g. Key Vault secret-in) */
  let connectedBindings = $derived.by(() => {
    if (!diagram.selectedNode || !schema) return [];
    const acceptHandles = schema.handles.filter((h) => h.acceptsOutputs);
    if (acceptHandles.length === 0) return [];
    const handleIds = new Set(acceptHandles.map((h) => h.id));
    return diagram.edges
      .filter(
        (e) =>
          e.target === diagram.selectedNode!.id &&
          handleIds.has(e.targetHandle ?? ''),
      )
      .map((edge) => {
        const sourceNode = diagram.nodes.find((n) => n.id === edge.source);
        const sourceSchema = sourceNode
          ? registry.getResourceSchema(sourceNode.data.typeId as ResourceTypeId)
          : undefined;
        const attribute = (edge.sourceHandle ?? '').startsWith('out-')
          ? (edge.sourceHandle as string).slice(4)
          : edge.sourceHandle ?? '';
        const outputDef = sourceSchema?.outputs?.find((o) => o.key === attribute);
        return {
          edgeId: edge.id,
          sourceLabel: sourceNode?.data.label ?? 'Unknown',
          attributeLabel: outputDef?.label ?? attribute,
          sensitive: outputDef?.sensitive ?? false,
        };
      });
  });

  // Edge editing: resolve source/target node names for display
  let sourceNode = $derived(
    diagram.selectedEdge
      ? diagram.nodes.find((n) => n.id === diagram.selectedEdge!.source)
      : null
  );
  let targetNode = $derived(
    diagram.selectedEdge
      ? diagram.nodes.find((n) => n.id === diagram.selectedEdge!.target)
      : null
  );

  function toggleOutput(key: string) {
    if (!diagram.selectedNode) return;
    const current = (diagram.selectedNode.data.enabledOutputs as string[]) ?? [];
    const next = current.includes(key)
      ? current.filter((k: string) => k !== key)
      : [...current, key];
    diagram.updateNodeData(diagram.selectedNode.id, { enabledOutputs: next });
  }

  function onPropertyChange(key: string, value: unknown) {
    if (!diagram.selectedNode) return;
    const newProps = { ...diagram.selectedNode.data.properties };
    newProps[key] = value;
    diagram.updateNodeData(diagram.selectedNode.id, {
      properties: newProps,
      label: key === 'name' && typeof value === 'string'
        ? value || schema?.displayName || diagram.selectedNode.data.label
        : diagram.selectedNode.data.label,
    });
  }

  function onReferenceChange(key: string, targetId: string | null) {
    if (!diagram.selectedNode) return;
    const newRefs = { ...diagram.selectedNode.data.references };
    if (targetId) {
      newRefs[key] = targetId;
    } else {
      delete newRefs[key];
    }
    diagram.updateNodeData(diagram.selectedNode.id, { references: newRefs });
  }

  function onVariableModeChange(key: string, mode: PropertyVariableMode) {
    if (!diagram.selectedNode) return;
    const current = diagram.selectedNode.data.variableOverrides ?? {};
    const newOverrides = { ...current, [key]: mode };
    // Clean up if resetting to default (literal)
    if (mode === 'literal') {
      delete newOverrides[key];
    }
    diagram.updateNodeData(diagram.selectedNode.id, { variableOverrides: newOverrides });
  }

  let diagramNodesForRef = $derived(
    diagram.nodes
      .filter((n) => diagram.selectedNode ? n.id !== diagram.selectedNode.id : true)
      .map((n) => ({ id: n.id, typeId: n.data.typeId as string, label: n.data.label }))
  );

  const panelTitle = $derived.by(() => {
    if (diagram.selectedNode && schema) return schema.displayName;
    if (diagram.selectedEdge) return 'Connection';
    return 'Properties';
  });

  let hasCostInputs = $derived(!!(schema?.costEstimation?.usageInputs?.length));

  // Collect all collapsible section IDs for this panel
  let propsSectionIds = $derived.by(() => {
    const ids: string[] = [];
    if (!schema) return ids;
    // Property groups from PropertyRenderer
    const groups = new Set<string>();
    for (const prop of schema.properties) {
      groups.add(prop.group ?? 'General');
    }
    for (const group of groups) {
      ids.push(`props-group-${group.toLowerCase().replace(/\s+/g, '-')}`);
    }
    // Key Vault access control
    if (isKeyVault) {
      ids.push('props-kv-access-control');
    }
    // Cost estimation usage inputs
    if (hasCostInputs) {
      ids.push('props-cost-estimation');
    }
    // Outputs
    if (schema.outputs && schema.outputs.length > 0) {
      ids.push('props-outputs');
    }
    // Connected secrets (if Key Vault)
    if (connectedBindings.length > 0) {
      ids.push('props-connected-secrets');
    }
    return ids;
  });

  let allCollapsed = $derived(propsSectionIds.length > 0 && propsSectionIds.every((id) => ui.isCategoryCollapsed(id)));
</script>

<aside class="properties-panel">
  <div class="panel-header">
    <h3>{panelTitle}</h3>
    <div class="header-spacer"></div>
    {#if propsSectionIds.length > 0}
      <button
        class="header-action"
        onclick={() => ui.toggleAllCategories(propsSectionIds)}
        title={allCollapsed ? 'Expand All' : 'Collapse All'}
        aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
      >
        {#if allCollapsed}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 6 8 2 12 6"/>
            <polyline points="4 10 8 14 12 10"/>
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 2 8 6 12 2"/>
            <polyline points="4 14 8 10 12 14"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  <div class="panel-content">
    {#if diagram.selectedNode && schema}
      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">Terraform Name</span>
          <input
            type="text"
            value={diagram.selectedNode.data.terraformName}
            oninput={(e) => {
              if (diagram.selectedNode) {
                diagram.updateNodeData(diagram.selectedNode.id, {
                  terraformName: (e.target as HTMLInputElement).value,
                });
              }
            }}
          />
        </label>
      </div>

      {#if conventionActive}
        <div class="convention-name-field">
          <label class="field-label">
            <span class="label-row-conv">
              <span class="label-text">Service Name <span class="required">*</span></span>
              <span class="convention-badge">convention</span>
            </span>
            <input
              type="text"
              placeholder="e.g. backendapi"
              bind:value={localSlugValue}
              oninput={(e) => onConventionNameChange((e.target as HTMLInputElement).value)}
            />
            {#if namePreview}
              <span class="name-preview">→ {namePreview}</span>
            {/if}
          </label>
        </div>
      {/if}

      {#if isSubscription}
        <SubscriptionPicker
          displayName={(diagram.selectedNode.data.properties['display_name'] as string) ?? ''}
          subscriptionId={(diagram.selectedNode.data.properties['subscription_id'] as string) ?? ''}
          onSelect={(name, id) => {
            onPropertyChange('display_name', name);
            onPropertyChange('subscription_id', id);
          }}
        />
      {/if}

      <PropertyRenderer
        properties={renderedProperties}
        values={diagram.selectedNode.data.properties}
        onChange={onPropertyChange}
        references={diagram.selectedNode.data.references}
        diagramNodes={diagramNodesForRef}
        onReferenceChange={onReferenceChange}
        variableOverrides={diagram.selectedNode.data.variableOverrides ?? {}}
        onVariableModeChange={onVariableModeChange}
        showVariableToggle={true}
      />

      {#if isKeyVault}
        <KeyVaultAccessControlSection
          accessModel={(diagram.selectedNode.data.properties['access_model'] as AccessModel) ?? 'rbac'}
          accessGrants={(diagram.selectedNode.data.properties['access_grants'] as AccessGrant[]) ?? []}
          onAccessModelChange={(model) => onPropertyChange('access_model', model)}
          onGrantsChange={(grants) => onPropertyChange('access_grants', grants)}
        />
      {/if}

      {#if hasCostInputs}
        <CollapsiblePanelSection id="props-cost-estimation" label="Cost Estimation" count={schema.costEstimation!.usageInputs!.length}>
          <p class="cost-inputs-hint">Usage inputs for cost estimates. These are not deployed to Azure.</p>
          {#each schema.costEstimation!.usageInputs! as input}
            <label class="cost-input-row">
              <span class="cost-input-label">
                {input.label}
                {#if input.description}
                  <span class="cost-input-hint" title={input.description}>?</span>
                {/if}
              </span>
              <div class="cost-input-field">
                <input
                  type="number"
                  min={input.min}
                  max={input.max}
                  step="any"
                  value={(diagram.selectedNode!.data.properties[input.key] as number | undefined) ?? input.defaultValue}
                  oninput={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    onPropertyChange(input.key, isNaN(v) ? input.defaultValue : v);
                  }}
                />
                <span class="cost-input-unit">{input.unit}</span>
              </div>
            </label>
          {/each}
        </CollapsiblePanelSection>
      {/if}

      {#if schema.outputs && schema.outputs.length > 0}
        <CollapsiblePanelSection id="props-outputs" label="Outputs" count={schema.outputs.length}>
          {#each schema.outputs as output}
            <label class="output-toggle">
              <input
                type="checkbox"
                checked={((diagram.selectedNode.data.enabledOutputs as string[]) ?? []).includes(output.key)}
                onchange={() => toggleOutput(output.key)}
              />
              <span class="output-label">{output.label}</span>
              {#if output.sensitive}
                <span class="sensitive-badge">sensitive</span>
              {/if}
            </label>
          {/each}
        </CollapsiblePanelSection>
      {/if}

      {#if connectedBindings.length > 0}
        <CollapsiblePanelSection id="props-connected-secrets" label="Connected Secrets" count={connectedBindings.length}>
          {#each connectedBindings as binding (binding.edgeId)}
            <div class="binding-item">
              <div class="binding-info">
                <span class="binding-source">{binding.sourceLabel}</span>
                <span class="binding-attr">{binding.attributeLabel}</span>
              </div>
              <div class="binding-actions">
                {#if binding.sensitive}
                  <span class="sensitive-badge">sensitive</span>
                {/if}
                <button
                  class="disconnect-btn"
                  onclick={() => diagram.removeEdge(binding.edgeId)}
                  aria-label="Disconnect"
                  title="Disconnect"
                >&times;</button>
              </div>
            </div>
          {/each}
        </CollapsiblePanelSection>
      {/if}

    {:else if diagram.selectedEdge}
      <div class="edge-endpoints">
        <div class="edge-endpoint">
          <span class="endpoint-label">From</span>
          <span class="endpoint-value">{sourceNode?.data.label || 'Unknown'}</span>
        </div>
        <div class="edge-arrow">&#8595;</div>
        <div class="edge-endpoint">
          <span class="endpoint-label">To</span>
          <span class="endpoint-value">{targetNode?.data.label || 'Unknown'}</span>
        </div>
      </div>

      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">Label</span>
          <input
            type="text"
            value={typeof diagram.selectedEdge.data?.label === 'string' ? diagram.selectedEdge.data.label : ''}
            oninput={(e) => {
              if (diagram.selectedEdge) {
                diagram.updateEdgeLabel(diagram.selectedEdge.id, (e.target as HTMLInputElement).value);
              }
            }}
            placeholder="Connection label..."
          />
        </label>
      </div>

      <div class="edge-category-info">
        <span class="category-label">Category</span>
        <span class="category-value">{diagram.selectedEdge.data?.category ?? 'structural'}</span>
      </div>

      <EdgeStyleEditor
        settings={(diagram.selectedEdge.data?.styleOverrides as EdgeStyleSettings) ?? {}}
        categoryId={(diagram.selectedEdge.data?.category as EdgeCategoryId) ?? 'structural'}
        onChange={(newSettings) => {
          if (diagram.selectedEdge) {
            diagram.updateEdgeData(diagram.selectedEdge.id, {
              styleOverrides: Object.keys(newSettings).length > 0 ? newSettings : undefined,
            });
          }
        }}
      />

      {#if diagram.selectedEdge.deletable !== false}
        <button
          class="delete-edge-btn"
          onclick={() => {
            if (diagram.selectedEdge) {
              const edgeId = diagram.selectedEdge.id;
              diagram.selectedEdgeId = null;
              diagram.removeEdge(edgeId);
            }
          }}
        >
          Delete Connection
        </button>
      {:else}
        <div class="edge-info-hint">
          This connection is auto-generated from a reference property and cannot be deleted.
        </div>
      {/if}

    {:else}
      <div class="empty-state">
        <p class="empty-hint">Select a node or connection to view its properties.</p>
      </div>
    {/if}
  </div>
</aside>

<style>
  .properties-panel {
    width: 300px;
    min-width: 300px;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    height: 35px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .header-spacer {
    flex: 1;
  }
  .header-action {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }
  .header-action:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .panel-content {
    padding: 12px 16px;
    flex: 1;
    overflow-y: auto;
  }
  .tf-name-field {
    margin-bottom: 12px;
  }
  .convention-name-field {
    margin-bottom: 12px;
  }
  .field-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .label-text {
    font-weight: 500;
  }
  .label-row-conv {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .convention-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.12);
    color: var(--color-accent);
    font-weight: 500;
    letter-spacing: 0.03em;
  }
  .name-preview {
    font-size: 11px;
    color: var(--color-text-muted);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    opacity: 0.8;
  }
  .required {
    color: #ef4444;
  }
  input[type='text'] {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  input[type='text']:focus {
    border-color: var(--color-accent);
  }
  .edge-endpoints {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 16px;
    padding: 10px;
    background: var(--color-bg);
    border-radius: 6px;
    border: 1px solid var(--color-border);
  }
  .edge-endpoint {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .endpoint-label {
    font-size: 11px;
    color: var(--color-text-muted);
    min-width: 32px;
  }
  .endpoint-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }
  .edge-arrow {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .edge-category-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--color-bg);
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .category-label {
    font-size: 11px;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .category-value {
    font-size: 11px;
    color: var(--color-text);
    text-transform: capitalize;
  }
  .delete-edge-btn {
    margin-top: 16px;
    width: 100%;
    padding: 8px;
    border: 1px solid #ef4444;
    border-radius: 6px;
    background: transparent;
    color: #ef4444;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .delete-edge-btn:hover {
    background: #ef4444;
    color: #fff;
  }
  .output-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
    padding: 4px 0;
  }
  .output-toggle input[type='checkbox'] {
    accent-color: var(--color-accent);
  }
  .output-label {
    flex: 1;
  }
  .sensitive-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    font-weight: 500;
  }
  .binding-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .binding-item:last-child {
    border-bottom: none;
  }
  .binding-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .binding-source {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .binding-attr {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .binding-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .disconnect-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0 5px;
    line-height: 1.4;
    transition: color 0.15s, border-color 0.15s;
  }
  .disconnect-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
  }
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
  }
  .empty-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    opacity: 0.5;
    text-align: center;
    margin: 0;
  }
  .edge-info-hint {
    margin-top: 16px;
    padding: 10px 12px;
    font-size: 11px;
    color: var(--color-text-muted);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    line-height: 1.4;
  }
  .cost-inputs-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    opacity: 0.7;
    margin: 0 0 8px;
    line-height: 1.4;
  }
  .cost-input-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }
  .cost-input-row:last-child {
    margin-bottom: 0;
  }
  .cost-input-label {
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cost-input-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--color-border);
    color: var(--color-text-muted);
    font-size: 9px;
    font-weight: 700;
    cursor: help;
    flex-shrink: 0;
  }
  .cost-input-field {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cost-input-field input[type='number'] {
    flex: 1;
    padding: 5px 8px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    min-width: 0;
    box-sizing: border-box;
  }
  .cost-input-field input[type='number']:focus {
    border-color: var(--color-accent);
  }
  .cost-input-unit {
    font-size: 11px;
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>

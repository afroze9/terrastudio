<script lang="ts">
  import { t } from '$lib/i18n';
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { registry } from '$lib/bootstrap';
  import { applyNamingTemplate, sanitizeTerraformName, buildTokens } from '@terrastudio/core';
  import PropertyRenderer from './PropertyRenderer.svelte';
  import SubscriptionPicker from './SubscriptionPicker.svelte';
  import KeyVaultAccessControlSection from './KeyVaultAccessControlSection.svelte';
  import CollapsiblePanelSection from './CollapsiblePanelSection.svelte';
  import EdgeStyleEditor from './EdgeStyleEditor.svelte';
  import type { ResourceTypeId, PropertyVariableMode, AccessModel, AccessGrant, EdgeStyleSettings, EdgeCategoryId, HandleDefinition, PropertySchema, OutputDefinition, ModuleInstance, TerraformVariable } from '@terrastudio/types';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
      : null
  );

  // ─── Module Instance detection ──────────────────────────────────────
  /** When the selected node is a module instance synthetic node, resolve the instance */
  let selectedInstance = $derived.by((): ModuleInstance | null => {
    const node = diagram.selectedNode;
    if (!node || !node.id.startsWith('_modinst_')) return null;
    const instanceId = (node.data as any).instanceId as string;
    return diagram.moduleInstances.find((i) => i.id === instanceId) ?? null;
  });

  let instanceTemplate = $derived(
    selectedInstance ? diagram.modules.find((m) => m.id === selectedInstance!.templateId) : null,
  );

  /** Derive template variables from template member nodes' variableOverrides */
  let templateVariables = $derived.by((): Array<{ name: string; type: string; defaultValue: unknown }> => {
    if (!instanceTemplate) return [];
    const memberNodes = diagram.nodes.filter((n) => n.data.moduleId === instanceTemplate!.id);
    const vars: Array<{ name: string; type: string; defaultValue: unknown }> = [];
    const seen = new Set<string>();

    for (const node of memberNodes) {
      const overrides = node.data.variableOverrides ?? {};
      const nodeSchema = registry.getResourceSchema(node.data.typeId);
      if (!nodeSchema) continue;

      for (const [key, mode] of Object.entries(overrides)) {
        if (mode !== 'variable') continue;
        const varName = `${node.data.terraformName}_${key}`;
        if (seen.has(varName)) continue;
        seen.add(varName);

        const propSchema = nodeSchema.properties.find((p: PropertySchema) => p.key === key);
        const value = node.data.properties[key];
        vars.push({
          name: varName,
          type: typeof value === 'number' ? 'number' : 'string',
          defaultValue: value,
        });
      }
    }
    return vars;
  });

  // ─── Template/instance member detection (read-only) ──────────────────────
  /** True when the selected node is a cloned instance member or a template original — properties are read-only */
  let isTemplateMember = $derived.by(() => {
    const node = diagram.selectedNode;
    if (!node || selectedInstance) return false;
    // Check if this is a cloned instance member
    if (node.data.instanceMemberId) return true;
    // Check if this is an original template member
    const modId = node.data.moduleId as string | undefined;
    if (!modId) return false;
    const mod = diagram.modules.find((m) => m.id === modId);
    return mod?.isTemplate === true;
  });

  // ─── Naming convention ────────────────────────────────────────────────────

  /** True when a naming convention is active and this resource has a cafAbbreviation */
  let conventionActive = $derived.by(() => {
    const conv = project.projectConfig.namingConvention;
    return !!(conv?.enabled && schema?.cafAbbreviation && schema.properties.some((p: PropertySchema) => p.key === 'name'));
  });

  /**
   * Walk the containment hierarchy from the selected node upward to find the nearest
   * Resource Group, then return its naming_env override (if set).
   */
  let rgNamingOverrides = $derived.by((): { env?: string; region?: string } => {
    const node = diagram.selectedNode;
    if (!node) return {};
    let cur = node;
    while (cur.parentId) {
      const parent = diagram.nodes.find((n) => n.id === cur.parentId);
      if (!parent) break;
      if (parent.data.typeId === 'azurerm/core/resource_group') {
        const env = (parent.data.properties['naming_env'] as string | undefined) || undefined;
        const region = (parent.data.properties['naming_region'] as string | undefined) || undefined;
        return { env, region };
      }
      cur = parent;
    }
    return {};
  });

  /** Preview of the full Azure name — always computed, never stored. */
  let namePreview = $derived.by(() => {
    if (!conventionActive || !schema?.cafAbbreviation || !diagram.selectedNode) return '';
    const conv = project.projectConfig.namingConvention!;
    const slug = (diagram.selectedNode.data.namingSlug as string | undefined) ?? '';
    const tokens = buildTokens(conv, schema.cafAbbreviation, slug, rgNamingOverrides);
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
      props = props.filter((p: PropertySchema) => p.key !== 'name');
    }
    if (isSubscription) {
      props = props.filter((p: PropertySchema) => p.key !== 'display_name' && p.key !== 'subscription_id');
    }
    if (isKeyVault) {
      props = props.filter((p: PropertySchema) => p.key !== 'access_model' && p.key !== 'access_grants');
    }
    return props;
  });

  function onSlugChange(slug: string) {
    if (!diagram.selectedNode || !schema?.cafAbbreviation) return;
    const conv = project.projectConfig.namingConvention!;
    const tokens = buildTokens(conv, schema.cafAbbreviation, slug, rgNamingOverrides);
    const fullName = applyNamingTemplate(conv.template, tokens, schema.namingConstraints);
    diagram.updateNodeData(diagram.selectedNode.id, {
      namingSlug: slug || undefined,
      label: fullName || schema.displayName,
      terraformName: sanitizeTerraformName(fullName) || diagram.selectedNode.data.terraformName,
    });
  }

  /** Edges connected to handles with acceptsOutputs (e.g. Key Vault secret-in) */
  let connectedBindings = $derived.by(() => {
    if (!diagram.selectedNode || !schema) return [];
    const acceptHandles = schema.handles.filter((h: HandleDefinition) => h.acceptsOutputs);
    if (acceptHandles.length === 0) return [];
    const handleIds = new Set(acceptHandles.map((h: HandleDefinition) => h.id));
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
        const outputDef = sourceSchema?.outputs?.find((o: OutputDefinition) => o.key === attribute);
        return {
          edgeId: edge.id,
          sourceLabel: (sourceNode?.data.displayLabel || sourceNode?.data.label) ?? 'Unknown',
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
    // When convention is active, label comes from namingSlug — don't sync from properties['name']
    const newLabel = key === 'name' && typeof value === 'string' && !conventionActive
      ? value || schema?.displayName || diagram.selectedNode.data.label
      : diagram.selectedNode.data.label;
    diagram.updateNodeData(diagram.selectedNode.id, {
      properties: newProps,
      label: newLabel,
    });

    // When an RG's naming overrides change, recompute labels for all children that have a namingSlug
    if ((key === 'naming_env' || key === 'naming_region') && diagram.selectedNode) {
      const conv = project.projectConfig.namingConvention;
      if (!conv?.enabled) return;
      const rgId = diagram.selectedNode.id;
      const env = (key === 'naming_env' ? value : newProps['naming_env']) as string | undefined || undefined;
      const region = (key === 'naming_region' ? value : newProps['naming_region']) as string | undefined || undefined;
      const overrides = { env, region };

      // Find all descendants of this RG that have a namingSlug
      function getDescendants(parentId: string): typeof diagram.nodes {
        const children = diagram.nodes.filter(n => n.parentId === parentId);
        return children.flatMap(c => [c, ...getDescendants(c.id)]);
      }
      for (const child of getDescendants(rgId)) {
        const childSchema = registry.getResourceSchema(child.data.typeId);
        if (!childSchema?.cafAbbreviation || child.data.namingSlug === undefined) continue;
        const tokens = buildTokens(conv, childSchema.cafAbbreviation, child.data.namingSlug as string, overrides);
        const fullName = applyNamingTemplate(conv.template, tokens, childSchema.namingConstraints);
        if (fullName) {
          diagram.updateNodeData(child.id, {
            label: fullName,
            terraformName: sanitizeTerraformName(fullName) || child.data.terraformName,
          });
        }
      }
    }
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
      .map((n) => ({ id: n.id, typeId: n.data.typeId as string, label: (n.data.displayLabel || n.data.label) as string }))
  );

  const panelTitle = $derived.by(() => {
    if (selectedInstance) return 'Module Instance';
    if (isTemplateMember && schema) {
      const instId = diagram.selectedNode?.data.instanceMemberId as string | undefined;
      if (instId) {
        const inst = diagram.moduleInstances.find((i) => i.id === instId);
        return `${schema.displayName} (${inst?.name ?? 'Instance'})`;
      }
      return `${schema.displayName} (Template)`;
    }
    if (diagram.selectedNode && schema) return schema.displayName;
    if (diagram.selectedEdge) return t('properties.connection');
    return t('properties.title');
  });

  let hasCostInputs = $derived(!!(schema?.costEstimation?.usageInputs?.length));

  // Private Endpoint config: show when resource has privateEndpointConfig and is inside a subnet
  let showPepConfig = $derived.by(() => {
    if (!schema?.privateEndpointConfig || !diagram.selectedNode) return false;
    const parentNode = diagram.nodes.find((n) => n.id === diagram.selectedNode!.parentId);
    return parentNode?.data.typeId === 'azurerm/networking/subnet';
  });

  let pepConfig = $derived(schema?.privateEndpointConfig);

  function togglePepSubresource(key: string) {
    if (!diagram.selectedNode) return;
    const props = { ...diagram.selectedNode.data.properties };
    const current = (props['pep_subresources'] as string[] | undefined) ?? [pepConfig?.defaultSubresource ?? ''];
    if (current.includes(key)) {
      props['pep_subresources'] = current.filter((k: string) => k !== key);
    } else {
      props['pep_subresources'] = [...current, key];
    }
    diagram.updateNodeData(diagram.selectedNode.id, { properties: props });
  }

  function togglePepDnsZone() {
    if (!diagram.selectedNode) return;
    const props = { ...diagram.selectedNode.data.properties };
    props['pep_dns_zone_enabled'] = !props['pep_dns_zone_enabled'];
    diagram.updateNodeData(diagram.selectedNode.id, { properties: props });
  }

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
    // Private Endpoint config
    if (showPepConfig) {
      ids.push('props-private-endpoint');
    }
    // Connected secrets (if Key Vault)
    if (connectedBindings.length > 0) {
      ids.push('props-connected-secrets');
    }
    return ids;
  });

  let allCollapsed = $derived(propsSectionIds.length > 0 && propsSectionIds.every((id) => ui.isCategoryCollapsed(id)));

  // Scroll to and highlight the targeted property field when navigating from the Problems tab
  $effect(() => {
    const key = ui.highlightedPropertyKey;
    if (!key) return;

    // Clear the flag after one tick so it doesn't re-trigger
    requestAnimationFrame(() => {
      ui.highlightedPropertyKey = null;
    });

    // Wait for DOM to settle, then find + scroll + highlight
    setTimeout(() => {
      const el = document.querySelector(`.properties-panel [data-property-key="${CSS.escape(key)}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 1500);
    }, 100);
  });
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
    {#if selectedInstance && instanceTemplate}
      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">{t('properties.instanceName')}</span>
          <input
            type="text"
            value={selectedInstance.name}
            oninput={(e) => {
              if (selectedInstance) {
                const name = (e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                diagram.updateModuleInstance(selectedInstance.id, { name });
              }
            }}
          />
        </label>
      </div>

      <div class="instance-template-info">
        <span class="endpoint-label">{t('properties.template')}</span>
        <span class="endpoint-value">{instanceTemplate.name}</span>
      </div>

      {#if selectedInstance.description !== undefined}
        <div class="tf-name-field">
          <label class="field-label">
            <span class="label-text">{t('properties.description')}</span>
            <input
              type="text"
              value={selectedInstance.description ?? ''}
              oninput={(e) => {
                if (selectedInstance) {
                  diagram.updateModuleInstance(selectedInstance.id, { description: (e.target as HTMLInputElement).value || undefined });
                }
              }}
              placeholder={t('properties.descriptionPlaceholder')}
            />
          </label>
        </div>
      {/if}

      <div class="instance-readonly-hint">
        {t('properties.instanceReadOnly')}
      </div>

      {#if templateVariables.length > 0}
        <CollapsiblePanelSection
          id="instance-variables"
          label={t('properties.variableValues')}
          count={templateVariables.length}
        >
          {#each templateVariables as variable (variable.name)}
            <div class="instance-var-field">
              <label class="field-label">
                <span class="label-row-conv">
                  <span class="label-text">{variable.name}</span>
                  <span class="convention-badge">{variable.type}</span>
                </span>
                <input
                  type="text"
                  value={selectedInstance.variableValues[variable.name] ?? ''}
                  placeholder={variable.defaultValue != null ? String(variable.defaultValue) : ''}
                  oninput={(e) => {
                    if (selectedInstance) {
                      diagram.updateInstanceVariable(selectedInstance.id, variable.name, (e.target as HTMLInputElement).value);
                    }
                  }}
                />
                {#if variable.defaultValue != null}
                  <span class="name-preview">default: {String(variable.defaultValue)}</span>
                {/if}
              </label>
            </div>
          {/each}
        </CollapsiblePanelSection>
      {:else}
        <div class="empty-state">
          <p class="empty-hint">{t('properties.noVariables')}</p>
        </div>
      {/if}

      <button
        class="delete-edge-btn"
        onclick={() => {
          if (selectedInstance) {
            diagram.selectedNodeId = null;
            diagram.deleteModuleInstance(selectedInstance.id);
          }
        }}
      >
        {t('properties.deleteInstance')}
      </button>

    {:else if diagram.selectedNode && schema}
      {#if isTemplateMember}
        <div class="instance-readonly-hint">
          {t('properties.templateReadOnly')}
        </div>
      {/if}

      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">{t('properties.displayName')}</span>
          <div class="display-name-row">
            <input
              type="text"
              value={diagram.selectedNode.data.displayLabel ?? ''}
              placeholder={diagram.selectedNode.data.label || schema?.displayName || ''}
              disabled={isTemplateMember}
              oninput={(e) => {
                if (diagram.selectedNode) {
                  const val = (e.target as HTMLInputElement).value;
                  diagram.updateNodeData(diagram.selectedNode.id, {
                    displayLabel: val || undefined,
                  });
                }
              }}
            />
            {#if diagram.selectedNode.data.displayLabel}
              <button
                class="clear-display-name"
                title="Reset to resource name"
                onclick={() => {
                  if (diagram.selectedNode) {
                    diagram.updateNodeData(diagram.selectedNode.id, { displayLabel: undefined });
                  }
                }}
              >✕</button>
            {/if}
          </div>
        </label>
      </div>

      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">{t('properties.terraformName')}</span>
          <input
            type="text"
            value={diagram.selectedNode.data.terraformName}
            disabled={isTemplateMember}
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
              <span class="label-text">{t('properties.serviceName')} <span class="required">*</span></span>
              <span class="convention-badge">{t('properties.convention')}</span>
            </span>
            <input
              type="text"
              placeholder={t('properties.serviceNamePlaceholder')}
              disabled={isTemplateMember}
              value={diagram.selectedNode.data.namingSlug ?? ''}
              oninput={(e) => onSlugChange((e.target as HTMLInputElement).value)}
            />
            {#if namePreview}
              <span class="name-preview">→ {namePreview}</span>
            {/if}
          </label>
        </div>
      {/if}

      {#if isSubscription && !isTemplateMember}
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
        readonly={isTemplateMember}
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
        <CollapsiblePanelSection id="props-cost-estimation" label={t('properties.costEstimation')} count={schema.costEstimation!.usageInputs!.length}>
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
        <CollapsiblePanelSection id="props-outputs" label={t('properties.outputs')} count={schema.outputs.length}>
          {#each schema.outputs as output}
            <label class="output-toggle">
              <input
                type="checkbox"
                checked={((diagram.selectedNode.data.enabledOutputs as string[]) ?? []).includes(output.key)}
                onchange={() => toggleOutput(output.key)}
              />
              <span class="output-label">{output.label}</span>
              {#if output.sensitive}
                <span class="sensitive-badge">{t('properties.sensitive')}</span>
              {/if}
            </label>
          {/each}
        </CollapsiblePanelSection>
      {/if}

      {#if showPepConfig && pepConfig}
        <CollapsiblePanelSection id="props-private-endpoint" label={t('properties.privateEndpoint')} count={pepConfig.subresources.length}>
          <div class="pep-section">
            <p class="pep-hint">{t('properties.privateEndpointHint')}</p>
            {#each pepConfig.subresources as sub (sub.key)}
              {@const currentSubs = (diagram.selectedNode?.data.properties?.['pep_subresources'] as string[] | undefined) ?? [pepConfig.defaultSubresource]}
              <label class="output-toggle">
                <input
                  type="checkbox"
                  checked={currentSubs.includes(sub.key)}
                  onchange={() => togglePepSubresource(sub.key)}
                />
                <span class="output-label">{sub.label}</span>
              </label>
            {/each}
            <label class="output-toggle" style="margin-top: 8px;">
              <input
                type="checkbox"
                checked={!!diagram.selectedNode?.data.properties?.['pep_dns_zone_enabled']}
                onchange={togglePepDnsZone}
              />
              <span class="output-label">{t('properties.privateDnsZone')}</span>
            </label>
          </div>
        </CollapsiblePanelSection>
      {/if}

      {#if connectedBindings.length > 0}
        <CollapsiblePanelSection id="props-connected-secrets" label={t('properties.connectedSecrets')} count={connectedBindings.length}>
          {#each connectedBindings as binding (binding.edgeId)}
            <div class="binding-item">
              <div class="binding-info">
                <span class="binding-source">{binding.sourceLabel}</span>
                <span class="binding-attr">{binding.attributeLabel}</span>
              </div>
              <div class="binding-actions">
                {#if binding.sensitive}
                  <span class="sensitive-badge">{t('properties.sensitive')}</span>
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
          <span class="endpoint-label">{t('properties.from')}</span>
          <span class="endpoint-value">{sourceNode?.data.displayLabel || sourceNode?.data.label || 'Unknown'}</span>
        </div>
        <div class="edge-arrow">&#8595;</div>
        <div class="edge-endpoint">
          <span class="endpoint-label">{t('properties.to')}</span>
          <span class="endpoint-value">{targetNode?.data.displayLabel || targetNode?.data.label || 'Unknown'}</span>
        </div>
      </div>

      <div class="tf-name-field">
        <label class="field-label">
          <span class="label-text">{t('properties.label')}</span>
          <input
            type="text"
            value={typeof diagram.selectedEdge.data?.label === 'string' ? diagram.selectedEdge.data.label : ''}
            oninput={(e) => {
              if (diagram.selectedEdge) {
                diagram.updateEdgeLabel(diagram.selectedEdge.id, (e.target as HTMLInputElement).value);
              }
            }}
            placeholder={t('properties.connectionLabelPlaceholder')}
          />
        </label>
      </div>

      <div class="edge-category-info">
        <span class="category-label">{t('properties.category')}</span>
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
          {t('properties.deleteConnection')}
        </button>
      {:else}
        <div class="edge-info-hint">
          {t('properties.autoGeneratedHint')}
        </div>
      {/if}

    {:else}
      <div class="empty-state">
        <p class="empty-hint">{t('properties.noSelection')}</p>
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
    font-size: var(--font-11);
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
  .display-name-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .display-name-row input {
    flex: 1;
    min-width: 0;
  }
  .clear-display-name {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: var(--font-11);
    padding: 2px 5px;
    border-radius: 3px;
    line-height: 1;
  }
  .clear-display-name:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .convention-name-field {
    margin-bottom: 12px;
  }
  .field-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--font-12);
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
    font-size: var(--font-9);
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(59, 130, 246, 0.12);
    color: var(--color-accent);
    font-weight: 500;
    letter-spacing: 0.03em;
  }
  .name-preview {
    font-size: var(--font-11);
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
    font-size: var(--font-13);
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
    font-size: var(--font-11);
    color: var(--color-text-muted);
    min-width: 32px;
  }
  .endpoint-value {
    font-size: var(--font-13);
    font-weight: 500;
    color: var(--color-text);
  }
  .edge-arrow {
    color: var(--color-text-muted);
    font-size: var(--font-14);
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
    font-size: var(--font-11);
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .category-value {
    font-size: var(--font-11);
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
    font-size: var(--font-12);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .delete-edge-btn:hover {
    background: #ef4444;
    color: #fff;
  }
  .pep-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pep-hint {
    font-size: var(--font-11);
    color: var(--color-text-muted);
    margin: 0 0 4px 0;
    line-height: 1.4;
  }
  .output-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-12);
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
    font-size: var(--font-9);
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
    font-size: var(--font-12);
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .binding-attr {
    font-size: var(--font-11);
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
    font-size: var(--font-14);
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
    font-size: var(--font-12);
    color: var(--color-text-muted);
    opacity: 0.5;
    text-align: center;
    margin: 0;
  }
  .edge-info-hint {
    margin-top: 16px;
    padding: 10px 12px;
    font-size: var(--font-11);
    color: var(--color-text-muted);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    line-height: 1.4;
  }
  .cost-inputs-hint {
    font-size: var(--font-10);
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
    font-size: var(--font-12);
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
    font-size: var(--font-9);
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
    font-size: var(--font-13);
    outline: none;
    transition: border-color 0.15s;
    min-width: 0;
    box-sizing: border-box;
  }
  .cost-input-field input[type='number']:focus {
    border-color: var(--color-accent);
  }
  .cost-input-unit {
    font-size: var(--font-11);
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Module instance panel */
  .instance-readonly-hint {
    font-size: var(--font-11);
    color: var(--color-text-muted);
    opacity: 0.7;
    line-height: 1.4;
    padding: 8px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .instance-template-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--color-bg);
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .instance-var-field {
    margin-bottom: 4px;
  }

  /* highlight-flash is applied globally via JS classList */
  :global(.highlight-flash) {
    animation: highlight-pulse 1.5s ease-out;
  }
  @keyframes highlight-pulse {
    0% { background: rgba(59, 130, 246, 0.25); }
    100% { background: transparent; }
  }
</style>

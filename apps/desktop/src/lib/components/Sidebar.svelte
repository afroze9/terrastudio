<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { registry } from '$lib/bootstrap';
  import PropertyRenderer from './PropertyRenderer.svelte';
  import ProjectConfigPanel from './ProjectConfigPanel.svelte';
  import type { ResourceTypeId } from '@terrastudio/types';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
      : null
  );

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
</script>

{#if diagram.selectedNode && schema}
  <aside class="sidebar">
    <div class="sidebar-header">
      <h3>{schema.displayName}</h3>
      <button
        class="close-btn"
        onclick={() => (diagram.selectedNodeId = null)}
        aria-label="Close sidebar"
      >
        &times;
      </button>
    </div>

    <div class="sidebar-content">
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

      <PropertyRenderer
        properties={schema.properties}
        values={diagram.selectedNode.data.properties}
        onChange={onPropertyChange}
      />

      {#if schema.outputs && schema.outputs.length > 0}
        <div class="outputs-section">
          <div class="group-header">Outputs</div>
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
        </div>
      {/if}

      {#if connectedBindings.length > 0}
        <div class="bindings-section">
          <div class="group-header">Connected Secrets</div>
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
        </div>
      {/if}
    </div>
  </aside>
{:else if diagram.selectedEdge}
  <aside class="sidebar">
    <div class="sidebar-header">
      <h3>Connection</h3>
      <button
        class="close-btn"
        onclick={() => (diagram.selectedEdgeId = null)}
        aria-label="Close sidebar"
      >
        &times;
      </button>
    </div>

    <div class="sidebar-content">
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
            value={typeof diagram.selectedEdge.label === 'string' ? diagram.selectedEdge.label : ''}
            oninput={(e) => {
              if (diagram.selectedEdge) {
                diagram.updateEdgeLabel(diagram.selectedEdge.id, (e.target as HTMLInputElement).value);
              }
            }}
            placeholder="Connection label..."
          />
        </label>
      </div>

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
    </div>
  </aside>
{:else if project.isOpen}
  <ProjectConfigPanel />
{/if}

<style>
  .sidebar {
    width: 300px;
    min-width: 300px;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .sidebar-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .close-btn:hover {
    color: var(--color-text);
  }
  .sidebar-content {
    padding: 12px 16px;
    flex: 1;
    overflow-y: auto;
  }
  .tf-name-field {
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
  .outputs-section {
    margin-top: 16px;
  }
  .group-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
    padding: 8px 0 6px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
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
  .bindings-section {
    margin-top: 16px;
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
</style>

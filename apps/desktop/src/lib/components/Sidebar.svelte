<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import PropertyRenderer from './PropertyRenderer.svelte';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
      : null
  );

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
</style>

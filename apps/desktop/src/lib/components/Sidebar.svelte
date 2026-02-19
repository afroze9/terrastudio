<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import PropertyRenderer from './PropertyRenderer.svelte';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
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
</style>

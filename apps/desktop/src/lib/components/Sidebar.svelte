<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import { registry } from '$lib/bootstrap';
  import type { ResourceSchema } from '@terrastudio/types';

  let schema = $derived(
    diagram.selectedNode
      ? registry.getResourceSchema(diagram.selectedNode.data.typeId)
      : null
  );
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
      <div class="property-group">
        <label class="field-label">
          Terraform Name
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

      {#each schema.properties as prop}
        {#if prop.type === 'string'}
          <div class="property-group">
            <label class="field-label">
              {prop.label}
              {#if prop.required}<span class="required">*</span>{/if}
              <input
                type="text"
                placeholder={prop.placeholder}
                value={(diagram.selectedNode.data.properties[prop.key] as string) ?? ''}
                oninput={(e) => {
                  if (diagram.selectedNode) {
                    const newProps = { ...diagram.selectedNode.data.properties };
                    newProps[prop.key] = (e.target as HTMLInputElement).value;
                    diagram.updateNodeData(diagram.selectedNode.id, {
                      properties: newProps,
                      label: prop.key === 'name'
                        ? (e.target as HTMLInputElement).value || schema!.displayName
                        : diagram.selectedNode.data.label,
                    });
                  }
                }}
              />
              {#if prop.description}
                <span class="help-text">{prop.description}</span>
              {/if}
            </label>
          </div>
        {/if}
      {/each}
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
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .property-group {
    display: flex;
    flex-direction: column;
  }
  .field-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
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
  }
  input[type='text']:focus {
    border-color: var(--color-accent);
  }
  .help-text {
    font-size: 11px;
    color: var(--color-text-muted);
  }
</style>

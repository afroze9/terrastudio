<script lang="ts">
  import type { PropertySchema, ResourceTypeId } from '@terrastudio/types';

  interface Props {
    properties: ReadonlyArray<PropertySchema>;
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
  }

  let { properties, values, onChange }: Props = $props();

  // Group properties by group name
  let grouped = $derived.by(() => {
    const groups = new Map<string, PropertySchema[]>();
    const sorted = [...properties].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    for (const prop of sorted) {
      const group = prop.group ?? 'General';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(prop);
    }
    return groups;
  });

  function handleStringInput(key: string, event: Event) {
    onChange(key, (event.target as HTMLInputElement).value);
  }

  function handleNumberInput(key: string, event: Event) {
    const val = (event.target as HTMLInputElement).value;
    onChange(key, val === '' ? undefined : Number(val));
  }

  function handleBooleanInput(key: string, event: Event) {
    onChange(key, (event.target as HTMLInputElement).checked);
  }

  function handleSelectInput(key: string, event: Event) {
    onChange(key, (event.target as HTMLSelectElement).value);
  }

  function handleArrayAdd(key: string, itemDefault: unknown) {
    const current = (values[key] as unknown[] | undefined) ?? [];
    onChange(key, [...current, itemDefault ?? '']);
  }

  function handleArrayRemove(key: string, index: number) {
    const current = (values[key] as unknown[]) ?? [];
    onChange(key, current.filter((_, i) => i !== index));
  }

  function handleArrayItemChange(key: string, index: number, value: unknown) {
    const current = [...((values[key] as unknown[]) ?? [])];
    current[index] = value;
    onChange(key, current);
  }
</script>

{#each grouped as [groupName, props]}
  <div class="property-group">
    <div class="group-header">{groupName}</div>
    {#each props as prop}
      <div class="field">
        <label class="field-label">
          <span class="label-text">
            {prop.label}
            {#if prop.required}<span class="required">*</span>{/if}
          </span>

          {#if prop.type === 'string' || prop.type === 'cidr'}
            <input
              type="text"
              placeholder={prop.placeholder}
              value={(values[prop.key] as string) ?? ''}
              oninput={(e) => handleStringInput(prop.key, e)}
            />

          {:else if prop.type === 'number'}
            <input
              type="number"
              placeholder={prop.placeholder}
              value={(values[prop.key] as number) ?? ''}
              min={prop.validation?.min}
              max={prop.validation?.max}
              oninput={(e) => handleNumberInput(prop.key, e)}
            />

          {:else if prop.type === 'boolean'}
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={(values[prop.key] as boolean) ?? false}
                onchange={(e) => handleBooleanInput(prop.key, e)}
              />
              <span>{prop.description ?? prop.label}</span>
            </label>

          {:else if prop.type === 'select'}
            <select
              value={(values[prop.key] as string) ?? ''}
              onchange={(e) => handleSelectInput(prop.key, e)}
            >
              <option value="" disabled>Select...</option>
              {#each prop.options ?? [] as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>

          {:else if prop.type === 'multiselect'}
            <div class="multiselect">
              {#each prop.options ?? [] as opt}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={((values[prop.key] as string[]) ?? []).includes(opt.value)}
                    onchange={() => {
                      const current = ((values[prop.key] as string[]) ?? []);
                      const next = current.includes(opt.value)
                        ? current.filter(v => v !== opt.value)
                        : [...current, opt.value];
                      onChange(prop.key, next);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              {/each}
            </div>

          {:else if prop.type === 'array'}
            <div class="array-field">
              {#each ((values[prop.key] as unknown[]) ?? []) as item, index}
                <div class="array-item">
                  <input
                    type="text"
                    value={item as string}
                    placeholder={prop.itemSchema?.placeholder}
                    oninput={(e) => handleArrayItemChange(prop.key, index, (e.target as HTMLInputElement).value)}
                  />
                  <button
                    class="remove-btn"
                    onclick={() => handleArrayRemove(prop.key, index)}
                    aria-label="Remove item"
                  >&times;</button>
                </div>
              {/each}
              <button
                class="add-btn"
                onclick={() => handleArrayAdd(prop.key, prop.itemSchema?.defaultValue ?? '')}
              >+ Add</button>
            </div>

          {:else if prop.type === 'tags' || prop.type === 'key-value-map'}
            <div class="kv-field">
              {#each Object.entries((values[prop.key] as Record<string, string>) ?? {}) as [k, v], index}
                <div class="kv-row">
                  <input
                    type="text"
                    value={k}
                    placeholder="Key"
                    oninput={(e) => {
                      const current = { ...((values[prop.key] as Record<string, string>) ?? {}) };
                      const newKey = (e.target as HTMLInputElement).value;
                      delete current[k];
                      current[newKey] = v;
                      onChange(prop.key, current);
                    }}
                  />
                  <input
                    type="text"
                    value={v}
                    placeholder="Value"
                    oninput={(e) => {
                      const current = { ...((values[prop.key] as Record<string, string>) ?? {}) };
                      current[k] = (e.target as HTMLInputElement).value;
                      onChange(prop.key, current);
                    }}
                  />
                  <button
                    class="remove-btn"
                    onclick={() => {
                      const current = { ...((values[prop.key] as Record<string, string>) ?? {}) };
                      delete current[k];
                      onChange(prop.key, current);
                    }}
                    aria-label="Remove entry"
                  >&times;</button>
                </div>
              {/each}
              <button
                class="add-btn"
                onclick={() => {
                  const current = { ...((values[prop.key] as Record<string, string>) ?? {}) };
                  current[''] = '';
                  onChange(prop.key, current);
                }}
              >+ Add</button>
            </div>
          {/if}

          {#if prop.description && prop.type !== 'boolean'}
            <span class="help-text">{prop.description}</span>
          {/if}
        </label>
      </div>
    {/each}
  </div>
{/each}

<style>
  .property-group {
    margin-bottom: 16px;
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
  .field {
    margin-bottom: 10px;
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
  .required {
    color: #ef4444;
  }
  input[type='text'],
  input[type='number'],
  select {
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
  input:focus,
  select:focus {
    border-color: var(--color-accent);
  }
  select {
    cursor: pointer;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
  }
  .checkbox-label input[type='checkbox'] {
    accent-color: var(--color-accent);
  }
  .multiselect {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }
  .array-field,
  .kv-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .array-item,
  .kv-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .kv-row input {
    flex: 1;
  }
  .remove-btn {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 16px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    flex-shrink: 0;
  }
  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  .add-btn {
    background: transparent;
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .add-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .help-text {
    font-size: 11px;
    color: var(--color-text-muted);
  }
</style>

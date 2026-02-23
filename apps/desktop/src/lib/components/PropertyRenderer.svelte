<script lang="ts">
  import type { PropertySchema, ResourceTypeId, PropertyVariableMode } from '@terrastudio/types';

  interface DiagramNodeRef {
    id: string;
    typeId: string;
    label: string;
  }

  interface Props {
    properties: ReadonlyArray<PropertySchema>;
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    references?: Record<string, string>;
    diagramNodes?: DiagramNodeRef[];
    onReferenceChange?: (key: string, targetId: string | null) => void;
    /** Per-property variable mode overrides */
    variableOverrides?: Record<string, PropertyVariableMode>;
    /** Callback when variable mode changes */
    onVariableModeChange?: (key: string, mode: PropertyVariableMode) => void;
    /** Show variable toggle buttons (disabled by default for backwards compat) */
    showVariableToggle?: boolean;
  }

  let {
    properties,
    values,
    onChange,
    references = {},
    diagramNodes = [],
    onReferenceChange,
    variableOverrides = {},
    onVariableModeChange,
    showVariableToggle = false,
  }: Props = $props();

  function getVariableMode(key: string): PropertyVariableMode {
    return variableOverrides[key] ?? 'literal';
  }

  function toggleVariableMode(key: string) {
    const current = getVariableMode(key);
    const next = current === 'literal' ? 'variable' : 'literal';
    onVariableModeChange?.(key, next);
  }

  /** Check if a property type supports variable mode toggle */
  function supportsVariableToggle(type: string): boolean {
    // Only simple scalar types can be variables
    return ['string', 'number', 'cidr'].includes(type);
  }

  function isVisible(prop: PropertySchema, vals: Record<string, unknown>): boolean {
    if (!prop.visibleWhen) return true;
    const fieldVal = vals[prop.visibleWhen.field];
    switch (prop.visibleWhen.operator) {
      case 'truthy': return !!fieldVal;
      case 'falsy': return !fieldVal;
      case 'eq': return fieldVal === prop.visibleWhen.value;
      case 'neq': return fieldVal !== prop.visibleWhen.value;
      case 'in': return Array.isArray(prop.visibleWhen.value) && (prop.visibleWhen.value as unknown[]).includes(fieldVal);
      case 'notIn': return Array.isArray(prop.visibleWhen.value) && !(prop.visibleWhen.value as unknown[]).includes(fieldVal);
      default: return true;
    }
  }

  function getReferenceOptions(prop: PropertySchema): DiagramNodeRef[] {
    if (!prop.referenceTargetTypes || prop.referenceTargetTypes.length === 0) return diagramNodes;
    const allowed = new Set<string>(prop.referenceTargetTypes);
    return diagramNodes.filter((n) => allowed.has(n.typeId));
  }

  // Group properties by group name
  let grouped = $derived.by(() => {
    const groups = new Map<string, PropertySchema[]>();
    const sorted = [...properties].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    for (const prop of sorted) {
      if (!isVisible(prop, values)) continue;
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
      {@const isVariable = showVariableToggle && supportsVariableToggle(prop.type) && getVariableMode(prop.key) === 'variable'}
      <div class="field">
        <label class="field-label">
          <span class="label-row">
            <span class="label-text">
              {prop.label}
              {#if prop.required}<span class="required">*</span>{/if}
            </span>
            {#if showVariableToggle && supportsVariableToggle(prop.type)}
              <button
                type="button"
                class="var-toggle"
                class:is-variable={isVariable}
                onclick={(e) => { e.preventDefault(); toggleVariableMode(prop.key); }}
                title={isVariable ? 'Using variable (click to use literal value)' : 'Using literal value (click to make variable)'}
              >
                {#if isVariable}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span>var</span>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                {/if}
              </button>
            {/if}
          </span>

          {#if prop.type === 'string' || prop.type === 'cidr'}
            <input
              type={prop.sensitive && !isVariable ? 'password' : 'text'}
              placeholder={isVariable ? '(using variable)' : prop.placeholder}
              value={(values[prop.key] as string) ?? ''}
              oninput={(e) => handleStringInput(prop.key, e)}
              disabled={isVariable}
              class:is-variable-input={isVariable}
            />

          {:else if prop.type === 'number'}
            <input
              type="number"
              placeholder={isVariable ? '(using variable)' : prop.placeholder}
              value={(values[prop.key] as number) ?? ''}
              min={prop.validation?.min}
              max={prop.validation?.max}
              oninput={(e) => handleNumberInput(prop.key, e)}
              disabled={isVariable}
              class:is-variable-input={isVariable}
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

          {:else if prop.type === 'reference'}
            {@const options = getReferenceOptions(prop)}
            <select
              value={references[prop.key] ?? ''}
              onchange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                onReferenceChange?.(prop.key, val || null);
              }}
            >
              <option value="">None</option>
              {#each options as opt}
                <option value={opt.id}>{opt.label}</option>
              {/each}
            </select>

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
  input[type='password'],
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
  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .var-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .var-toggle:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .var-toggle.is-variable {
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
    background: rgba(34, 197, 94, 0.08);
  }
  .var-toggle.is-variable:hover {
    border-color: rgba(34, 197, 94, 0.6);
    background: rgba(34, 197, 94, 0.12);
  }
  .var-toggle svg {
    flex-shrink: 0;
  }
  .is-variable-input {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--color-surface-hover) !important;
    border-style: dashed !important;
  }
  .is-variable-input::placeholder {
    color: #22c55e;
    font-style: italic;
  }
</style>

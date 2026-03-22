<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import type { NodeFormatting } from '@terrastudio/types';

  let { data, id, selected }: { data: any; id: string; selected?: boolean } = $props();

  let fmt = $derived((data.formatting as NodeFormatting | undefined) ?? {});

  let noteText = $derived((data.properties?.description as string) ?? '');
  let noteLabel = $derived((data.displayLabel || data.properties?.name || '') as string);

  // Default sticky note color — warm yellow
  let bgColor = $derived(fmt.backgroundColor ?? '#fef3c7');
  let borderColor = $derived(fmt.borderColor ?? '#f59e0b');
  let opacity = $derived(fmt.opacity ?? 1);
  let fontSize = $derived.by(() => {
    const sizeMap = { small: '11px', medium: '13px', large: '15px' };
    return fmt.fontSize ? sizeMap[fmt.fontSize] : '13px';
  });

  let isEditing = $state(false);
  let editEl: HTMLTextAreaElement | undefined = $state();

  function startEditing() {
    isEditing = true;
    // Focus after Svelte renders the textarea
    queueMicrotask(() => editEl?.focus());
  }

  function stopEditing() {
    isEditing = false;
  }

  function onTextInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    diagram.updateNodeData(id, {
      properties: { ...data.properties, description: value },
    });
  }

  function onLabelInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    diagram.updateNodeData(id, {
      properties: { ...data.properties, name: value },
      displayLabel: value || undefined,
    });
  }

  function onKeydown(e: KeyboardEvent) {
    // Escape exits editing
    if (e.key === 'Escape') {
      stopEditing();
      e.stopPropagation();
    }
    // Stop propagation so SvelteFlow doesn't process typing as shortcuts
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sticky-note"
  class:selected
  style="background-color: {bgColor}; border-color: {borderColor}; opacity: {opacity};"
  ondblclick={startEditing}
>
  {#if isEditing}
    <input
      class="sticky-label-input"
      type="text"
      placeholder="Title..."
      value={noteLabel}
      oninput={onLabelInput}
      onkeydown={onKeydown}
      style="font-size: {fontSize};"
    />
    <textarea
      class="sticky-textarea"
      bind:this={editEl}
      placeholder="Type your note..."
      value={noteText}
      oninput={onTextInput}
      onkeydown={onKeydown}
      onblur={stopEditing}
      style="font-size: {fontSize}; font-weight: {fmt.fontBold ? 'bold' : 'normal'}; font-style: {fmt.fontItalic ? 'italic' : 'normal'}; text-align: {fmt.textAlign ?? 'left'};"
    ></textarea>
  {:else}
    <div class="sticky-content" style="font-size: {fontSize}; font-weight: {fmt.fontBold ? 'bold' : 'normal'}; font-style: {fmt.fontItalic ? 'italic' : 'normal'}; text-align: {fmt.textAlign ?? 'left'};">
      {#if noteLabel}
        <div class="sticky-label">{noteLabel}</div>
      {/if}
      <div class="sticky-text" class:placeholder={!noteText}>
        {noteText || 'Double-click to edit'}
      </div>
    </div>
  {/if}

  <!-- Decorative fold corner -->
  <div class="fold-corner" style="border-top-color: {borderColor};"></div>
</div>

<style>
  .sticky-note {
    width: 180px;
    min-height: 100px;
    padding: 10px 12px;
    border: 1px solid;
    border-radius: 2px;
    box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.15);
    position: relative;
    cursor: grab;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: box-shadow 0.15s;
  }
  .sticky-note.selected {
    box-shadow: 0 0 0 2px var(--color-accent), 2px 3px 8px rgba(0, 0, 0, 0.2);
  }

  .sticky-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 60px;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .sticky-label {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.7;
    color: #78350f;
  }

  .sticky-text {
    color: #451a03;
    line-height: 1.4;
  }
  .sticky-text.placeholder {
    opacity: 0.4;
    font-style: italic;
  }

  .sticky-label-input {
    background: transparent;
    border: none;
    border-bottom: 1px dashed rgba(0, 0, 0, 0.2);
    outline: none;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #78350f;
    padding: 0 0 2px;
    margin-bottom: 2px;
    width: 100%;
  }

  .sticky-textarea {
    flex: 1;
    min-height: 60px;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #451a03;
    line-height: 1.4;
    padding: 0;
    font-family: inherit;
    width: 100%;
  }
  .sticky-textarea::placeholder {
    color: rgba(69, 26, 3, 0.4);
    font-style: italic;
  }

  .fold-corner {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 12px 12px 0;
    border-right-color: var(--color-bg, #1a1a2e);
    border-bottom-color: transparent;
    border-left-color: transparent;
    opacity: 0.5;
  }
</style>

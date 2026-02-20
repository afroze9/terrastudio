<script lang="ts">
  import { terraform } from '$lib/stores/terraform.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { tick } from 'svelte';

  let outputEl: HTMLPreElement | undefined = $state();
  let isResizing = $state(false);

  // Auto-scroll when output changes
  $effect(() => {
    terraform.outputLines;
    tick().then(() => {
      if (outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });
  });

  function onResizeMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startY = e.clientY;
    const startHeight = ui.terminalPanelHeight;

    function onMouseMove(e: MouseEvent) {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      ui.terminalPanelHeight = newHeight;
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

{#if ui.showTerminal}
  <div class="terminal-panel" style="height: {ui.terminalPanelHeight}px">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      class:active={isResizing}
      onmousedown={onResizeMouseDown}
    ></div>
    <div class="terminal-header">
      <span class="terminal-title">TERMINAL</span>
      <button class="terminal-btn" onclick={() => terraform.clearOutput()}>Clear</button>
      <button class="terminal-btn" onclick={() => ui.toggleTerminal()}>Hide</button>
    </div>
    <pre class="terminal-output" bind:this={outputEl}>{#each terraform.outputLines as line}<span class={line.stream === 'stderr' ? 'line-stderr' : 'line-stdout'}>{line.line}
</span>{/each}</pre>
  </div>
{/if}

<style>
  .terminal-panel {
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex-shrink: 0;
    position: relative;
  }
  .resize-handle {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 4px;
    cursor: row-resize;
    z-index: 10;
  }
  .resize-handle:hover, .resize-handle.active {
    background: var(--color-accent);
    opacity: 0.5;
  }
  .terminal-header {
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: 30px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    gap: 8px;
  }
  .terminal-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    flex: 1;
  }
  .terminal-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 6px;
  }
  .terminal-btn:hover {
    color: var(--color-text);
  }
  .terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    margin: 0;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .line-stdout {
    color: var(--color-text-muted);
  }
  .line-stderr {
    color: #ef4444;
  }
</style>

<script lang="ts">
  import { terraform } from '$lib/stores/terraform.svelte';
  import { tick } from 'svelte';

  let outputEl: HTMLPreElement | undefined = $state();

  // Auto-scroll when output changes
  $effect(() => {
    terraform.outputLines;
    tick().then(() => {
      if (outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });
  });
</script>

<div class="terminal-tab">
  <div class="terminal-toolbar">
    <button class="toolbar-btn" onclick={() => terraform.clearOutput()}>Clear</button>
  </div>
  <pre class="terminal-output" bind:this={outputEl}>{#each terraform.outputLines as line}<span class={line.stream === 'stderr' ? 'line-stderr' : 'line-stdout'}>{line.line}
</span>{/each}</pre>
</div>

<style>
  .terminal-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .terminal-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px;
    height: 24px;
    flex-shrink: 0;
    gap: 4px;
  }
  .toolbar-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .toolbar-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }
  .terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 4px 12px;
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

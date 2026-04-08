<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { tick } from 'svelte';

  let outputEl: HTMLPreElement | undefined = $state();

  // Auto-scroll when output changes
  $effect(() => {
    git.outputLines;
    tick().then(() => {
      if (outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });
  });
</script>

<div class="git-output-tab">
  <pre class="git-output" bind:this={outputEl}>{#each git.outputLines as entry}<span class="log-line"><span class="log-time">[{entry.timestamp}]</span> {entry.line}
</span>{/each}</pre>
</div>

<style>
  .git-output-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .git-output {
    flex: 1;
    overflow-y: auto;
    padding: 4px 12px;
    margin: 0;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: var(--font-12);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .log-line {
    color: var(--color-text-muted);
  }
  .log-time {
    color: var(--color-text-muted);
    opacity: 0.5;
  }
</style>

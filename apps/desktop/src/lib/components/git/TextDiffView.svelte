<script lang="ts">
  import { computeTextDiff, type DiffLine } from '$lib/services/text-diff';

  interface Props {
    beforeText?: string;
    afterText?: string;
    filename?: string;
  }

  const { beforeText = '', afterText = '', filename = '' }: Props = $props();

  const diff = $derived(computeTextDiff(beforeText, afterText));

  let leftScroll = $state<HTMLElement | null>(null);
  let rightScroll = $state<HTMLElement | null>(null);
  let syncing = false;

  function syncScroll(source: 'left' | 'right') {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      const from = source === 'left' ? leftScroll : rightScroll;
      const to = source === 'left' ? rightScroll : leftScroll;
      if (from && to) {
        to.scrollTop = from.scrollTop;
      }
      syncing = false;
    });
  }
</script>

<div class="text-diff">
  <div class="diff-panel">
    <div class="panel-header">Before</div>
    <div
      class="panel-content"
      bind:this={leftScroll}
      onscroll={() => syncScroll('left')}
    >
      {#each diff.left as line, i (i)}
        <div class="diff-line {line.type}">
          <span class="line-num">{line.leftLine ?? ''}</span>
          <span class="line-content">{line.content}</span>
        </div>
      {/each}
    </div>
  </div>
  <div class="divider"></div>
  <div class="diff-panel">
    <div class="panel-header">After</div>
    <div
      class="panel-content"
      bind:this={rightScroll}
      onscroll={() => syncScroll('right')}
    >
      {#each diff.right as line, i (i)}
        <div class="diff-line {line.type}">
          <span class="line-num">{line.rightLine ?? ''}</span>
          <span class="line-content">{line.content}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .text-diff {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .diff-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .panel-header {
    padding: 6px 12px;
    font-size: var(--font-11);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    text-align: center;
    flex-shrink: 0;
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
    background: var(--color-bg);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
  }
  .divider {
    width: 1px;
    background: var(--color-border);
    flex-shrink: 0;
  }
  .diff-line {
    display: flex;
    padding: 0 8px;
    white-space: pre;
    min-height: 18px;
  }
  .diff-line.added {
    background: rgba(78, 201, 107, 0.1);
  }
  .diff-line.removed {
    background: rgba(255, 80, 80, 0.1);
  }
  .line-num {
    width: 40px;
    text-align: right;
    padding-right: 12px;
    color: var(--color-text-muted);
    opacity: 0.5;
    user-select: none;
    flex-shrink: 0;
  }
  .line-content {
    flex: 1;
  }
  .added .line-content {
    color: var(--color-success, #4ec96b);
  }
  .removed .line-content {
    color: var(--color-error, #ff5050);
  }
</style>

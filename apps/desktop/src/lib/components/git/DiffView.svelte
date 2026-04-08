<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import DiffCanvas from './DiffCanvas.svelte';
  import TextDiffView from './TextDiffView.svelte';
  import type { DiffableSnapshot } from '$lib/services/diff-engine';

  let activeMode = $state<'diagram' | 'terraform'>(git.diffInitialMode);

  // Sync when diffInitialMode changes (e.g., clicking a terraform file while diff is open)
  $effect(() => {
    activeMode = git.diffInitialMode;
  });

  function closeDiff() {
    git.exitDiffMode();
    ui.closeDiffTab();
  }

  /** Compute a shared bounding box from both snapshots' nodes, including dimensions */
  function computeSharedBounds(before: DiffableSnapshot, after: DiffableSnapshot) {
    const allNodes = [...before.nodes, ...after.nodes];
    if (allNodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 500, maxY: 500 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of allNodes) {
      // Only consider root-level nodes (no parentId) for bounds
      // Children are positioned relative to their parent
      if (n.parentId) continue;
      const x = n.position.x;
      const y = n.position.y;
      const w = n.width ?? 200;
      const h = n.height ?? 80;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    // Add some padding
    const pad = 50;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  const sharedBounds = $derived(
    git.diffBefore && git.diffAfter
      ? computeSharedBounds(git.diffBefore, git.diffAfter)
      : { minX: 0, minY: 0, maxX: 500, maxY: 500 },
  );
</script>

<div class="diff-view">
  <div class="diff-banner">
    <div class="diff-tabs">
      <button
        class="diff-tab"
        class:active={activeMode === 'diagram'}
        onclick={() => (activeMode = 'diagram')}
      >
        Diagram
      </button>
      <button
        class="diff-tab"
        class:active={activeMode === 'terraform'}
        onclick={() => (activeMode = 'terraform')}
      >
        Terraform
      </button>
    </div>
    <span class="diff-title">{git.diffTitle}</span>
    <button class="close-btn" onclick={closeDiff} title="Close diff view (Esc)">×</button>
  </div>

  <div class="diff-content">
    {#if activeMode === 'diagram'}
      {#if git.diffBefore && git.diffAfter && git.diffResult}
        <div class="canvas-side">
          <div class="canvas-header">Before</div>
          <div class="canvas-body">
            <DiffCanvas
              snapshot={git.diffBefore}
              diff={git.diffResult}
              side="before"
              bounds={sharedBounds}
            />
          </div>
        </div>
        <div class="divider"></div>
        <div class="canvas-side">
          <div class="canvas-header">After</div>
          <div class="canvas-body">
            <DiffCanvas
              snapshot={git.diffAfter}
              diff={git.diffResult}
              side="after"
              bounds={sharedBounds}
            />
          </div>
        </div>
      {:else}
        <div class="loading">Loading diff...</div>
      {/if}
    {:else}
      <TextDiffView
        beforeText={git.diffFileBeforeText}
        afterText={git.diffFileAfterText}
        filename={git.diffFileName}
      />
    {/if}
  </div>
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeDiff(); }} />

<style>
  .diff-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .diff-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    height: 36px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }
  .diff-tabs {
    display: flex;
    gap: 2px;
  }
  .diff-tab {
    padding: 4px 10px;
    font-size: var(--font-11);
    background: none;
    border: none;
    border-radius: 3px;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .diff-tab:hover {
    background: var(--color-surface-hover);
  }
  .diff-tab.active {
    background: var(--color-surface-hover);
    color: var(--color-text);
    font-weight: 500;
  }
  .diff-title {
    flex: 1;
    font-size: var(--font-11);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 18px;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .diff-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  .canvas-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .canvas-header {
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
  .canvas-body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .divider {
    width: 1px;
    background: var(--color-border);
    flex-shrink: 0;
  }
  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: var(--font-12);
  }
</style>

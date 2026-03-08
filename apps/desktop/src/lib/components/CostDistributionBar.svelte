<script lang="ts">
  import type { CostGroup } from '$lib/stores/cost.svelte';

  let {
    groups,
    total,
    maxSegments = 6,
  }: {
    groups: CostGroup[];
    total: number | null;
    maxSegments?: number;
  } = $props();

  const SEGMENT_COLORS = [
    'var(--color-accent)',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
  ];

  const segments = $derived.by(() => {
    if (!total || total <= 0) return [];

    // Filter groups with cost > 0, sorted by subtotal desc
    const priced = groups
      .filter((g) => g.subtotal > 0)
      .sort((a, b) => b.subtotal - a.subtotal);

    if (priced.length === 0) return [];

    const result: { label: string; pct: number; color: string }[] = [];
    let remainder = 0;

    for (let i = 0; i < priced.length; i++) {
      const pct = (priced[i].subtotal / total) * 100;
      if (i < maxSegments) {
        result.push({
          label: priced[i].label,
          pct,
          color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        });
      } else {
        remainder += pct;
      }
    }

    if (remainder > 0) {
      result.push({
        label: 'Other',
        pct: remainder,
        color: '#6b7280',
      });
    }

    return result;
  });
</script>

{#if segments.length > 0}
  <div class="distribution-bar" role="img" aria-label="Cost distribution">
    {#each segments as seg (seg.label)}
      <div
        class="segment"
        style:flex-grow={Math.max(seg.pct, 1)}
        style:background={seg.color}
        title="{seg.label}: {Math.round(seg.pct)}%"
      ></div>
    {/each}
  </div>
  <div class="legend">
    {#each segments as seg (seg.label)}
      <span class="legend-item">
        <span class="legend-dot" style:background={seg.color}></span>
        <span class="legend-label">{seg.label}</span>
      </span>
    {/each}
  </div>
{/if}

<style>
  .distribution-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    gap: 1px;
    margin: 8px 0 4px;
  }

  .segment {
    min-width: 4px;
    border-radius: 2px;
    transition: flex-grow 0.3s ease;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-bottom: 6px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: var(--font-9);
    color: var(--color-text-muted);
    white-space: nowrap;
  }
</style>

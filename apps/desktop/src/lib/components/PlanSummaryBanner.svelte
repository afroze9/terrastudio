<script lang="ts">
  import { plan } from '$lib/stores/plan.svelte';
  import { terraform } from '$lib/stores/terraform.svelte';
  import { applyFromPlan } from '$lib/services/terraform-service';
  import { diagram } from '$lib/stores/diagram.svelte';

  let isStale = $derived.by(() => {
    if (!plan.diagramHash) return false;
    const currentHash = JSON.stringify(
      diagram.nodes
        .filter((n) => !n.id.startsWith('_'))
        .map((n) => ({ id: n.id, tf: n.data.terraformName })),
    );
    return currentHash !== plan.diagramHash;
  });

  let capturedTime = $derived.by(() => {
    if (!plan.planResult?.capturedAt) return '';
    try {
      return new Date(plan.planResult.capturedAt).toLocaleTimeString();
    } catch {
      return '';
    }
  });

  let noChanges = $derived(
    plan.summary.toCreate === 0 &&
    plan.summary.toUpdate === 0 &&
    plan.summary.toDelete === 0,
  );

  async function handleApply() {
    await applyFromPlan();
  }
</script>

{#if plan.active}
  <div class="plan-banner" role="status">
    <span class="plan-label">Plan Review</span>
    {#if noChanges}
      <span class="badge noop">No changes</span>
    {:else}
      {#if plan.summary.toCreate > 0}
        <span class="badge create">+{plan.summary.toCreate} to create</span>
      {/if}
      {#if plan.summary.toUpdate > 0}
        <span class="badge update">~{plan.summary.toUpdate} to change</span>
      {/if}
      {#if plan.summary.toDelete > 0}
        <span class="badge destroy">-{plan.summary.toDelete} to destroy</span>
      {/if}
    {/if}
    {#if isStale}
      <span class="stale-warning">Diagram changed since plan</span>
    {/if}
    {#if capturedTime}
      <span class="captured-time">at {capturedTime}</span>
    {/if}
    <div class="banner-actions">
      {#if !noChanges}
        <button
          class="apply-btn"
          onclick={handleApply}
          disabled={terraform.isRunning}
        >Apply This Plan</button>
      {/if}
      <button class="dismiss-btn" onclick={() => plan.dismiss()} title="Dismiss plan review">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .plan-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 20;
    font-size: var(--font-12);
    white-space: nowrap;
  }

  .plan-label {
    font-weight: 600;
    color: var(--color-text);
  }

  .badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: var(--font-11);
    font-weight: 500;
  }
  .badge.create {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }
  .badge.update {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }
  .badge.destroy {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  .badge.noop {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
  }

  .stale-warning {
    color: #f59e0b;
    font-size: var(--font-11);
    font-style: italic;
  }

  .captured-time {
    color: var(--color-text-muted);
    font-size: var(--font-10);
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 4px;
  }

  .apply-btn {
    padding: 3px 10px;
    font-size: var(--font-11);
    border: 1px solid #22c55e;
    border-radius: 4px;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    cursor: pointer;
    font-weight: 500;
  }
  .apply-btn:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.2);
  }
  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
  }
  .dismiss-btn:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--color-text);
  }
</style>

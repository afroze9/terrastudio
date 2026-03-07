<script lang="ts">
  import type { DeploymentStatus } from '@terrastudio/types';
  import { t } from '$lib/i18n';

  let { status, errorMessage }: { status?: DeploymentStatus; errorMessage?: string } = $props();

  let tooltipText = $derived.by(() => {
    if (status === 'failed' && errorMessage) {
      return `${t('deployment.failed')} ${errorMessage}`;
    }
    return status ?? t('deployment.pending');
  });
</script>

<span
  class="badge"
  class:pending={!status || status === 'pending'}
  class:in-progress={status === 'creating' || status === 'updating'}
  class:created={status === 'created'}
  class:failed={status === 'failed'}
  class:destroyed={status === 'destroyed'}
  title={tooltipText}
  aria-label={tooltipText}
>
  {#if !status || status === 'pending'}
    <!-- hollow circle -->
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.5" />
    </svg>
  {:else if status === 'creating' || status === 'updating'}
    <!-- sync/arrows -->
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M8 3.5A3.2 3.2 0 0 0 5 2a3.2 3.2 0 0 0-3 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      <path d="M2 6.5A3.2 3.2 0 0 0 5 8a3.2 3.2 0 0 0 3-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      <path d="M8 2v1.5H6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M2 8V6.5h1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else if status === 'created'}
    <!-- checkmark -->
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2.5 5.5L4.5 7.5L7.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else if status === 'failed'}
    <!-- X mark -->
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  {:else if status === 'destroyed'}
    <!-- dash/minus -->
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3 5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  {/if}
</span>

<style>
  .badge {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .badge svg {
    width: 10px;
    height: 10px;
  }
  .pending {
    color: #6b7280;
  }
  .in-progress {
    color: #f59e0b;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .created {
    color: #22c55e;
  }
  .failed {
    color: #ef4444;
  }
  .destroyed {
    color: #6b7280;
    opacity: 0.4;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>

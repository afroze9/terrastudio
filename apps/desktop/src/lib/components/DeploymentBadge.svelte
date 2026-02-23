<script lang="ts">
  import type { DeploymentStatus } from '@terrastudio/types';

  let { status, errorMessage }: { status?: DeploymentStatus; errorMessage?: string } = $props();

  let tooltipText = $derived.by(() => {
    if (status === 'failed' && errorMessage) {
      return `Failed: ${errorMessage}`;
    }
    return status ?? 'pending';
  });
</script>

<span
  class="badge"
  class:pending={!status || status === 'pending'}
  class:creating={status === 'creating'}
  class:updating={status === 'updating'}
  class:created={status === 'created'}
  class:failed={status === 'failed'}
  class:destroyed={status === 'destroyed'}
  title={tooltipText}
></span>

<style>
  .badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }
  .pending {
    background: #6b7280;
  }
  .creating, .updating {
    background: #f59e0b;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .created {
    background: #22c55e;
  }
  .failed {
    background: #ef4444;
  }
  .destroyed {
    background: #6b7280;
    opacity: 0.4;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>

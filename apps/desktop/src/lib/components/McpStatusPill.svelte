<script lang="ts">
  import { onMount } from 'svelte';
  import { mcpStatus } from '$lib/mcp/mcp-status.svelte';

  onMount(() => mcpStatus.init());
</script>

<span
  class="mcp-pill"
  title={mcpStatus.error ?? `MCP Server: ${mcpStatus.status}${mcpStatus.ssePort ? ` (port ${mcpStatus.ssePort})` : ''}`}
>
  <span
    class="mcp-dot"
    class:pulse={mcpStatus.status === 'starting'}
    style="background: {mcpStatus.statusColor}"
  ></span>
  <span class="mcp-label">{mcpStatus.statusLabel}</span>
</span>

<style>
  .mcp-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
    cursor: default;
  }
  .mcp-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .mcp-dot.pulse {
    animation: mcp-pulse 1.5s ease-in-out infinite;
  }
  @keyframes mcp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .mcp-label {
    font-size: 10px;
  }
</style>

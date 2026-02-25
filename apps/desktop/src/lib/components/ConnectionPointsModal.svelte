<script lang="ts">
  import type { ConnectionPointConfig, ConnectionPointPosition, HandlePositionOverrides, HandleDefinition, OutputDefinition } from '@terrastudio/types';

  interface HandleInfo {
    id: string;
    label: string;
    type: 'source' | 'target';
    defaultPosition: ConnectionPointPosition;
    category: 'schema' | 'output';
  }

  interface Props {
    isOpen: boolean;
    nodeLabel: string;
    initialConnectionPoints: ConnectionPointConfig;
    initialHandlePositions: HandlePositionOverrides;
    schemaHandles: ReadonlyArray<HandleDefinition>;
    enabledOutputs: ReadonlyArray<OutputDefinition>;
    onSave: (connectionPoints: ConnectionPointConfig, handlePositions: HandlePositionOverrides) => void;
    onClose: () => void;
  }

  let { isOpen, nodeLabel, initialConnectionPoints, initialHandlePositions, schemaHandles, enabledOutputs, onSave, onClose }: Props = $props();

  // Local state for editing
  let connectionPoints = $state<ConnectionPointConfig>({ top: 0, bottom: 0, left: 0, right: 0 });
  let handlePositions = $state<HandlePositionOverrides>({});

  // Build list of handles that can have their position changed
  let allHandles = $derived.by(() => {
    const handles: HandleInfo[] = [];

    // Schema-defined handles
    for (const h of schemaHandles) {
      handles.push({
        id: h.id,
        label: h.label,
        type: h.type,
        defaultPosition: h.position,
        category: 'schema',
      });
    }

    // Enabled output handles
    for (const o of enabledOutputs) {
      handles.push({
        id: `out-${o.key}`,
        label: o.label,
        type: 'source',
        defaultPosition: 'right',
        category: 'output',
      });
    }

    return handles;
  });

  // Reset state when modal opens
  $effect(() => {
    if (isOpen) {
      connectionPoints = { ...initialConnectionPoints };
      handlePositions = { ...initialHandlePositions };
    }
  });

  function increment(side: keyof ConnectionPointConfig) {
    if (connectionPoints[side] < 5) {
      connectionPoints[side]++;
    }
  }

  function decrement(side: keyof ConnectionPointConfig) {
    if (connectionPoints[side] > 0) {
      connectionPoints[side]--;
    }
  }

  function getHandlePosition(handle: HandleInfo): ConnectionPointPosition {
    return handlePositions[handle.id] ?? handle.defaultPosition;
  }

  function setHandlePosition(handleId: string, position: ConnectionPointPosition, defaultPos: ConnectionPointPosition) {
    if (position === defaultPos) {
      // Remove override if setting back to default
      const { [handleId]: _, ...rest } = handlePositions;
      handlePositions = rest;
    } else {
      handlePositions = { ...handlePositions, [handleId]: position };
    }
  }

  function handleSave() {
    onSave(connectionPoints, handlePositions);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  const positions: ConnectionPointPosition[] = ['top', 'right', 'bottom', 'left'];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation"></div>
  <div class="modal" role="dialog" aria-labelledby="modal-title">
    <div class="modal-header">
      <h3 id="modal-title">Manage Handles</h3>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <p class="node-name">{nodeLabel}</p>

      <!-- Handle Position Section -->
      {#if allHandles.length > 0}
        <div class="section">
          <h4 class="section-title">Handle Positions</h4>
          <p class="section-desc">Move schema and output handles to different sides of the node.</p>

          <div class="handle-list">
            {#each allHandles as handle (handle.id)}
              <div class="handle-row">
                <div class="handle-info">
                  <span class="handle-label">{handle.label}</span>
                  <span class="handle-type" class:source={handle.type === 'source'} class:target={handle.type === 'target'}>
                    {handle.type}
                  </span>
                </div>
                <div class="position-buttons">
                  {#each positions as pos}
                    <button
                      class="pos-btn"
                      class:active={getHandlePosition(handle) === pos}
                      onclick={() => setHandlePosition(handle.id, pos, handle.defaultPosition)}
                      title={pos}
                    >
                      {pos.charAt(0).toUpperCase()}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Annotation Connection Points Section -->
      <div class="section">
        <h4 class="section-title">Annotation Connection Points</h4>
        <p class="section-desc">Add connection points for creating annotation edges.</p>

        <div class="node-preview">
          <!-- Top handles preview -->
          <div class="preview-side preview-top">
            {#each Array(connectionPoints.top) as _, i}
              <div class="preview-handle annotation"></div>
            {/each}
          </div>

          <!-- Left handles preview -->
          <div class="preview-side preview-left">
            {#each Array(connectionPoints.left) as _, i}
              <div class="preview-handle annotation"></div>
            {/each}
          </div>

          <!-- Center node representation -->
          <div class="preview-node">
            <span class="preview-label">Node</span>
          </div>

          <!-- Right handles preview -->
          <div class="preview-side preview-right">
            {#each Array(connectionPoints.right) as _, i}
              <div class="preview-handle annotation"></div>
            {/each}
          </div>

          <!-- Bottom handles preview -->
          <div class="preview-side preview-bottom">
            {#each Array(connectionPoints.bottom) as _, i}
              <div class="preview-handle annotation"></div>
            {/each}
          </div>
        </div>

        <div class="controls">
          <div class="control-row">
            <span class="control-label">Top</span>
            <div class="counter">
              <button class="counter-btn" onclick={() => decrement('top')} disabled={connectionPoints.top === 0}>-</button>
              <span class="counter-value">{connectionPoints.top}</span>
              <button class="counter-btn" onclick={() => increment('top')} disabled={connectionPoints.top >= 5}>+</button>
            </div>
          </div>

          <div class="control-row">
            <span class="control-label">Bottom</span>
            <div class="counter">
              <button class="counter-btn" onclick={() => decrement('bottom')} disabled={connectionPoints.bottom === 0}>-</button>
              <span class="counter-value">{connectionPoints.bottom}</span>
              <button class="counter-btn" onclick={() => increment('bottom')} disabled={connectionPoints.bottom >= 5}>+</button>
            </div>
          </div>

          <div class="control-row">
            <span class="control-label">Left</span>
            <div class="counter">
              <button class="counter-btn" onclick={() => decrement('left')} disabled={connectionPoints.left === 0}>-</button>
              <span class="counter-value">{connectionPoints.left}</span>
              <button class="counter-btn" onclick={() => increment('left')} disabled={connectionPoints.left >= 5}>+</button>
            </div>
          </div>

          <div class="control-row">
            <span class="control-label">Right</span>
            <div class="counter">
              <button class="counter-btn" onclick={() => decrement('right')} disabled={connectionPoints.right === 0}>-</button>
              <span class="counter-value">{connectionPoints.right}</span>
              <button class="counter-btn" onclick={() => increment('right')} disabled={connectionPoints.right >= 5}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary" onclick={handleSave}>Save</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    min-width: 400px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .node-name {
    margin: 0 0 16px 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .section {
    margin-bottom: 24px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 4px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .section-desc {
    margin: 0 0 12px 0;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* Handle Position Controls */
  .handle-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .handle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .handle-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .handle-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
  }

  .handle-type {
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    padding: 2px 5px;
    border-radius: 3px;
  }

  .handle-type.source {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .handle-type.target {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .position-buttons {
    display: flex;
    gap: 4px;
  }

  .pos-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .pos-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-text);
  }

  .pos-btn.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: #fff;
  }

  /* Node Preview */
  .node-preview {
    display: grid;
    grid-template-areas:
      ". top ."
      "left node right"
      ". bottom .";
    grid-template-columns: 40px 1fr 40px;
    grid-template-rows: 30px 60px 30px;
    gap: 4px;
    margin-bottom: 16px;
    justify-items: center;
    align-items: center;
  }

  .preview-side {
    display: flex;
    gap: 6px;
  }

  .preview-top {
    grid-area: top;
    flex-direction: row;
  }

  .preview-bottom {
    grid-area: bottom;
    flex-direction: row;
  }

  .preview-left {
    grid-area: left;
    flex-direction: column;
  }

  .preview-right {
    grid-area: right;
    flex-direction: column;
  }

  .preview-handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--color-surface);
    box-shadow: 0 0 0 1px var(--color-border);
  }

  .preview-handle.annotation {
    background: var(--edge-annotation);
  }

  .preview-node {
    grid-area: node;
    width: 100%;
    height: 100%;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  /* Controls */
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .control-label {
    font-size: 12px;
    color: var(--color-text);
  }

  .counter {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .counter-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .counter-btn:hover:not(:disabled) {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .counter-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .counter-value {
    width: 24px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .btn-secondary {
    background: var(--color-surface-hover);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background: var(--color-border);
  }

  .btn-primary {
    background: var(--color-accent);
    color: #fff;
  }

  .btn-primary:hover {
    background: var(--color-accent-hover);
  }
</style>

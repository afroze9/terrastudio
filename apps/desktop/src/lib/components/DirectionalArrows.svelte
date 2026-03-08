<script lang="ts">
  import type { ArrowDirection } from '$lib/stores/connection-ux.svelte';

  let { onArrowClick }: {
    onArrowClick: (direction: ArrowDirection) => void;
  } = $props();

  const allDirections: ArrowDirection[] = ['top', 'right', 'bottom', 'left'];

  function handleClick(direction: ArrowDirection, event: MouseEvent | PointerEvent) {
    // Stop both mousedown and pointerdown from reaching SvelteFlow's drag handlers
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();
    onArrowClick(direction);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="directional-arrows">
  <!-- Invisible padding zone that extends the hover area so arrows stay visible.
       Intercept pointer/mouse events so SvelteFlow doesn't start pane drag. -->
  <div class="hover-pad hover-pad-top" onpointerdown={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}></div>
  <div class="hover-pad hover-pad-right" onpointerdown={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}></div>
  <div class="hover-pad hover-pad-bottom" onpointerdown={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}></div>
  <div class="hover-pad hover-pad-left" onpointerdown={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}></div>

  {#each allDirections as direction}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="arrow arrow-{direction}"
      onpointerdown={(e) => handleClick(direction, e)}
      onmousedown={(e) => { e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault(); }}
      onclick={(e) => { e.stopPropagation(); e.stopImmediatePropagation(); }}
      role="button"
      tabindex="-1"
    >
      <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" stroke="none">
        <polygon points="7,0 14,8 0,8"/>
        <rect x="5" y="8" width="4" height="12" rx="1"/>
      </svg>
    </div>
  {/each}
</div>

<style>
  .directional-arrows {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  /* Invisible pads that extend the node hover area to cover the arrows */
  .hover-pad {
    position: absolute;
    pointer-events: all;
  }
  .hover-pad-top {
    top: -30px;
    left: 0;
    right: 0;
    height: 30px;
  }
  .hover-pad-right {
    right: -30px;
    top: 0;
    bottom: 0;
    width: 30px;
  }
  .hover-pad-bottom {
    bottom: -30px;
    left: 0;
    right: 0;
    height: 30px;
  }
  .hover-pad-left {
    left: -30px;
    top: 0;
    bottom: 0;
    width: 30px;
  }

  .arrow {
    position: absolute;
    width: 14px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: rgba(139, 144, 160, 0.5);
    cursor: pointer;
    pointer-events: all;
    transition: color 0.15s, opacity 0.15s;
    opacity: 0.7;
    outline: none;
  }

  .arrow:hover {
    color: #3b82f6;
    opacity: 1;
  }

  .arrow-top {
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-right {
    right: -26px;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
  }

  .arrow-bottom {
    bottom: -26px;
    left: 50%;
    transform: translateX(-50%) rotate(180deg);
  }

  .arrow-left {
    left: -26px;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
  }
</style>

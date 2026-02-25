<script lang="ts">
  /**
   * SVG marker definitions for edge arrows and endpoints.
   * Must be placed inside SvelteFlow to be accessible by edges.
   */
</script>

<svg style="position: absolute; width: 0; height: 0; overflow: hidden;">
  <defs>
    <!-- Open arrow marker -->
    <marker
      id="terrastudio-marker-arrow"
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path
        d="M 0 0 L 10 5 L 0 10"
        fill="none"
        stroke="context-stroke"
        stroke-width="1.5"
      />
    </marker>

    <!-- Closed/filled arrow marker -->
    <marker
      id="terrastudio-marker-arrowClosed"
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
    </marker>

    <!-- Dot marker -->
    <marker
      id="terrastudio-marker-dot"
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="4"
      markerHeight="4"
    >
      <circle cx="5" cy="5" r="4" fill="context-stroke" />
    </marker>
  </defs>
</svg>

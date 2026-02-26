<script lang="ts">
  /**
   * SVG marker definitions for edge arrows and endpoints.
   * Must be placed inside SvelteFlow to be accessible by edges.
   */
</script>

<svg style="position: absolute; width: 0; height: 0; overflow: hidden;">
  <defs>
    <!-- Open arrow marker (end) - points forward along path direction -->
    <marker
      id="terrastudio-marker-arrow"
      viewBox="0 0 12 12"
      refX="10"
      refY="6"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
    >
      <path
        d="M 2 2 L 10 6 L 2 10"
        fill="none"
        stroke="context-stroke"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </marker>

    <!-- Closed/filled arrow marker (end) - points forward along path direction -->
    <marker
      id="terrastudio-marker-arrowClosed"
      viewBox="0 0 12 12"
      refX="10"
      refY="6"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
    >
      <path d="M 2 2 L 10 6 L 2 10 z" fill="context-stroke" />
    </marker>

    <!-- Dot marker -->
    <marker
      id="terrastudio-marker-dot"
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto"
    >
      <circle cx="5" cy="5" r="3.5" fill="context-stroke" />
    </marker>

    <!-- Start markers (reversed) - for line start/source end -->
    <marker
      id="terrastudio-marker-arrow-start"
      viewBox="0 0 12 12"
      refX="2"
      refY="6"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
    >
      <path
        d="M 10 2 L 2 6 L 10 10"
        fill="none"
        stroke="context-stroke"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </marker>

    <marker
      id="terrastudio-marker-arrowClosed-start"
      viewBox="0 0 12 12"
      refX="2"
      refY="6"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
    >
      <path d="M 10 2 L 2 6 L 10 10 z" fill="context-stroke" />
    </marker>

    <marker
      id="terrastudio-marker-dot-start"
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto"
    >
      <circle cx="5" cy="5" r="3.5" fill="context-stroke" />
    </marker>
  </defs>
</svg>

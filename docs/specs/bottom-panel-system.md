# Bottom Panel System

## Overview

Extend the existing terminal panel into a multi-tab bottom panel system (similar to VS Code's bottom panel). This shared infrastructure hosts multiple tool panels — Problems, Search, Annotations, Connection Wizard, and the existing Terminal — in a single resizable area below the canvas.

## Motivation

Several planned features (canvas search, validation dashboard, annotations list, connection wizard) need a persistent UI area that doesn't compete with the side panel or properties panel. A tabbed bottom panel is the natural home for these tools, mirroring the pattern used by VS Code, JetBrains IDEs, and other desktop apps.

## Design

### Layout

```
+-------------------------------------------------------------------+
| Titlebar                                                          |
+--------+------------------------------------------+--------------+
| Activity| Canvas / Editor Area                     | Properties   |
| Bar     |                                          | Panel        |
|         |                                          |              |
+--------+------------------------------------------+--------------+
| [Terminal] [Problems] [Search] [Annotations]       | [x] Hide     |
| --------------------------------------------------------         |
| <tab content here>                                                |
+-------------------------------------------------------------------+
| Status Bar                                                        |
+-------------------------------------------------------------------+
```

### UI Store Changes

Add to `UiStore` in `ui.svelte.ts`:

```typescript
export type BottomPanelTab = 'terminal' | 'problems' | 'search' | 'annotations' | 'connection-wizard';

class UiStore {
  // Replace showTerminal with:
  showBottomPanel = $state(false);
  activeBottomTab = $state<BottomPanelTab>('terminal');
  bottomPanelHeight = $state(200);

  /** Open bottom panel to a specific tab */
  openBottomPanel(tab: BottomPanelTab) {
    this.activeBottomTab = tab;
    this.showBottomPanel = true;
  }

  /** Toggle bottom panel; if already showing the clicked tab, hide it */
  toggleBottomPanel(tab: BottomPanelTab) {
    if (this.showBottomPanel && this.activeBottomTab === tab) {
      this.showBottomPanel = false;
    } else {
      this.activeBottomTab = tab;
      this.showBottomPanel = true;
    }
  }
}
```

### Component: `BottomPanel.svelte`

Replaces the current `TerminalPanel.svelte`. Contains:

1. **Resize handle** — drag to resize height (100–600px), reuses existing resize pattern
2. **Tab bar** — horizontal tabs with labels + optional badge counts (e.g., "Problems (3)")
3. **Tab content area** — renders the active tab's component

Each tab is a standalone Svelte component:
- `TerminalTab.svelte` — migrated from current `TerminalPanel.svelte`
- `ProblemsTab.svelte` — validation dashboard (see [validation-dashboard.md](validation-dashboard.md))
- `SearchTab.svelte` — canvas search (see [canvas-search.md](canvas-search.md))
- `AnnotationsTab.svelte` — annotations list (see [diagram-annotations.md](diagram-annotations.md))
- `ConnectionWizardTab.svelte` — guided connection UI (see [connection-wizard.md](connection-wizard.md))

### Tab Badge Counts

Tabs can display a count badge next to their label:
- **Problems**: number of validation errors (red) + warnings (yellow)
- **Search**: number of matches found
- **Annotations**: total annotation count
- **Terminal**: no badge (or a dot when new output arrives while on another tab)

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle Bottom Panel | Ctrl+J |
| Terminal Tab | Ctrl+` (existing, now opens bottom panel + terminal tab) |
| Problems Tab | Ctrl+Shift+M |
| Search Tab | Ctrl+Shift+F |

### Migration from TerminalPanel

- `showTerminal` → `showBottomPanel` (with `activeBottomTab === 'terminal'`)
- `terminalPanelHeight` → `bottomPanelHeight`
- `toggleTerminal()` → `toggleBottomPanel('terminal')`
- All existing terminal keyboard shortcuts and status bar buttons continue to work
- The terminal button in the status bar now toggles the terminal tab specifically

### Persistence

- `bottomPanelHeight` saved to `localStorage` key `terrastudio-bottom-panel-height`
- `activeBottomTab` saved to `localStorage` key `terrastudio-bottom-tab`
- Panel visibility is NOT persisted (starts hidden on launch, like current terminal)

## Implementation Steps

1. Create `BottomPanel.svelte` with tab bar + resize handle
2. Migrate `TerminalPanel.svelte` content into `TerminalTab.svelte`
3. Update `UiStore` — replace `showTerminal`/`terminalPanelHeight` with bottom panel state
4. Update `+page.svelte` layout to use `BottomPanel` instead of `TerminalPanel`
5. Update `StatusBar.svelte` terminal button to use new API
6. Update `MenuBar.svelte` keyboard shortcut handlers
7. Add empty placeholder components for Problems, Search, Annotations tabs
8. Wire up badge counts as each feature spec is implemented

## Out of Scope

- Tab reordering / drag-and-drop tabs
- Detaching tabs into separate windows
- Custom user-defined tabs

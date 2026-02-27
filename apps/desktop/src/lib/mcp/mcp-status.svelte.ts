type McpStatus = 'idle' | 'disabled' | 'starting' | 'listening' | 'error';

interface McpStatusEvent {
  status: McpStatus;
  ipcPort?: number;
  ssePort?: number;
  error?: string;
}

class McpStatusStore {
  status = $state<McpStatus>('idle');
  ipcPort = $state<number | null>(null);
  ssePort = $state<number | null>(null);
  error = $state<string | null>(null);
  private _listening = false;

  get isRunning() {
    return this.status === 'listening';
  }

  get statusLabel(): string {
    switch (this.status) {
      case 'idle': return 'MCP';
      case 'disabled': return 'MCP Off';
      case 'starting': return 'MCP Starting...';
      case 'listening': return 'MCP';
      case 'error': return 'MCP Error';
    }
  }

  get statusColor(): string {
    switch (this.status) {
      case 'idle': return '#6b7280';
      case 'disabled': return '#6b7280';
      case 'starting': return '#eab308';
      case 'listening': return '#22c55e';
      case 'error': return '#ef4444';
    }
  }

  /** Call once from onMount to start listening for Tauri events. */
  init() {
    if (this._listening) return;
    this._listening = true;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<McpStatusEvent>('mcp:status_changed', (event) => {
        this.status = event.payload.status;
        if (event.payload.ipcPort !== undefined) {
          this.ipcPort = event.payload.ipcPort;
        }
        if (event.payload.ssePort !== undefined) {
          this.ssePort = event.payload.ssePort;
        }
        if (event.payload.error !== undefined) {
          this.error = event.payload.error;
        } else {
          this.error = null;
        }
      });
    }).catch(console.warn);
  }
}

export const mcpStatus = new McpStatusStore();

import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type { BridgeRequest, BridgeResponse, BridgePush } from './types.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type PushHandler = (data: unknown) => void;

export class BridgeClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private pushHandlers = new Map<string, Set<PushHandler>>();
  private port: number;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  private connectResolve: (() => void) | null = null;
  private requestTimeout = 30_000; // 30 seconds

  constructor(port: number) {
    this.port = port;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;

      const url = `ws://127.0.0.1:${this.port}`;
      console.error(`[terrastudio-mcp] Connecting to ${url}`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.error('[terrastudio-mcp] Connected to IPC bridge');
        this.reconnectAttempts = 0;
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
        }
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        console.error('[terrastudio-mcp] IPC connection closed');
        this.rejectAllPending(new Error('Connection closed'));
        if (!this.closing) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error(`[terrastudio-mcp] WebSocket error: ${err.message}`);
        if (this.connectResolve) {
          // First connection attempt failed
          if (this.reconnectAttempts === 0) {
            reject(err);
            this.connectResolve = null;
          }
        }
      });
    });
  }

  private handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);

      // Check if it's a response (has 'id' field)
      if ('id' in msg) {
        const response = msg as BridgeResponse;
        const pending = this.pending.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(response.id);
          if (response.error) {
            const err = new Error(response.error.message);
            (err as any).code = response.error.code;
            (err as any).details = response.error.details;
            pending.reject(err);
          } else {
            pending.resolve(response.result);
          }
        }
        return;
      }

      // Check if it's a push event (has 'event' field)
      if ('event' in msg) {
        const push = msg as BridgePush;
        const handlers = this.pushHandlers.get(push.event);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(push.data);
            } catch (e) {
              console.error(`[terrastudio-mcp] Push handler error for ${push.event}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('[terrastudio-mcp] Failed to parse message:', e);
    }
  }

  async request(command: string, params: unknown = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to IPC bridge');
    }

    const id = randomUUID();
    const request: BridgeRequest = { id, command, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${command}`));
      }, this.requestTimeout);

      this.pending.set(id, { resolve, reject, timer });

      this.ws!.send(JSON.stringify(request), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  onPush(event: string, handler: PushHandler): () => void {
    if (!this.pushHandlers.has(event)) {
      this.pushHandlers.set(event, new Set());
    }
    this.pushHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.pushHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.pushHandlers.delete(event);
        }
      }
    };
  }

  private scheduleReconnect() {
    if (this.closing || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[terrastudio-mcp] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;

    console.error(`[terrastudio-mcp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() failure will trigger another reconnect via 'close' event
      }
    }, delay);
  }

  private rejectAllPending(error: Error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new Error('Client closing'));
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

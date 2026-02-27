use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex, RwLock};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

use super::commands::dispatch_bridge_command;
use super::types::{BridgeRequest, BridgeResponse, BridgePush};

/// Outgoing message to the sidecar (either a response or a push).
/// Used by the outgoing channel for Rust → sidecar communication.
#[allow(dead_code)]
enum OutgoingMessage {
    Response(BridgeResponse),
    Push(BridgePush),
}

#[allow(dead_code)]
pub struct IpcBridgeServer {
    port: u16,
    outgoing_tx: mpsc::Sender<OutgoingMessage>,
    connected: Arc<RwLock<bool>>,
}

impl IpcBridgeServer {
    pub async fn start(app_handle: tauri::AppHandle) -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();

        let (outgoing_tx, outgoing_rx) = mpsc::channel::<OutgoingMessage>(256);
        let outgoing_rx = Arc::new(Mutex::new(outgoing_rx));
        let connected = Arc::new(RwLock::new(false));
        let connected_clone = connected.clone();
        let app_for_dispatch = app_handle.clone();

        tokio::spawn(async move {
            log::info!("MCP IPC bridge listening on 127.0.0.1:{}", port);

            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        log::info!("MCP sidecar connected from {}", addr);

                        match accept_async(stream).await {
                            Ok(ws_stream) => {
                                let (mut ws_sink, mut ws_read) = ws_stream.split();
                                *connected_clone.write().await = true;

                                let mut outgoing_rx_guard = outgoing_rx.lock().await;

                                loop {
                                    tokio::select! {
                                        // Incoming message from sidecar
                                        msg = ws_read.next() => {
                                            match msg {
                                                Some(Ok(Message::Text(text))) => {
                                                    if let Ok(request) = serde_json::from_str::<BridgeRequest>(&text) {
                                                        let mut response = dispatch_bridge_command(
                                                            &request.command,
                                                            request.params,
                                                            &app_for_dispatch,
                                                        ).await;
                                                        response.id = request.id;
                                                        if let Ok(json) = serde_json::to_string(&response) {
                                                            if ws_sink.send(Message::Text(json.into())).await.is_err() {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                Some(Ok(Message::Close(_))) | None => {
                                                    log::info!("MCP sidecar disconnected");
                                                    break;
                                                }
                                                Some(Err(e)) => {
                                                    log::error!("MCP WebSocket error: {}", e);
                                                    break;
                                                }
                                                _ => {}
                                            }
                                        }
                                        // Outgoing message to sidecar
                                        out = outgoing_rx_guard.recv() => {
                                            match out {
                                                Some(OutgoingMessage::Response(resp)) => {
                                                    if let Ok(json) = serde_json::to_string(&resp) {
                                                        if ws_sink.send(Message::Text(json.into())).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                }
                                                Some(OutgoingMessage::Push(push)) => {
                                                    if let Ok(json) = serde_json::to_string(&push) {
                                                        if ws_sink.send(Message::Text(json.into())).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                }
                                                None => break,
                                            }
                                        }
                                    }
                                }

                                *connected_clone.write().await = false;
                                drop(outgoing_rx_guard);
                                log::info!("MCP sidecar connection closed, waiting for reconnection...");
                            }
                            Err(e) => {
                                log::error!("WebSocket handshake failed: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to accept MCP connection: {}", e);
                    }
                }
            }
        });

        Ok(Self {
            port,
            outgoing_tx,
            connected,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    #[allow(dead_code)]
    pub async fn send_push(&self, event: &str, data: serde_json::Value) -> Result<(), String> {
        let push = BridgePush {
            event: event.to_string(),
            data,
        };
        self.outgoing_tx
            .send(OutgoingMessage::Push(push))
            .await
            .map_err(|e| e.to_string())
    }

    #[allow(dead_code)]
    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }
}

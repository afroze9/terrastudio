# PRD: MCP Server — Programmatic Control of TerraStudio via Model Context Protocol

**Document Version:** 1.0
**Date:** 2026-02-27
**Status:** Draft
**Author:** Product Team
**Stakeholders:** TBD (no named stakeholders provided)

---

## 1. Overview

### 1.1 Problem Statement

TerraStudio is operated entirely through its graphical user interface today. An infrastructure
engineer who wants to scaffold a multi-resource architecture must perform every action manually:
drag resources from the palette, configure each property in the sidebar, draw edges, and trigger
Terraform commands through the toolbar. There is no way for an AI assistant, a CI script, or any
external program to automate these tasks.

As AI coding assistants (Claude Desktop, VS Code with GitHub Copilot or Cline, Cursor, etc.) become
standard tools in engineering workflows, engineers expect to describe an architecture in natural
language and have the assistant build it for them. Without a programmatic interface, TerraStudio is
excluded from that workflow entirely.

The current workaround is for an AI assistant to generate raw Terraform HCL by hand and place it in
a directory — bypassing TerraStudio's visual model, validation, naming conventions, and
deployment-status tracking.

**Who experiences it**: Cloud infrastructure engineers and DevOps practitioners who already use AI
assistants in their daily work and expect those assistants to have tool access to their dev
environment.

### 1.2 Objective

Expose TerraStudio's full diagram and Terraform functionality as a Model Context Protocol (MCP)
server so that any MCP-compatible AI assistant or external program can:

1. Read the current diagram and project configuration as context.
2. Programmatically create, modify, and delete infrastructure resources on the canvas.
3. Trigger Terraform operations (init, plan, apply, destroy) and observe streaming output.
4. Query cost estimates and deployment status.

The MCP server shall ship as a first-class part of the TerraStudio application bundle — no separate
installation required by end users.

### 1.3 Background & Context

**Model Context Protocol** is an open standard developed by Anthropic (specification at
modelcontextprotocol.io) for exposing application capabilities to LLMs. MCP defines two primary
primitives:

- **Tools**: Callable functions that the LLM can invoke with structured arguments (analogous to
  function calling in the OpenAI API).
- **Resources**: Read-only documents or data that the LLM can load as context before generating a
  response (analogous to RAG documents).

MCP supports two transports:

- **stdio**: The MCP server process communicates over stdin/stdout. Used by Claude Desktop and VS
  Code extensions that spawn the server as a child process.
- **SSE/HTTP**: The server runs an HTTP server and pushes events over Server-Sent Events. Used by
  web-based clients.

**Tauri sidecar** is the appropriate integration point. Tauri 2 can bundle and launch an external
binary (the "sidecar") alongside the main app process. The sidecar handles MCP protocol concerns
while communicating with the main app process over a local channel (WebSocket or Tauri events). This
separation keeps MCP concerns out of the main Rust backend and allows the MCP server to be
implemented in Node.js, which has a mature MCP SDK (`@modelcontextprotocol/sdk`).

**Why now**: Phases 1–21 established the complete feature set (resources, HCL generation, Terraform
execution, cost estimation, export). Phase 24 is the natural integration point before the project
reaches GA.

---

## 2. Goals & Success Metrics

### 2.1 Business Goals

- Position TerraStudio as an AI-native infrastructure tool, not just a GUI diagramming app.
- Enable use cases where an engineer describes an architecture in chat and the AI builds it on the
  canvas without manual drag-and-drop.
- Create a documented, versioned API surface that other tools (CI systems, VS Code extensions,
  custom scripts) can integrate against.
- Differentiate TerraStudio from static Terraform code generators by offering live, interactive
  control over a running visual environment.

### 2.2 User Goals

- A user can instruct Claude Desktop (or any MCP-compatible assistant) to "scaffold a 3-tier Azure
  app" and have the assistant create Resource Group, VNet, Subnet, App Service Plan, App Service,
  and Key Vault nodes on the canvas automatically.
- A user can ask their AI assistant to "run terraform plan and summarize the changes" without
  leaving the chat interface.
- A user can query the assistant for cost estimates on the current diagram.
- A developer building a custom tool can integrate with TerraStudio's REST/SSE endpoint to drive
  diagram construction programmatically.
- A user who configures Claude Desktop or VS Code with the provided `mcp.json` manifest can
  immediately start using TerraStudio tools with zero additional setup.

### 2.3 Key Performance Indicators (KPIs)

- **MCP round-trip latency**: Time from tool call receipt to response returned for read-only tools
  (e.g., `get_diagram`, `list_resources`) — Target: under 200 ms — Measurement Method: end-to-end
  timing logged in MCP server debug output.
- **IPC bridge latency**: Time for a tool call that requires a Tauri IPC round-trip (e.g.,
  `add_resource`) — Target: under 500 ms excluding any Svelte rendering time — Measurement Method:
  timestamped log entries in the Rust IPC handler and MCP server.
- **Streaming Terraform output**: First line of `run_terraform` streaming output delivered to MCP
  client — Target: within 1 second of the Terraform subprocess emitting it — Measurement Method:
  manual timing with a `-auto-approve` plan run.
- **Tool discovery adoption** [Inferred — target TBD by stakeholders]: Percentage of new
  TerraStudio installs where `mcp.json` is configured in at least one AI assistant within 30 days.
- **Error rate**: Percentage of tool calls returning an MCP error response (excluding user errors
  like invalid input) — Target: under 1% — Measurement Method: MCP server error logs.
- **Bundle size increase**: Additional size added to the TerraStudio installer by the MCP sidecar —
  Target: under 15 MB — Measurement Method: installer diff before/after Phase 24.

---

## 3. User Stories & Use Cases

**US-01**: As a cloud infrastructure engineer using Claude Desktop, I want to ask the assistant to
build an architecture by describing it in natural language, so that resources appear on the
TerraStudio canvas without manual drag-and-drop.

- **Acceptance Criteria:**
  - [ ] Claude Desktop can discover the TerraStudio MCP server via the provided `mcp.json` manifest.
  - [ ] The assistant can invoke `get_available_resource_types` and receive a list of all registered
        resource types.
  - [ ] The assistant can invoke `add_resource` with a valid `typeId` and receive a confirmation
        containing the new node's `instanceId`.
  - [ ] After the assistant invokes `add_resource`, the corresponding node is visible on the
        TerraStudio canvas within 1 second.
  - [ ] The assistant can invoke `connect_resources` to draw an edge, which is visible on the canvas
        immediately.

**US-02**: As a cloud infrastructure engineer, I want to ask my AI assistant to run Terraform plan
on my current diagram and give me a summary, so that I can review infrastructure changes without
switching windows.

- **Acceptance Criteria:**
  - [ ] The assistant can invoke `generate_hcl` and receive back the contents of all generated `.tf`
        files.
  - [ ] The assistant can invoke `run_terraform` with `command: "plan"` and receive streamed output
        lines.
  - [ ] Each streamed output line is delivered to the MCP client within 1 second of Terraform
        emitting it.
  - [ ] When Terraform completes, the tool response includes the final exit code and a summary of
        planned changes.
  - [ ] If Terraform is not installed or not on PATH, the tool returns a descriptive error (not a
        silent failure).

**US-03**: As a cloud infrastructure engineer, I want to use the MCP server to programmatically save
and open TerraStudio projects, so that I can automate my project management workflow from a script
or AI assistant.

- **Acceptance Criteria:**
  - [ ] The assistant can invoke `new_project` with a name and directory path; TerraStudio creates
        the project folder and opens it.
  - [ ] The assistant can invoke `open_project` with a valid project path; TerraStudio loads the
        project and the diagram is visible on the canvas.
  - [ ] The assistant can invoke `save_project`; TerraStudio persists the current diagram state to
        disk.
  - [ ] All three tools return an error if the app has no open project where one is required.

**US-04**: As a VS Code user with the Cline extension, I want to read the current TerraStudio
diagram as context so the AI can answer questions about my architecture without me pasting the
diagram manually.

- **Acceptance Criteria:**
  - [ ] The TerraStudio MCP server exposes an MCP resource at URI `terrastudio://diagram/current`.
  - [ ] The resource content is a JSON representation of the current diagram (nodes + edges, with
        all properties).
  - [ ] The resource is updated whenever the diagram changes (or is re-fetched on access —
        acceptable for v1).
  - [ ] The MCP server exposes HCL file contents as individual MCP resources at
        `terrastudio://hcl/{filename}`.
  - [ ] An AI assistant with access to these resources can answer "what resources are in my current
        diagram?" without any tool call.

**US-05**: As a developer building a custom automation script, I want to connect to TerraStudio's
HTTP/SSE endpoint and programmatically build a diagram from a JSON specification, so that I can
batch-create infrastructure templates without using the GUI.

- **Acceptance Criteria:**
  - [ ] The MCP server exposes an HTTP/SSE endpoint (configurable port, default 7777) when the SSE
        transport is active.
  - [ ] The HTTP endpoint is only bound to `127.0.0.1` (localhost), not `0.0.0.0`.
  - [ ] An external script can connect to the SSE endpoint and invoke all available tools.
  - [ ] The endpoint port is shown in the TerraStudio UI (status bar or settings) so the user can
        verify it is running.

**US-06**: As an engineer, I want the MCP server to reject tool calls that would perform destructive
Terraform operations (apply, destroy) without explicit confirmation, so that an AI assistant cannot
accidentally provision or destroy cloud infrastructure.

- **Acceptance Criteria:**
  - [ ] `run_terraform` with `command: "apply"` or `command: "destroy"` requires a `confirmed: true`
        parameter in the input.
  - [ ] If `confirmed` is `false` or omitted, the tool returns a structured error:
        `{"error": "CONFIRMATION_REQUIRED", "message": "..."}`.
  - [ ] `run_terraform` with `command: "init"`, `"validate"`, or `"plan"` does not require the
        `confirmed` parameter.
  - [ ] The tool's input schema documents the `confirmed` parameter and its requirement for
        destructive commands.

**US-07** (error/negative case): As an AI assistant invoking MCP tools, when I provide an invalid
`typeId` to `add_resource`, I receive a structured error with a descriptive message and a list of
valid type IDs, so that I can correct the call without human intervention.

- **Acceptance Criteria:**
  - [ ] Supplying an unregistered `typeId` to `add_resource` returns an MCP error response (not an
        HTTP 500 or a silent no-op).
  - [ ] The error message includes the invalid value and states it was not found in the plugin
        registry.
  - [ ] The error response includes a `suggestions` field listing up to 5 resource type IDs that
        partially match the invalid input.
  - [ ] The canvas is not modified when this error occurs.

---

## 4. Functional Requirements

### 4.1 Transport and Server Lifecycle

**FR-01** [Must Have]: The MCP server SHALL be implemented as a Tauri sidecar process, declared in
`tauri.conf.json` under `bundle.externalBin`, and launched automatically when TerraStudio starts.

**FR-02** [Must Have]: The MCP server SHALL support the stdio transport mode, conforming to the MCP
specification, so that Claude Desktop and VS Code MCP extensions can launch it as a child process.

**FR-03** [Must Have]: The MCP server SHALL support the SSE/HTTP transport mode, bound exclusively
to `127.0.0.1` on a configurable port (default: 7777). The port SHALL be user-configurable via
TerraStudio settings.

**FR-04** [Must Have]: The MCP server process SHALL communicate with the Tauri main process over a
localhost WebSocket channel (the "IPC bridge"). The bridge endpoint SHALL be bound to `127.0.0.1`
on an ephemeral port negotiated at startup.

**FR-05** [Must Have]: The Tauri main process SHALL expose new Tauri commands (`mcp_get_diagram_snapshot`,
`mcp_add_resource`, `mcp_get_resource_types`, etc.) that the sidecar calls over the IPC bridge. The
sidecar SHALL NOT have direct filesystem access beyond what is passed through the bridge.

**FR-06** [Should Have]: When the SSE/HTTP transport is active, the MCP server SHALL display its
listening address in the TerraStudio status bar (e.g., "MCP: listening on 127.0.0.1:7777") and
allow the user to copy it.

**FR-07** [Must Have]: The MCP server SHALL gracefully shut down when the TerraStudio application
closes, releasing all bound ports and IPC channels.

**FR-08** [Should Have]: The MCP server SHALL expose a `/health` endpoint on the HTTP transport
that returns HTTP 200 with `{"status":"ok","version":"<app_version>"}`. This allows external tools
to verify the server is running.

### 4.2 Resource Tools

**FR-09** [Must Have]: The MCP server SHALL expose a `list_resources` tool that returns all nodes
currently on the diagram canvas. Each node entry SHALL include: `instanceId`, `typeId`, `label`,
`terraformName`, `properties`, `parentId` (if contained), and `deploymentStatus`.

**FR-10** [Must Have]: The MCP server SHALL expose an `add_resource` tool that accepts `typeId`
(required), `properties` (optional object), `position` (optional `{x, y}`), and `parentId`
(optional). The tool SHALL validate that `typeId` is registered in the plugin registry before
modifying the canvas.

**FR-11** [Must Have]: The MCP server SHALL expose an `update_resource` tool that accepts
`instanceId` (required) and `properties` (required partial object). Only the provided keys SHALL be
updated; unspecified properties SHALL remain unchanged.

**FR-12** [Must Have]: The MCP server SHALL expose a `remove_resource` tool that accepts
`instanceId` (required). When a container node is removed, all child nodes SHALL also be removed,
matching existing canvas delete behavior.

**FR-13** [Must Have]: The MCP server SHALL expose a `connect_resources` tool that accepts
`sourceInstanceId`, `sourceHandle`, `targetInstanceId`, and `targetHandle` (all required). The tool
SHALL validate the connection against the plugin registry's `ConnectionRule` set before creating
the edge.

**FR-14** [Must Have]: The MCP server SHALL expose a `disconnect_resources` tool that accepts
`edgeId` (required). The tool SHALL return an error if the edge does not exist.

**FR-15** [Should Have]: `add_resource` SHALL auto-position a new node if `position` is omitted,
placing it at an offset from the last-added node to avoid overlap, matching existing drag-from-palette
behavior.

**FR-16** [Should Have]: `add_resource` SHALL validate `parentId` against the schema's `canBeChildOf`
rule if provided, returning an error if the parent type does not accept the child type.

### 4.3 Project Tools

**FR-17** [Must Have]: The MCP server SHALL expose an `open_project` tool that accepts `projectPath`
(required, absolute path to a TerraStudio project directory). The tool SHALL invoke the existing
`load_project` Tauri command and return the loaded `ProjectData`.

**FR-18** [Must Have]: The MCP server SHALL expose a `save_project` tool with no required parameters.
It SHALL invoke the existing `save_diagram` Tauri command for the currently open project. The tool
SHALL return an error if no project is currently open.

**FR-19** [Must Have]: The MCP server SHALL expose a `new_project` tool that accepts `name`
(required) and `directoryPath` (required). It SHALL invoke the existing `create_project` Tauri
command and return the new `ProjectData`.

**FR-20** [Must Have]: The MCP server SHALL expose a `get_project_config` tool that returns the
current project's `ProjectConfig` as a JSON object (region, naming conventions, tags, backend
config, variable values).

**FR-21** [Should Have]: The MCP server SHALL expose a `set_project_config` tool that accepts a
partial `ProjectConfig` object and merges it into the current project config via the existing
`save_project_config` Tauri command.

### 4.4 Terraform Tools

**FR-22** [Must Have]: The MCP server SHALL expose a `generate_hcl` tool that triggers the HCL
pipeline and returns the contents of all generated Terraform files as a map of
`{filename: content}`.

**FR-23** [Must Have]: The MCP server SHALL expose a `run_terraform` tool that accepts `command`
(one of: `"init"`, `"validate"`, `"plan"`, `"apply"`, `"destroy"`) and optional `confirmed`
(boolean). For `"apply"` and `"destroy"`, `confirmed` must be `true`; otherwise the tool SHALL
return a `CONFIRMATION_REQUIRED` error without executing the command.

**FR-24** [Must Have]: `run_terraform` SHALL stream Terraform output to the MCP client via MCP's
progress notification mechanism (one notification per output line) while the command is running.
The final tool result SHALL include `exitCode`, `success`, and a `summary` of diagnostics and
resource changes.

**FR-25** [Must Have]: The MCP server SHALL expose a `get_deployment_status` tool that returns the
current deployment status for all nodes in the format `{instanceId: DeploymentStatus}`.

### 4.5 Query / Read Tools

**FR-26** [Must Have]: The MCP server SHALL expose a `get_diagram` tool that returns the complete
diagram snapshot: `{nodes: Node[], edges: Edge[]}`. The node format SHALL match `ResourceNodeData`
with all properties, references, and metadata included.

**FR-27** [Must Have]: The MCP server SHALL expose a `get_available_resource_types` tool that
returns all registered resource types grouped by provider and category. Each entry SHALL include
`typeId`, `displayName`, `category`, `description`, `isContainer`, `handles`, and the list of
`properties` from the schema.

**FR-28** [Should Have]: The MCP server SHALL expose an `estimate_costs` tool that triggers the
cost estimation pipeline and returns per-resource cost estimates in the format
`{instanceId: {monthly: number, currency: string, breakdown: object}}`.

### 4.6 MCP Resources (Read-only Context)

**FR-29** [Must Have]: The MCP server SHALL expose an MCP resource at URI
`terrastudio://diagram/current` that returns the current diagram as JSON. The `mimeType` SHALL be
`application/json`.

**FR-30** [Must Have]: The MCP server SHALL expose MCP resources for each generated HCL file at
URIs `terrastudio://hcl/main.tf`, `terrastudio://hcl/providers.tf`, etc. The `mimeType` SHALL be
`text/plain` (HCL is plain text).

**FR-31** [Should Have]: The MCP server SHALL expose an MCP resource at
`terrastudio://project/config` containing the current project config as JSON.

**FR-32** [Could Have]: The MCP server SHALL support resource subscriptions (MCP
`resources/subscribe`) so that an AI assistant is notified when the diagram changes, without
polling.

### 4.7 Packaging and Distribution

**FR-33** [Must Have]: The MCP sidecar SHALL be compiled/bundled and included in the TerraStudio
installer for all supported platforms (Windows, macOS, Linux).

**FR-34** [Must Have]: The app bundle SHALL include an `mcp.json` manifest file in a well-known
location (alongside the TerraStudio executable) so that Claude Desktop and VS Code can
auto-discover the server.

**FR-35** [Must Have]: The `mcp.json` manifest SHALL contain valid MCP server configuration
including the `command` to launch the server (stdio mode) and a `description` field.

**FR-36** [Should Have]: TerraStudio's main README and an in-app help page SHALL include step-by-step
instructions for connecting Claude Desktop, VS Code (Cline/Copilot), and Cursor to the MCP server.

---

## 5. Non-Functional Requirements

### Performance

- Read-only tool calls (`get_diagram`, `list_resources`, `get_available_resource_types`,
  `get_project_config`) SHALL respond within 200 ms end-to-end under a diagram of up to 100 nodes.
- Write tool calls (`add_resource`, `update_resource`, `remove_resource`, `connect_resources`)
  SHALL respond within 500 ms end-to-end, excluding any Svelte rendering animation time.
- `run_terraform` streaming latency SHALL be under 1 second from when Terraform emits a line to
  when the MCP client receives the notification.
- The IPC bridge between the sidecar and the Tauri main process SHALL handle at least 50 concurrent
  in-flight requests without queuing delays.

### Security

- The HTTP/SSE transport SHALL be bound exclusively to `127.0.0.1`. Binding to `0.0.0.0` is
  explicitly prohibited unless the user opts in via a settings flag that displays a prominent
  security warning.
- The MCP server SHALL not expose any Tauri capability that the main Tauri process has not
  explicitly granted. Specifically, it SHALL have no direct access to the filesystem; all file I/O
  SHALL go through the IPC bridge.
- Tool calls that perform Terraform `apply` or `destroy` SHALL require the `confirmed: true` flag
  (FR-23) to prevent accidental destructive operations from an AI assistant.
- The IPC bridge WebSocket SHALL accept connections only from `127.0.0.1`. The bridge endpoint
  SHALL use an ephemeral port that changes at each app startup to prevent port prediction by other
  processes.
- [Inferred] No API key, access token, or Azure credential SHALL ever be returned in a tool
  response. The `get_project_config` tool SHALL redact sensitive fields (e.g., `subscription_id`).
  Flag for stakeholder review: define exactly which fields are considered sensitive.

### Scalability

- The MCP server is a single-user desktop application feature. It is not expected to handle more
  than one concurrent AI assistant session. Multiple concurrent connections to the SSE endpoint are
  acceptable (up to 5) for scripting use cases.
- Diagram size up to 200 nodes and 300 edges SHALL be supported without performance degradation
  below the thresholds above.

### Accessibility

- The MCP server configuration UI (port display, enable/disable toggle) in TerraStudio SHALL meet
  WCAG 2.1 AA for contrast and keyboard navigability, consistent with the rest of the TerraStudio
  UI.

### Reliability

- The MCP sidecar process SHALL be automatically restarted by the Tauri shell plugin if it crashes,
  up to 3 times before marking it as failed and surfacing an error in the UI.
- The IPC bridge SHALL implement a reconnection protocol with exponential backoff (initial 200 ms,
  max 5 s, 5 retries) on connection loss.
- Tool calls that are in-flight when the IPC bridge disconnects SHALL return a structured
  `BRIDGE_DISCONNECTED` error to the MCP client rather than hanging indefinitely.

### Compatibility

- The MCP server SHALL implement MCP specification version 2025-03-26 (latest stable at time of
  writing).
- The stdio transport SHALL be compatible with Claude Desktop (version 0.7+), VS Code Cline
  extension (version 1.0+), and VS Code GitHub Copilot Chat (MCP support added Q1 2026).
- The SSE/HTTP transport SHALL follow the MCP HTTP+SSE transport spec.
- The sidecar binary SHALL target the same platform matrix as TerraStudio: Windows x64, macOS x64,
  macOS arm64, Linux x64.

---

## 6. Scope & Boundaries

### 6.1 In Scope

- MCP server sidecar process (Node.js, using `@modelcontextprotocol/sdk`).
- IPC bridge: new Tauri commands in `lib.rs` to expose diagram state and accept mutations.
- All 17 tools listed in sections 4.2–4.5.
- MCP resources: `terrastudio://diagram/current`, `terrastudio://hcl/{filename}`,
  `terrastudio://project/config`.
- stdio transport (for Claude Desktop / VS Code).
- SSE/HTTP transport (for custom scripts), localhost-bound only.
- `mcp.json` auto-discovery manifest bundled with the app.
- In-app MCP status indicator (listening address + enable/disable toggle).
- Documentation for connecting Claude Desktop, VS Code Cline, and Cursor.
- Confirmation guard on `apply` and `destroy` tool calls.
- Sidecar auto-restart via Tauri shell plugin on crash.

### 6.2 Out of Scope

- **Remote access / networking**: The MCP server is localhost-only. No TLS, no authentication
  tokens, no firewall configuration, no remote connections.
- **Multi-instance support**: Running multiple TerraStudio instances simultaneously with separate
  MCP servers is not supported in v1.
- **Diagram rendering / screenshots**: The MCP server will not expose image export capabilities.
  AI assistants cannot receive a PNG of the canvas.
- **Plugin management via MCP**: Installing, enabling, or disabling plugins via tool calls is out
  of scope.
- **Custom tool extensions by plugins**: Plugins cannot register additional MCP tools in v1.
  Deferred to future work.
- **OAuth / token-based auth for the SSE endpoint**: The endpoint is localhost-only; no auth layer
  is required or included.
- **Terraform variable input via MCP**: The `run_terraform` tool will use whatever `variableValues`
  are set in the project config. Interactive variable prompting is not supported.
- **Undo/redo via MCP**: Tool calls that modify the diagram will not push to the undo stack in v1.
  [Inferred risk — flag for stakeholder decision; see OQ-02.]

### 6.3 Future Considerations

- Plugin-extensible MCP tools (plugins register additional tools in a future version).
- MCP resource subscriptions (FR-32) if not completed in v1.
- Undo/redo integration so AI-driven changes can be undone from the TerraStudio UI.
- Remote (non-localhost) access with mutual TLS and API key authentication for enterprise use cases.
- MCP prompts: pre-defined prompt templates (e.g., "scaffold a 3-tier Azure app") exposed as MCP
  `prompts`.
- Batch tool: a single `execute_batch` tool that accepts an ordered array of tool calls and
  executes them transactionally, rolling back on error.

---

## 7. Design & UX Requirements

### MCP Status Indicator

A small status pill in the TerraStudio status bar (bottom strip, right side) SHALL display:

- "MCP Off" (grey) when the server is disabled.
- "MCP Listening" (green dot) when the SSE server is active, with the port number.
- "MCP Error" (red dot) when the sidecar failed to start.

Clicking the pill opens a popover with:

- Enable/disable toggle.
- Port field (editable, with a "Restart" button to apply changes).
- A "Copy MCP URL" button for the SSE endpoint.
- A "View Setup Guide" link opening the documentation.

### Settings Page — MCP Tab

A new "MCP Server" tab in TerraStudio Settings SHALL contain:

- Enable/disable toggle (default: enabled).
- HTTP/SSE port field (default: 7777, numeric input, range 1024–65535).
- A read-only display of the path to `mcp.json` (for manual Claude Desktop configuration).
- A "Copy mcp.json path" button.
- A "Test Connection" button that performs a `/health` request and displays the result.

### Canvas Behavior for AI-Driven Changes

- MCP tool calls that modify the diagram (add/remove/connect nodes) SHALL animate onto the canvas
  identically to user-initiated actions. No special visual distinction is needed for AI-driven
  changes in v1.
- If an `update_resource` call modifies a currently selected node, the property sidebar SHALL
  reflect the changes reactively via Svelte's existing `$state` reactivity.

### Design Artifacts Needed

- [Inferred] Wireframe for the MCP status pill and popover (to be produced by design team before
  implementation of FR-06).
- [Inferred] Wireframe for the MCP tab in Settings.

---

## 8. Technical Considerations

### 8.1 Sidecar Technology Choice

The MCP server sidecar SHALL be implemented in **Node.js** using the `@modelcontextprotocol/sdk`
npm package. Rationale:

- The MCP TypeScript SDK is the reference implementation and most mature.
- Node.js sidecars are a documented Tauri 2 pattern via `tauri_plugin_shell`.
- The sidecar can share TypeScript types from `@terrastudio/types` for diagram structures, avoiding
  type drift.
- Alternative (Rust): The `rmcp` crate is still early-stage as of early 2026. Revisit for v2 if
  bundle size becomes a concern.

The sidecar SHALL be bundled via **`esbuild`** into a single JS file and launched with a
platform-appropriate Node.js binary, OR compiled to a self-contained executable using **`pkg`** or
**Bun**. Final approach to be decided based on OQ-01 (see Open Questions).

### 8.2 IPC Bridge Architecture

```
+----------------------------------------------------------+
|  TerraStudio App Process (Tauri 2 + Svelte)              |
|                                                          |
|  +---------------------+    Tauri events                 |
|  | Svelte Diagram      |<-------------------------------+ |
|  | State ($state)      |                               | |
|  +---------------------+                               | |
|                                                        | |
|  +----------------------------------------------------+ | |
|  | Rust Backend — IPC Bridge Commands                 | | |
|  |  mcp_get_diagram_snapshot()                        | | |
|  |  mcp_add_resource(typeId, props, pos, parentId)    |-+ |
|  |  mcp_update_resource(instanceId, props)            |   |
|  |  mcp_remove_resource(instanceId)                   |   |
|  |  mcp_connect_resources(src, srcH, tgt, tgtH)       |   |
|  |  mcp_disconnect_resources(edgeId)                  |   |
|  |  mcp_get_resource_types()                          |   |
|  |  mcp_get_deployment_status()                       |   |
|  |  mcp_get_generated_hcl()                           |   |
|  |  mcp_estimate_costs()                              |   |
|  +---------------------------+------------------------+   |
|                              | WebSocket                  |
|                              | 127.0.0.1:EPHEMERAL_PORT   |
+------------------------------+----------------------------+
                               |
+------------------------------+----------------------------+
|  MCP Sidecar Process (Node.js)                           |
|                                                          |
|  +------------------------+  +------------------------+  |
|  | IPC Bridge Client      |  | MCP Server (@sdk)      |  |
|  | (WebSocket client)     |  |                        |  |
|  |                        |  | +--------------------+ |  |
|  | Translates MCP tool    |  | | stdio Transport    | |  |
|  | calls into IPC bridge  |  | +--------------------+ |  |
|  | command messages       |  | +--------------------+ |  |
|  |                        |  | | SSE/HTTP Transport | |  |
|  +------------------------+  | | 127.0.0.1:7777     | |  |
|                              | +--------------------+ |  |
|                              +------------------------+  |
+----------------------------------------------------------+
```

**Bridge message format** (JSON over WebSocket):

```typescript
// Request (sidecar -> Tauri)
interface BridgeRequest {
  id: string;       // UUID for response correlation
  command: string;  // e.g., "mcp_add_resource"
  params: unknown;
}

// Response (Tauri -> sidecar)
interface BridgeResponse {
  id: string;       // correlates to request id
  result?: unknown;
  error?: { code: string; message: string };
}

// Push event (Tauri -> sidecar, unsolicited)
interface BridgePush {
  event: string;    // e.g., "diagram:changed", "terraform:stdout"
  data: unknown;
}
```

### 8.3 New Tauri Commands Required

The following new commands SHALL be added to `lib.rs` and a new `src-tauri/src/mcp/` module:

| Command | Input | Output |
|---|---|---|
| `mcp_get_diagram_snapshot` | none | `DiagramSnapshot` (nodes + edges as JSON) |
| `mcp_add_resource` | `typeId, properties?, position?, parentId?` | `{instanceId: string}` |
| `mcp_update_resource` | `instanceId, properties` | `void` |
| `mcp_remove_resource` | `instanceId` | `void` |
| `mcp_connect_resources` | `sourceId, sourceHandle, targetId, targetHandle` | `{edgeId: string}` |
| `mcp_disconnect_resources` | `edgeId` | `void` |
| `mcp_get_resource_types` | none | `ResourceTypeInfo[]` |
| `mcp_get_deployment_status` | none | `Record<instanceId, DeploymentStatus>` |
| `mcp_get_generated_hcl` | none | `Record<filename, content>` |
| `mcp_estimate_costs` | none | `CostEstimateMap` |

Diagram mutation commands (`mcp_add_resource`, `mcp_update_resource`, `mcp_remove_resource`,
`mcp_connect_resources`, `mcp_disconnect_resources`) SHALL emit a Tauri event
`diagram:mcp_mutated` that the Svelte frontend listens to and applies to the `$state` diagram
store. This preserves the existing unidirectional data flow and avoids bypassing Svelte reactivity.

### 8.4 Diagram State Bridge (Frontend Side)

A new Svelte module `apps/desktop/src/lib/mcp/bridge-listener.ts` SHALL listen for
`diagram:mcp_mutated` events and dispatch corresponding diagram operations using the existing
`diagram.svelte.ts` store API. This is structurally analogous to how the palette drag-and-drop
handler adds nodes today.

### 8.5 Sidecar Port Negotiation

At startup, the Tauri main process SHALL:

1. Bind a WebSocket server to an ephemeral port on `127.0.0.1`.
2. Communicate the port number to the sidecar via an environment variable
   (`TERRASTUDIO_IPC_PORT`) set when launching the sidecar via `tauri_plugin_shell`.

### 8.6 `mcp.json` Manifest Format

The manifest SHALL be generated at first launch into the app's config directory. Format (Claude
Desktop compatible):

```json
{
  "mcpServers": {
    "terrastudio": {
      "command": "/path/to/TerraStudio/mcp-server",
      "args": [],
      "description": "TerraStudio — visual infrastructure diagram builder with Terraform execution"
    }
  }
}
```

For SSE mode (VS Code / custom scripts), a separate section in the setup documentation SHALL
describe the HTTP endpoint URL format (`http://127.0.0.1:7777/sse`).

### 8.7 New Package: `packages/mcp-server/`

A new monorepo package `packages/mcp-server/` SHALL be created:

```
packages/mcp-server/
├── package.json          # @terrastudio/mcp-server (private: true)
├── tsconfig.json
└── src/
    ├── index.ts          # Entry point: parse env, create transports, start server
    ├── server.ts         # McpServer instance with all tool/resource registrations
    ├── bridge.ts         # IPC bridge WebSocket client
    ├── tools/
    │   ├── resource-tools.ts   # list_resources, add_resource, update_resource,
    │   │                       # remove_resource, connect_resources, disconnect_resources
    │   ├── project-tools.ts    # open_project, save_project, new_project,
    │   │                       # get_project_config, set_project_config
    │   ├── terraform-tools.ts  # generate_hcl, run_terraform, get_deployment_status
    │   └── query-tools.ts      # get_diagram, get_available_resource_types, estimate_costs
    └── resources/
        ├── diagram-resource.ts  # terrastudio://diagram/current
        ├── hcl-resources.ts     # terrastudio://hcl/{filename}
        └── config-resource.ts   # terrastudio://project/config
```

### 8.8 Data Model Changes

No changes to `@terrastudio/types` are required for the MCP server itself. The MCP server uses
the existing `ResourceNodeData`, `ProjectConfig`, and `DeploymentStatus` types as its wire format.
A new `packages/mcp-server/src/schemas.ts` will define MCP-specific request/response schemas
using Zod for runtime validation of all tool inputs.

### 8.9 Technical Risk Notes

- **Sidecar bundle size**: A full Node.js runtime adds ~30–50 MB to the installer. Using `esbuild`
  to bundle the JS and shipping a minimal pre-built Node.js binary, or using Bun (~8 MB binary),
  can reduce this to under the 15 MB target. Final approach depends on OQ-01.
- **Diagram mutations on the renderer thread**: The Svelte frontend runs in the WebView. MCP
  mutations must be dispatched to the WebView via Tauri events, not direct Rust state manipulation.
  MCP write operations are inherently async with respect to the UI.
- **Race conditions**: If two tool calls mutate the diagram simultaneously, the Svelte store must
  serialize mutations. The IPC bridge SHALL process write requests sequentially using a request
  queue, not concurrently.

---

## 9. Dependencies & Risks

### 9.1 Dependencies

| Dependency | Type | Owner | Status | Impact if Delayed |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` (npm) | External library | Anthropic (open source) | Stable, v1.x released | MCP server cannot be implemented; no alternative |
| Tauri `tauri_plugin_shell` (sidecar support) | Platform feature | Tauri team | Available in Tauri 2.x | Must use alternative IPC (e.g., named pipes); increases complexity |
| Phase 21 Cost Estimation | Internal feature | TerraStudio team | Done (per roadmap) | `estimate_costs` tool unavailable; can be stubbed with empty response |
| Phase 21.6 TS Build Infra | Internal feature | TerraStudio team | Done (per roadmap) | MCP sidecar build pipeline harder to integrate into Turborepo |
| Phase 19 Import Terraform | Internal feature | TerraStudio team | Upcoming (2026-03-02) | No direct dependency; MCP can proceed independently |
| Node.js / Bun bundler decision (OQ-01) | Technical decision | TerraStudio team | Open | Affects sidecar binary size and startup time; blocks packaging work |

### 9.2 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| Node.js sidecar adds 30–50 MB to installer, exceeding the 15 MB target | High | Medium | Evaluate Bun runtime (smaller binary) or esbuild + minimal Node binary. Set final size target after a one-day spike before Phase 24a begins. |
| Diagram mutations from MCP cause visual glitches or state desync due to async WebView dispatch | Medium | High | Process all write requests sequentially via a single-writer mutex in the IPC bridge. Add an integration test that fires 20 rapid `add_resource` calls and verifies diagram node count and consistency. |
| AI assistant invokes `apply` or `destroy` without user awareness, incurring cloud costs or destroying infrastructure | Medium | Critical | `confirmed: true` guard (FR-23) is non-negotiable. Additionally surface a native OS toast notification when a destructive command is confirmed via MCP, giving the user a last-second awareness of the action. |
| MCP specification receives a breaking change before ship date | Low | Medium | Pin to a specific MCP spec version (2025-03-26). Monitor changelog. Abstract the transport layer so a spec upgrade is isolated to `server.ts`. |
| Port 7777 is already in use on the user's machine | Medium | Low | Implement port collision detection at startup; auto-increment to next available port and update the status bar display and `mcp.json` manifest accordingly. |
| Sidecar process is not cleaned up after a TerraStudio crash | Medium | Low | Register the sidecar PID in a lock file at startup. Add cleanup logic to the Tauri `on_window_close` hook and to the app's next startup sequence (stale PID check). |
| IPC bridge WebSocket adds observable latency making AI-assisted diagramming feel slow | Low | Medium | Benchmark during Phase 24a. If p95 latency exceeds 500 ms on a local loop, investigate switching write operations to Tauri's built-in `invoke` IPC available to sidecars in Tauri 2. |

---

## 10. Release Strategy

### Phasing

**Phase 24a — Core Infrastructure (2026-03-07 to 2026-03-10)**

- `packages/mcp-server/` scaffolding with IPC bridge client and Zod schema definitions.
- New Tauri commands: `mcp_get_diagram_snapshot`, `mcp_get_resource_types`.
- Read-only tools: `get_diagram`, `list_resources`, `get_available_resource_types`.
- MCP resource: `terrastudio://diagram/current`.
- stdio transport only (no SSE yet).
- `mcp.json` manifest generation on first launch.

**Phase 24b — Write Tools + Project Tools (2026-03-10 to 2026-03-12)**

- Write tools: `add_resource`, `update_resource`, `remove_resource`, `connect_resources`,
  `disconnect_resources`.
- Project tools: `open_project`, `save_project`, `new_project`, `get_project_config`,
  `set_project_config`.
- `diagram:mcp_mutated` event pipeline and `bridge-listener.ts` in the Svelte frontend.
- `confirmed: true` guard implemented and tested.

**Phase 24c — Terraform Tools + SSE Transport + UI (2026-03-12 to 2026-03-14)**

- Terraform tools: `generate_hcl`, `run_terraform` (with streaming + confirmation guard),
  `get_deployment_status`.
- `estimate_costs` tool.
- HCL file MCP resources (`terrastudio://hcl/{filename}`).
- SSE/HTTP transport (localhost-bound, configurable port).
- In-app MCP status indicator (status bar pill).
- Settings page MCP tab.
- README documentation for Claude Desktop and VS Code Cline setup.

**General Availability (2026-03-14)**

Bundled in TerraStudio version 0.6.0 (minor version bump — new feature, backward-compatible).

### Feature Flag

The MCP server is gated by an `enableMcpServer` flag in TerraStudio settings (default: `true` for
all users from 0.6.0). If the sidecar fails to start, TerraStudio continues to function normally;
the MCP status pill shows "MCP Error" with a tooltip containing the failure reason.

### Rollback Plan

Because the MCP server is an additive feature running as a separate sidecar process, rollback is
straightforward:

- Disable the feature flag via the Settings toggle; the sidecar will not be launched on next
  startup.
- In a worst case (e.g., installer regression), a patch release (0.6.1) that excludes the sidecar
  binary can be published within hours.
- No diagram file format changes are introduced by Phase 24. Project files from 0.6.x are fully
  compatible with 0.5.x.

### Communication Plan

- Release notes entry describing MCP server capability and linking to the setup guide.
- README update with MCP configuration instructions for Claude Desktop, VS Code Cline, and Cursor.
- [Inferred] A short demo GIF showing Claude Desktop controlling TerraStudio — high adoption value.

---

## 11. Open Questions

**OQ-01** [Blocking]: What runtime and bundler should the MCP sidecar use?

- Option A: Node.js bundled via `pkg` (~30 MB self-contained binary, well-tested)
- Option B: Bun (~8 MB binary, faster startup, but npm compatibility may have edge cases)
- Option C: Rust with `rmcp` crate (~1 MB, smallest, but SDK is immature and TypeScript types would
  not be reusable)

Decision needed before Phase 24a begins, as it directly affects the build pipeline and installer
size targets.

**OQ-02** [Blocking]: Should MCP-driven diagram mutations be pushed to the undo/redo stack? If yes,
the user can Ctrl+Z an AI-generated change. If no, AI-driven changes are permanent until manually
reversed. The current undo system (if any) needs to be assessed before Phase 24b begins.

**OQ-03** [Non-blocking]: Should `get_project_config` redact `subscription_id` and other Azure
credential fields, or return them verbatim? Verbatim is more useful to the AI (it can check which
subscription is configured) but exposes IDs in LLM context windows. Resolution: define a
`sensitiveKeys` list in the project config schema and redact by default.

**OQ-04** [Non-blocking]: Does the `@modelcontextprotocol/sdk` (v1.x) support streaming tool
output via progress notifications as described in FR-24? If not, `run_terraform` output will be
buffered and returned as a single response when the Terraform process exits, which degrades the UX
for long-running applies. Verify SDK streaming support before committing to the streaming design.

**OQ-05** [Non-blocking]: What is the confirmed installer size budget? The 15 MB target in the KPIs
is inferred from general expectations. Stakeholders should confirm whether this is a hard limit or a
soft target, as it directly drives the runtime choice (OQ-01).

**OQ-06** [Non-blocking]: Where should the `mcp.json` manifest be written? Options:

- App installation directory (requires elevated permissions to update on some systems)
- User home / app-data directory (easier to update, but path varies by OS and by MCP client)
- Both (install-time copy + user-directory copy)

Claude Desktop looks for server config at `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS). Convention varies by client. A setup wizard that writes to the correct location per-client
may be the best UX.

**OQ-07** [Non-blocking]: Should there be a native OS notification (toast) when an AI assistant
confirms `apply` or `destroy` via MCP? This adds a layer of user awareness but may be intrusive in
automated scripting workflows where the user is not present.

**OQ-08** [Non-blocking]: Should `add_resource` emit a Tauri event that the frontend listens to
(event-driven, preserves unidirectional data flow), or should the Rust IPC command directly mutate
an internal diagram state model that the frontend then reads reactively? The former is preferred for
architectural consistency; the latter may be worth exploring for batch performance.

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|---|---|
| **MCP** | Model Context Protocol — open standard by Anthropic for exposing application capabilities to LLMs as tools and resources. Spec: modelcontextprotocol.io |
| **Sidecar** | A companion process bundled with a Tauri application and managed by `tauri_plugin_shell`. Runs alongside the main Tauri process with its own lifecycle. |
| **IPC Bridge** | The local WebSocket channel between the MCP sidecar and the Tauri main process. Allows the sidecar to invoke Tauri commands without a WebView context. |
| **stdio transport** | MCP transport where the server communicates over stdin/stdout of a spawned child process. Used by Claude Desktop and VS Code extensions. |
| **SSE/HTTP transport** | MCP transport where the server exposes an HTTP endpoint with Server-Sent Events for push notifications. Used by web-based clients and scripts. |
| **Tool** | An MCP primitive representing a callable function with a defined input schema and output schema. Equivalent to a "function" in OpenAI function calling. |
| **Resource** | An MCP primitive representing read-only content (text, JSON, binary) that an LLM can load as context before generating a response. |
| **ResourceTypeId** | TerraStudio's fully qualified identifier for a cloud resource type. Format: `{provider}/{category}/{resource}` (e.g., `azurerm/networking/virtual_network`). |
| **instanceId** | A UUID identifying a specific resource node on the TerraStudio diagram canvas. Corresponds to the Svelte Flow `node.id`. |
| **HCL** | HashiCorp Configuration Language — the syntax used by Terraform configuration files (`.tf`). |
| **Confirmation guard** | The `confirmed: true` parameter required on destructive MCP tool calls that prevents accidental cloud operations by an AI assistant. |
| **`pkg`** | A Node.js bundler that compiles a Node.js application and its dependencies into a self-contained cross-platform executable binary. |
| **Bun** | An alternative JavaScript runtime and bundler with faster startup and a smaller binary footprint than Node.js. |
| **CONFIRMATION_REQUIRED** | The structured error code returned when `run_terraform` is called with `command: "apply"` or `command: "destroy"` without `confirmed: true`. |

### 12.2 Tool Input/Output Schemas (Abbreviated)

Full Zod schemas to be defined in `packages/mcp-server/src/schemas.ts`. The following summarizes
the wire format for the primary tools.

**`list_resources`**

```typescript
// Input: none
interface ResourceEntry {
  instanceId:       string;
  typeId:           string;   // e.g., "azurerm/networking/virtual_network"
  label:            string;
  terraformName:    string;
  properties:       Record<string, unknown>;
  references:       Record<string, string>;   // propertyKey -> targetInstanceId
  parentId?:        string;
  deploymentStatus: 'pending' | 'creating' | 'updating' | 'created' | 'failed' | 'destroyed';
  position:         { x: number; y: number };
}
type ListResourcesOutput = ResourceEntry[];
```

**`add_resource`**

```typescript
interface AddResourceInput {
  typeId:       string;                       // Required; must be registered in plugin registry
  properties?:  Record<string, unknown>;      // Partial — schema defaults applied for missing keys
  position?:    { x: number; y: number };     // Optional — auto-placed if omitted
  parentId?:    string;                       // Optional — instanceId of a container node
}
interface AddResourceOutput {
  instanceId:    string;
  terraformName: string;
  position:      { x: number; y: number };
}
```

**`update_resource`**

```typescript
interface UpdateResourceInput {
  instanceId:  string;
  properties:  Record<string, unknown>;   // Partial — only listed keys are updated
}
// Output: void on success; MCP error if instanceId not found
```

**`connect_resources`**

```typescript
interface ConnectResourcesInput {
  sourceInstanceId: string;
  sourceHandle:     string;
  targetInstanceId: string;
  targetHandle:     string;
}
interface ConnectResourcesOutput {
  edgeId: string;
}
```

**`run_terraform`**

```typescript
interface RunTerraformInput {
  command:    'init' | 'validate' | 'plan' | 'apply' | 'destroy';
  confirmed?: boolean;   // Must be true for 'apply' and 'destroy'
}
// During execution: MCP progress notifications with payload { line: string, stream: 'stdout' | 'stderr' }
interface RunTerraformOutput {
  exitCode:        number;
  success:         boolean;
  diagnostics:     Array<{ severity: string; summary: string; detail: string }>;
  resourceChanges: Array<{ address: string; action: string; success: boolean; error?: string }>;
}
```

**`get_available_resource_types`**

```typescript
// Input: none
interface ResourceTypeInfo {
  typeId:       string;    // e.g., "azurerm/networking/virtual_network"
  displayName:  string;    // e.g., "Virtual Network"
  category:     string;    // e.g., "networking"
  provider:     string;    // e.g., "azurerm"
  description:  string;
  isContainer:  boolean;
  canBeChildOf: string[];
  handles:      Array<{
    id:        string;
    type:      'source' | 'target';
    label:     string;
    position:  'top' | 'bottom' | 'left' | 'right';
  }>;
  properties:   Array<{
    key:          string;
    label:        string;
    type:         string;
    required:     boolean;
    description?: string;
    defaultValue?: unknown;
  }>;
}
type GetAvailableResourceTypesOutput = ResourceTypeInfo[];
```

### 12.3 Reference Documents

- MCP Specification (2025-03-26): https://spec.modelcontextprotocol.io/specification/2025-03-26/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Tauri Sidecar Documentation: https://tauri.app/plugin/shell/#sidecar
- Tauri `tauri_plugin_shell` Crate: https://docs.rs/tauri-plugin-shell
- TerraStudio Architecture: `docs/architecture.md`
- TerraStudio Type Interfaces: `docs/type-interfaces.md`
- TerraStudio HCL Generation: `docs/hcl-generation.md`
- TerraStudio Project Structure: `docs/project-structure.md`
- TerraStudio Implementation Roadmap: `docs/implementation-roadmap.md`

### 12.4 Related PRDs

None yet. This is the first PRD produced for TerraStudio. Future PRDs (Phase 22 Module Support,
Phase 23 Multi-Provider) will follow this format.

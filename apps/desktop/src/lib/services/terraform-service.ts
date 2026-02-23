import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { DeploymentStatus, ResourceTypeId } from '@terrastudio/types';
import { HclPipeline, validateDiagram, validateNetworkTopology } from '@terrastudio/core';
import { registry, edgeValidator } from '$lib/bootstrap';
import { diagram } from '$lib/stores/diagram.svelte';
import { project } from '$lib/stores/project.svelte';
import {
  terraform,
  type TerraformCommand,
  type TerraformJsonResult,
} from '$lib/stores/terraform.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { convertToResourceInstances, extractOutputBindings } from './diagram-converter';

/**
 * Compute a simple hash of diagram state for change detection.
 */
function computeDiagramHash(): string {
  const state = {
    nodes: diagram.nodes.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data,
      parentId: n.parentId,
    })),
    edges: diagram.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
  return JSON.stringify(state);
}

/**
 * Check if terraform CLI is available.
 */
export async function checkTerraform(): Promise<void> {
  try {
    const version = await invoke<string>('check_terraform');
    terraform.terraformVersion = version;
    terraform.terraformInstalled = true;
  } catch {
    terraform.terraformInstalled = false;
  }
}

/**
 * Generate HCL from the current diagram and write to the project's terraform/ folder.
 */
export async function generateAndWrite(): Promise<void> {
  if (!project.path) throw new Error('No project open');

  terraform.setStatus('generating');
  terraform.appendInfo('--- Generating Terraform ---');

  try {
    // Clear any previous validation errors from all nodes (no side-effects on stale/dirty)
    diagram.clearAllValidationErrors();

    // Convert diagram to ResourceInstances
    const connectionRules = registry.getConnectionRules();
    const resources = convertToResourceInstances(
      diagram.nodes,
      diagram.edges,
      connectionRules,
      (typeId) => registry.getResourceSchema(typeId),
    );

    // Validate diagram before generation
    const validation = validateDiagram(resources, registry);
    if (!validation.valid) {
      for (const diagramError of validation.errors) {
        terraform.appendError(
          `[${diagramError.label}] ${diagramError.errors.map((e) => e.message).join(', ')}`,
        );
        diagram.setNodeValidationErrors(diagramError.instanceId, diagramError.errors);
      }
      terraform.appendError(
        `Validation failed with ${validation.errors.length} resource(s) having errors. Fix issues and try again.`,
      );
      terraform.setStatus('error');
      throw new Error('Diagram validation failed');
    }

    // Validate network topology (subnet CIDR containment + overlap detection)
    const topologyErrors = validateNetworkTopology(diagram.nodes as any);
    if (topologyErrors.length > 0) {
      let hasErrors = false;
      for (const topoError of topologyErrors) {
        const node = diagram.nodes.find((n) => n.id === topoError.instanceId);
        const label = node?.data?.label ?? topoError.instanceId;
        diagram.setNodeValidationErrors(topoError.instanceId, topoError.errors);
        for (const err of topoError.errors) {
          if (err.severity === 'error') {
            terraform.appendError(`[${label}] ${err.message}`);
            hasErrors = true;
          } else {
            terraform.appendInfo(`Warning: [${label}] ${err.message}`);
          }
        }
      }
      if (hasErrors) {
        terraform.appendError('Network topology validation failed. Fix CIDR issues and try again.');
        terraform.setStatus('error');
        throw new Error('Network topology validation failed');
      }
    }

    terraform.appendInfo('Validation passed.');

    // Extract output bindings from edges
    const bindings = extractOutputBindings(
      diagram.edges,
      diagram.nodes,
      edgeValidator,
    );

    // Run HCL pipeline
    const pipeline = new HclPipeline(registry);
    const result = pipeline.generate({
      resources,
      projectConfig: project.projectConfig,
      bindings,
    });

    // Store collected variables for UI display
    terraform.collectedVariables = result.collectedVariables;

    terraform.setStatus('writing');

    // Filter out empty files and send to Rust backend
    const fileMap: Record<string, string> = {};
    for (const [name, content] of Object.entries(result.files)) {
      if (content.trim()) {
        fileMap[name] = content;
      }
    }

    const outputPath = await invoke<string>('write_terraform_files', {
      projectPath: project.path,
      files: fileMap,
    });

    // Populate generated file list for TerraformSidebar
    ui.generatedFiles = Object.keys(fileMap);

    // Mark files as up-to-date with current diagram state
    const diagramHash = computeDiagramHash();
    terraform.markFilesGenerated(diagramHash);

    terraform.appendInfo(
      `Generated ${Object.keys(fileMap).length} files to ${outputPath}`,
    );
    terraform.setStatus('success');
  } catch (err) {
    terraform.appendError(`Generation failed: ${err}`);
    terraform.setStatus('error');
    throw err;
  }
}

/**
 * Validate that all required variables have values before running terraform.
 * Returns list of missing variable names, or empty array if all are satisfied.
 */
export function validateVariablesBeforeRun(): string[] {
  const missing = terraform.getMissingVariables(project.projectConfig.variableValues);
  return missing.map(v => v.name);
}

/**
 * Build a lookup map from terraform address to diagram node ID.
 */
function buildAddressToNodeIdMap(): Map<string, string> {
  const addressToNodeId = new Map<string, string>();
  for (const node of diagram.nodes) {
    const typeId = node.data.typeId as ResourceTypeId;
    const schema = registry.getResourceSchema(typeId);
    if (!schema) continue;
    // Skip virtual nodes (no real Terraform resource)
    if (schema.terraformType.startsWith('_')) continue;

    // Use generator's resolveTerraformType if available (handles OS variants)
    const generator = registry.getHclGenerator(typeId);
    const tfType = generator.resolveTerraformType
      ? generator.resolveTerraformType(node.data.properties)
      : schema.terraformType;
    const address = `${tfType}.${node.data.terraformName}`;
    addressToNodeId.set(address, node.id);
  }
  return addressToNodeId;
}

/**
 * Update diagram nodes with error status from terraform result.
 */
function updateNodeErrorStatus(result: TerraformJsonResult) {
  const addressToNodeId = buildAddressToNodeIdMap();

  // Clear previous error states
  for (const node of diagram.nodes) {
    if (node.data.deploymentStatus === 'failed') {
      diagram.updateNodeData(node.id, { deploymentStatus: 'pending' });
    }
  }

  // Set error status on failed resources
  for (const [address, _errorMsg] of terraform.errorAddresses) {
    const nodeId = addressToNodeId.get(address);
    if (nodeId) {
      diagram.updateNodeData(nodeId, { deploymentStatus: 'failed' });
    }
  }
}

/**
 * Run a terraform command, streaming output to the terraform store.
 * For plan/apply/destroy, uses JSON mode for structured error parsing.
 */
export async function runTerraformCommand(
  command: TerraformCommand,
): Promise<boolean> {
  if (!project.path) throw new Error('No project open');

  // For commands that modify infrastructure, check for stale files
  if (['plan', 'apply', 'destroy'].includes(command) && terraform.filesStale) {
    const proceed = await ui.confirm({
      title: 'Terraform Files Out of Date',
      message: 'The diagram has changed since the last generation. Do you want to regenerate terraform files first?',
      confirmLabel: 'Regenerate & Run',
      cancelLabel: 'Run Anyway',
    });
    if (proceed) {
      try {
        await generateAndWrite();
      } catch {
        return false;
      }
    }
  }

  // For apply/destroy, validate that required variables have values
  if (['apply', 'destroy'].includes(command)) {
    const missingVars = validateVariablesBeforeRun();
    if (missingVars.length > 0) {
      terraform.appendError(
        `Missing required variable values: ${missingVars.join(', ')}. ` +
        `Please fill in all required variables in the project configuration before running ${command}.`
      );
      terraform.setStatus('error');
      return false;
    }
  }

  terraform.setStatus('running', command);
  terraform.appendInfo(`\n--- terraform ${command} ---\n`);
  terraform.clearErrors();

  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(
    await listen<{ stream: string; line: string }>(
      'terraform:stdout',
      (event) => {
        terraform.appendOutput({
          stream: 'stdout',
          line: event.payload.line,
        });
      },
    ),
  );

  unlisteners.push(
    await listen<{ stream: string; line: string }>(
      'terraform:stderr',
      (event) => {
        terraform.appendOutput({
          stream: 'stderr',
          line: event.payload.line,
        });
      },
    ),
  );

  try {
    // Commands with JSON output (plan, apply, destroy)
    if (['plan', 'apply', 'destroy'].includes(command)) {
      const result = await invoke<TerraformJsonResult>(
        `terraform_${command}`,
        { projectPath: project.path },
      );

      // Store result and extract error info
      terraform.setLastResult(result);

      // Update node error status
      if (!result.success) {
        updateNodeErrorStatus(result);

        // Log errors to output
        for (const diag of result.diagnostics) {
          if (diag.severity === 'error') {
            terraform.appendError(`Error: ${diag.summary}`);
            if (diag.detail) {
              terraform.appendError(`  ${diag.detail}`);
            }
            if (diag.address) {
              terraform.appendError(`  Resource: ${diag.address}`);
            }
          }
        }
      }

      terraform.setStatus(result.success ? 'success' : 'error');
      return result.success;
    }

    // Commands without JSON output (init, validate)
    const success = await invoke<boolean>(
      `terraform_${command}`,
      { projectPath: project.path },
    );

    terraform.setStatus(success ? 'success' : 'error');
    return success;
  } catch (err) {
    terraform.appendError(`Command failed: ${err}`);
    terraform.setStatus('error');
    return false;
  } finally {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  }
}

/**
 * Terraform show -json resource structure (subset of fields we care about).
 */
interface TerraformStateResource {
  type: string;
  name: string;
  address: string;
  values: Record<string, unknown>;
}

interface TerraformShowJson {
  values?: {
    root_module?: {
      resources?: TerraformStateResource[];
      child_modules?: {
        resources?: TerraformStateResource[];
      }[];
    };
  };
}

/**
 * Refresh deployment status for all diagram nodes by querying terraform state.
 * Calls `terraform show -json` and matches deployed resources to diagram nodes.
 */
export async function refreshDeploymentStatus(): Promise<void> {
  if (!project.path) return;

  // Build a lookup: "terraform_type.terraform_name" -> nodeId
  const addressToNodeId = new Map<string, string>();
  for (const node of diagram.nodes) {
    const typeId = node.data.typeId as ResourceTypeId;
    const schema = registry.getResourceSchema(typeId);
    if (!schema) continue;
    // Skip virtual nodes (no real Terraform resource)
    if (schema.terraformType.startsWith('_')) continue;

    // Use generator's resolveTerraformType if available (handles OS variants)
    const generator = registry.getHclGenerator(typeId);
    const tfType = generator.resolveTerraformType
      ? generator.resolveTerraformType(node.data.properties)
      : schema.terraformType;
    const address = `${tfType}.${node.data.terraformName}`;
    addressToNodeId.set(address, node.id);
  }

  // Track which nodes are found in state
  const deployedNodeIds = new Set<string>();

  try {
    const jsonStr = await invoke<string>('terraform_show', {
      projectPath: project.path,
    });

    const state: TerraformShowJson = JSON.parse(jsonStr);
    const resources = collectStateResources(state);

    for (const resource of resources) {
      const address = `${resource.type}.${resource.name}`;
      const nodeId = addressToNodeId.get(address);
      if (nodeId) {
        deployedNodeIds.add(nodeId);
      }
    }
  } catch {
    // terraform show failed — likely no state file yet, mark all as pending
  }

  // Suppress stale marking during status updates to prevent auto-regen loop
  terraform.beginStatusRefresh();
  try {
    // Update all diagram nodes
    for (const node of diagram.nodes) {
      let status: DeploymentStatus;
      if (deployedNodeIds.has(node.id)) {
        status = 'created';
      } else {
        status = 'pending';
      }

      if (node.data.deploymentStatus !== status) {
        diagram.updateNodeData(node.id, { deploymentStatus: status });
      }
    }
  } finally {
    terraform.endStatusRefresh();
  }
}

/**
 * Collect all resources from terraform show -json output,
 * including nested child modules.
 */
function collectStateResources(state: TerraformShowJson): TerraformStateResource[] {
  const resources: TerraformStateResource[] = [];
  const rootModule = state.values?.root_module;
  if (!rootModule) return resources;

  if (rootModule.resources) {
    resources.push(...rootModule.resources);
  }

  if (rootModule.child_modules) {
    for (const child of rootModule.child_modules) {
      if (child.resources) {
        resources.push(...child.resources);
      }
    }
  }

  return resources;
}

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { DeploymentStatus, ResourceTypeId } from '@terrastudio/types';
import { HclPipeline, validateDiagram, type GeneratedFiles } from '@terrastudio/core';
import { registry } from '$lib/bootstrap';
import { diagram } from '$lib/stores/diagram.svelte';
import { project } from '$lib/stores/project.svelte';
import { terraform, type TerraformCommand } from '$lib/stores/terraform.svelte';
import { convertToResourceInstances } from './diagram-converter';

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
    // Convert diagram to ResourceInstances
    const connectionRules = registry.getConnectionRules();
    const resources = convertToResourceInstances(
      diagram.nodes,
      diagram.edges,
      connectionRules,
    );

    // Validate diagram before generation
    const validation = validateDiagram(resources, registry);
    if (!validation.valid) {
      for (const diagramError of validation.errors) {
        terraform.appendError(
          `[${diagramError.label}] ${diagramError.errors.map((e) => e.message).join(', ')}`,
        );
      }
      terraform.appendError(
        `Validation failed with ${validation.errors.length} resource(s) having errors. Fix issues and try again.`,
      );
      terraform.setStatus('error');
      throw new Error('Diagram validation failed');
    }

    terraform.appendInfo('Validation passed.');

    // Run HCL pipeline
    const pipeline = new HclPipeline(registry);
    const files: GeneratedFiles = pipeline.generate({
      resources,
      projectConfig: project.projectConfig,
    });

    terraform.setStatus('writing');

    // Filter out empty files and send to Rust backend
    const fileMap: Record<string, string> = {};
    for (const [name, content] of Object.entries(files)) {
      if (content.trim()) {
        fileMap[name] = content;
      }
    }

    const outputPath = await invoke<string>('write_terraform_files', {
      projectPath: project.path,
      files: fileMap,
    });

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
 * Run a terraform command, streaming output to the terraform store.
 */
export async function runTerraformCommand(
  command: TerraformCommand,
): Promise<boolean> {
  if (!project.path) throw new Error('No project open');

  terraform.setStatus('running', command);
  terraform.appendInfo(`\n--- terraform ${command} ---\n`);

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
    const schema = registry.getResourceSchema(node.data.typeId as ResourceTypeId);
    if (schema) {
      const address = `${schema.terraformType}.${node.data.terraformName}`;
      addressToNodeId.set(address, node.id);
    }
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

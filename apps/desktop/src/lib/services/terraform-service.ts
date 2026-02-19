import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { HclPipeline, type GeneratedFiles } from '@terrastudio/core';
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

import { Command } from 'commander';
import { storage, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Resolve the terraform/ directory for a project path. */
function tfDir(projectPath: string): string {
  return path.join(projectPath, 'terraform');
}

/**
 * Spawn terraform with the given args in the terraform/ directory.
 * Streams stdout/stderr directly to the terminal.
 * Rejects with the exit code if non-zero.
 */
function runTerraform(cwd: string, args: string[], allowedCodes: number[] = [0]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('terraform', args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    proc.on('close', (code) => {
      if (code !== null && allowedCodes.includes(code)) resolve();
      else reject(new Error(`terraform exited with code ${code}`));
    });
    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('terraform binary not found. Install Terraform: https://developer.hashicorp.com/terraform/install'));
      } else {
        reject(err);
      }
    });
  });
}

/** Check that terraform files exist in the project. Exits with an error if not. */
async function requireTerraformFiles(projectPath: string): Promise<void> {
  const files = await storage.readTerraformFiles(projectPath);
  if (Object.keys(files).length === 0) {
    console.error('No Terraform files found in terraform/ directory.');
    console.error(`Run first: tstudio hcl generate "${projectPath}"`);
    process.exit(1);
  }
}

export function makeTerraformCommand(): Command {
  const cmd = new Command('terraform').alias('tf').description('Run Terraform commands against a project');

  // ─── init ──────────────────────────────────────────────────────────────────

  cmd
    .command('init <path>')
    .description('Run terraform init in the project\'s terraform/ directory')
    .action(async (projectPath: string) => {
      const dir = tfDir(projectPath);
      if (!existsSync(dir)) {
        console.error(`terraform/ directory not found at: ${dir}`);
        console.error('Run `tstudio hcl generate <path>` first.');
        process.exit(1);
      }
      await runTerraform(dir, ['init']).catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
    });

  // ─── validate ──────────────────────────────────────────────────────────────

  cmd
    .command('validate <path>')
    .description('Run terraform validate in the project\'s terraform/ directory')
    .action(async (projectPath: string) => {
      const dir = tfDir(projectPath);
      await runTerraform(dir, ['validate']).catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
    });

  // ─── plan ──────────────────────────────────────────────────────────────────

  cmd
    .command('plan <path>')
    .description('Run terraform plan')
    .option('--out <planFile>', 'Save plan to file (relative to terraform/ dir)')
    .action(async (projectPath: string, options: { out?: string }) => {
      await requireTerraformFiles(projectPath);
      const dir = tfDir(projectPath);
      const args = ['plan'];
      if (options.out) args.push('-out', options.out);
      // Exit code 2 = changes present (not an error)
      await runTerraform(dir, args, [0, 2]).catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
    });

  // ─── apply ─────────────────────────────────────────────────────────────────

  cmd
    .command('apply <path>')
    .description('Run terraform apply (auto-approves)')
    .option('--plan <planFile>', 'Apply a saved plan file instead of planning inline')
    .action(async (projectPath: string, options: { plan?: string }) => {
      await requireTerraformFiles(projectPath);
      const dir = tfDir(projectPath);
      const args = options.plan
        ? ['apply', '-auto-approve', options.plan]
        : ['apply', '-auto-approve'];
      await runTerraform(dir, args).catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
    });

  // ─── destroy ───────────────────────────────────────────────────────────────

  cmd
    .command('destroy <path>')
    .description('Run terraform destroy (auto-approves)')
    .action(async (projectPath: string) => {
      const dir = tfDir(projectPath);
      await runTerraform(dir, ['destroy', '-auto-approve']).catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
    });

  // ─── status ────────────────────────────────────────────────────────────────

  cmd
    .command('status <path>')
    .description('Show deployment status by reading terraform state (terraform show -json)')
    .action(async (projectPath: string) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));
      const dir = tfDir(projectPath);

      // Capture JSON output from terraform show
      const output = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const proc = spawn('terraform', ['show', '-json'], {
          cwd: dir,
          shell: process.platform === 'win32',
        });
        proc.stdout.on('data', (d: Buffer) => chunks.push(d));
        proc.stderr.on('data', (d: Buffer) => process.stderr.write(d));
        proc.on('close', (code) => {
          if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
          else reject(new Error(`terraform show exited with code ${code}`));
        });
        proc.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error('terraform binary not found.'));
          } else {
            reject(err);
          }
        });
      }).catch((err) => {
        console.error(err.message);
        process.exit(1);
      }) as string;

      let state: Record<string, unknown>;
      try {
        state = JSON.parse(output);
      } catch {
        console.log('No state found (project not yet deployed).');
        return;
      }

      const values = (state['values'] as Record<string, unknown> | undefined)?.['root_module'] as Record<string, unknown> | undefined;
      const tfResources = (values?.['resources'] as unknown[]) ?? [];

      if (tfResources.length === 0) {
        console.log('No deployed resources found in state.');
        return;
      }

      // Build a map of terraform address → node label for display
      const addressToLabel = new Map<string, string>();
      for (const node of project.nodes) {
        if (node.data.terraformName && node.type && !node.type.startsWith('_')) {
          const tfType = node.type.split('/').pop() ?? node.type;
          const addr = `${tfType}.${node.data.terraformName}`;
          addressToLabel.set(addr, node.data.label ?? node.data.terraformName ?? addr);
        }
      }

      const colAddr = 'Address'.padEnd(55);
      const colStatus = 'Status';
      console.log(`${colAddr}  ${colStatus}`);
      console.log(`${'-'.repeat(55)}  ${'-'.repeat(10)}`);
      for (const res of tfResources as Array<Record<string, unknown>>) {
        const addr = String(res['address'] ?? '');
        const label = addressToLabel.get(addr);
        const display = label ? `${addr} (${label})` : addr;
        console.log(`${display.padEnd(55)}  deployed`);
      }
    });

  return cmd;
}

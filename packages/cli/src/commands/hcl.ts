import { Command } from 'commander';
import { loadProject, readTerraformFiles, writeTerraformFiles } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import path from 'node:path';

// TODO: Full HCL generation requires loading the plugin registry (PluginRegistry,
// HclPipeline, EdgeRuleValidator from @terrastudio/core plus plugin packages).
// For now these commands read pre-existing terraform/ files written by the desktop app.

export function makeHclCommand(): Command {
  const cmd = new Command('hcl').description('HCL generation and inspection');

  cmd
    .command('generate <path>')
    .description('Show or write generated Terraform files from the terraform/ directory')
    .option('--file <filename>', 'Show only a specific file (e.g. main.tf)')
    .option('--write', 'Write files to the terraform/ directory (no-op if already on disk)')
    .action(
      (
        projectPath: string,
        options: { file?: string; write?: boolean },
      ) => {
        const loaded = loadProject(projectPath);
        // Validate project loads correctly
        Project.fromLoaded(loaded);

        const files = readTerraformFiles(projectPath);

        if (Object.keys(files).length === 0) {
          console.log(
            'No Terraform files found in terraform/ directory.',
          );
          console.log(
            'Open the project in TerraStudio and use "Generate Terraform" to produce HCL files.',
          );
          console.log('');
          console.log(
            '# TODO: Full CLI HCL generation requires loading the plugin registry.',
          );
          return;
        }

        if (options.file) {
          const content = files[options.file];
          if (content === undefined) {
            const available = Object.keys(files).join(', ');
            console.error(`File not found: ${options.file}`);
            console.error(`Available files: ${available}`);
            process.exit(1);
          }
          console.log(`# ${options.file}`);
          console.log(content);
        } else {
          for (const [filename, content] of Object.entries(files)) {
            console.log(`# ${filename}`);
            console.log(content);
            console.log('');
          }
        }

        if (options.write) {
          writeTerraformFiles(projectPath, files);
          const tfDir = path.join(projectPath, 'terraform');
          console.log(`Terraform files written to: ${tfDir}`);
        }
      },
    );

  cmd
    .command('show <path>')
    .description('Read and print existing Terraform files from the terraform/ directory')
    .option('--file <filename>', 'Show only a specific file (e.g. main.tf)')
    .action(
      (
        projectPath: string,
        options: { file?: string },
      ) => {
        const loaded = loadProject(projectPath);
        // Validate project loads correctly
        Project.fromLoaded(loaded);

        const files = readTerraformFiles(projectPath);

        if (Object.keys(files).length === 0) {
          console.log('No Terraform files found in terraform/ directory.');
          console.log(
            'Open the project in TerraStudio and use "Generate Terraform" to produce HCL files.',
          );
          return;
        }

        if (options.file) {
          const content = files[options.file];
          if (content === undefined) {
            const available = Object.keys(files).join(', ');
            console.error(`File not found: ${options.file}`);
            console.error(`Available files: ${available}`);
            process.exit(1);
          }
          console.log(`# ${options.file}`);
          console.log(content);
        } else {
          for (const [filename, content] of Object.entries(files)) {
            console.log(`# ${filename}`);
            console.log(content);
            console.log('');
          }
        }
      },
    );

  return cmd;
}

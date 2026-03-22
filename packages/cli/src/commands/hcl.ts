import { Command } from 'commander';
import { storage, loadRegistry, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import { HclPipeline, EdgeRuleValidator, validateDiagram, validateNetworkTopology } from '@terrastudio/core';
import { convertToResourceInstances, extractOutputBindings } from '@terrastudio/project';
import type { ProviderId } from '@terrastudio/types';
import path from 'node:path';
import { resolveProjectPath } from '../platform/resolve-project.js';

export function makeHclCommand(): Command {
  const cmd = new Command('hcl').description('HCL generation and inspection');

  cmd
    .command('generate [path]')
    .description('Generate Terraform HCL from the diagram and write to terraform/')
    .option('--dry-run', 'Print files to stdout instead of writing to disk')
    .option('--file <filename>', 'With --dry-run: show only a specific file (e.g. main.tf)')
    .option('--no-validate', 'Skip diagram and network topology validation')
    .action(
      async (
        projectPath: string | undefined,
        options: { dryRun?: boolean; file?: string; validate: boolean },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const providers = (project.projectConfig.activeProviders ?? ['azurerm']) as ProviderId[];
        process.stderr.write(`Loading plugins for: [${providers.join(', ')}]...\n`);
        const registry = await loadRegistry(providers);

        const connectionRules = registry.getConnectionRules();
        const getSchema = (typeId: import('@terrastudio/types').ResourceTypeId) =>
          registry.getResourceSchema(typeId);

        // Convert diagram nodes + edges to ResourceInstances
        const resources = convertToResourceInstances(
          project.nodes,
          project.edges,
          connectionRules,
          getSchema,
          project.projectConfig,
        );

        // Diagram validation
        if (options.validate !== false) {
          const validation = validateDiagram(resources, registry);
          if (!validation.valid) {
            for (const diagramError of validation.errors) {
              console.error(`  ✗ [${diagramError.label}] ${diagramError.errors.map((e) => e.message).join(', ')}`);
            }
            console.error(`\nDiagram validation failed (${validation.errors.length} resource(s) with errors).`);
            process.exit(1);
          }

          // Network topology validation (CIDR containment + overlap)
          const topologyNodes = project.nodes.filter((n): n is typeof n & { type: string } => n.type !== undefined);
          const topologyErrors = validateNetworkTopology(topologyNodes);
          const hardErrors = topologyErrors.filter((te) => te.errors.some((e) => e.severity === 'error'));
          const warnings = topologyErrors.filter((te) => te.errors.some((e) => e.severity === 'warning'));

          for (const te of warnings) {
            const node = project.nodes.find((n) => n.id === te.instanceId);
            const label = node?.data?.label ?? te.instanceId;
            for (const e of te.errors.filter((x) => x.severity === 'warning')) {
              console.warn(`  ⚠ [${label}] ${e.message}`);
            }
          }

          if (hardErrors.length > 0) {
            for (const te of hardErrors) {
              const node = project.nodes.find((n) => n.id === te.instanceId);
              const label = node?.data?.label ?? te.instanceId;
              for (const e of te.errors.filter((x) => x.severity === 'error')) {
                console.error(`  ✗ [${label}] ${e.message}`);
              }
            }
            console.error('\nNetwork topology validation failed. Fix CIDR issues and try again.');
            process.exit(1);
          }
        }

        // Extract output bindings from edges
        const edgeValidator = new EdgeRuleValidator(connectionRules);
        const bindings = extractOutputBindings(project.edges, project.nodes, edgeValidator);

        // Run HCL pipeline
        const pipeline = new HclPipeline(registry);
        const result = pipeline.generate({
          resources,
          projectConfig: project.projectConfig,
          bindings,
          modules: project.modules,
          moduleInstances: project.moduleInstances,
        });

        // Pipeline-level validation errors
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  ✗ ${err.message}`);
          }
          console.error('\nHCL generation blocked by validation errors.');
          process.exit(1);
        }

        // Filter empty files
        const fileMap: Record<string, string> = {};
        for (const [name, content] of Object.entries(result.files)) {
          if (content && content.trim()) {
            fileMap[name] = content;
          }
        }

        if (options.dryRun) {
          // Print to stdout
          if (options.file) {
            const content = fileMap[options.file];
            if (content === undefined) {
              console.error(`File not found: ${options.file}`);
              console.error(`Generated files: ${Object.keys(fileMap).join(', ')}`);
              process.exit(1);
            }
            console.log(`# ${options.file}`);
            console.log(content);
          } else {
            for (const [filename, content] of Object.entries(fileMap)) {
              console.log(`# ${filename}`);
              console.log(content);
              console.log('');
            }
          }
        } else {
          await storage.writeTerraformFiles(resolved, fileMap);
          const tfDir = path.join(resolved, 'terraform');
          console.log(`Generated ${Object.keys(fileMap).length} file(s) to: ${tfDir}`);
          for (const filename of Object.keys(fileMap).sort()) {
            console.log(`  ${filename}`);
          }
          if (result.collectedVariables.length > 0) {
            console.log(`\nVariables declared: ${result.collectedVariables.length}`);
            for (const v of result.collectedVariables) {
              const note = v.sensitive ? ' (sensitive)' : '';
              console.log(`  var.${v.name}${note}`);
            }
          }
        }
      },
    );

  cmd
    .command('show [path]')
    .description('Print existing Terraform files from the terraform/ directory')
    .option('--file <filename>', 'Show only a specific file (e.g. main.tf)')
    .action(
      async (
        projectPath: string | undefined,
        options: { file?: string },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        Project.fromLoaded(toLoadedProject(stored)); // validate project loads

        const files = await storage.readTerraformFiles(resolved);

        if (Object.keys(files).length === 0) {
          console.log('No Terraform files found in terraform/ directory.');
          console.log('Run: tstudio hcl generate <path>');
          return;
        }

        if (options.file) {
          const content = files[options.file];
          if (content === undefined) {
            console.error(`File not found: ${options.file}`);
            console.error(`Available: ${Object.keys(files).join(', ')}`);
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

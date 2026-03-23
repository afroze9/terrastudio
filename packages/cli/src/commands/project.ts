import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import { storage, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import type { ProviderId } from '@terrastudio/types';
import { resolveProjectPath } from '../platform/resolve-project.js';

/** Keys that should have their values redacted in output. */
function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('token') ||
    lower.includes('key')
  );
}

/** Recursively redact sensitive values in an object. */
function redactSensitive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = isSensitiveKey(k) && typeof v === 'string' ? '***' : redactSensitive(v);
  }
  return result;
}

export function makeProjectCommand(): Command {
  const cmd = new Command('project').description('Project information and configuration');

  cmd
    .command('create [name]')
    .description('Create a new TerraStudio project directory')
    .option('--path <parentPath>', 'Parent directory (default: current directory)')
    .option('--providers <providers...>', 'Active providers (default: azurerm)')
    .option('--location <location>', 'Default Azure location (default: eastus)')
    .option('--rg <resourceGroupName>', 'Default resource group name')
    .action(
      async (
        nameArg: string | undefined,
        options: {
          path?: string;
          providers?: string[];
          location?: string;
          rg?: string;
        },
      ) => {
        // If all required info is provided via args/flags, skip the wizard
        const interactive = !nameArg;

        let name = nameArg;
        let parentPath = options.path ?? '.';
        let providers = options.providers;
        let location = options.location;
        let rg = options.rg;

        if (interactive) {
          p.intro('Create a new TerraStudio project');

          const answers = await p.group(
            {
              name: () =>
                p.text({
                  message: 'Project name',
                  placeholder: 'my-infra',
                  validate: (val = '') => {
                    if (!val.trim()) return 'Project name is required';
                    if (/[<>:"/\\|?*]/.test(val))
                      return 'Project name contains invalid characters';
                  },
                }),
              parentPath: () =>
                p.text({
                  message: 'Project location',
                  placeholder: '.',
                  initialValue: '.',
                }),
              providers: () =>
                p.multiselect({
                  message: 'Select providers',
                  options: [
                    { value: 'azurerm', label: 'Azure (azurerm)', hint: 'Azure Resource Manager' },
                    { value: 'aws', label: 'AWS', hint: 'Amazon Web Services' },
                  ],
                  initialValues: ['azurerm'],
                  required: true,
                }),
              location: ({ results }) => {
                if (!results.providers?.includes('azurerm')) return;
                return p.select({
                  message: 'Default Azure location',
                  options: [
                    { value: 'eastus', label: 'East US' },
                    { value: 'eastus2', label: 'East US 2' },
                    { value: 'westus', label: 'West US' },
                    { value: 'westus2', label: 'West US 2' },
                    { value: 'westus3', label: 'West US 3' },
                    { value: 'centralus', label: 'Central US' },
                    { value: 'northeurope', label: 'North Europe' },
                    { value: 'westeurope', label: 'West Europe' },
                    { value: 'uksouth', label: 'UK South' },
                    { value: 'ukwest', label: 'UK West' },
                    { value: 'southeastasia', label: 'Southeast Asia' },
                    { value: 'australiaeast', label: 'Australia East' },
                    { value: 'canadacentral', label: 'Canada Central' },
                  ],
                  initialValue: 'eastus',
                });
              },
              rg: ({ results }) => {
                const defaultRg = `rg-${results.name}`;
                return p.text({
                  message: 'Resource group name',
                  placeholder: defaultRg,
                  initialValue: defaultRg,
                });
              },
            },
            {
              onCancel: () => {
                p.cancel('Project creation cancelled.');
                process.exit(0);
              },
            },
          );

          name = answers.name;
          parentPath = answers.parentPath || '.';
          providers = answers.providers;
          location = answers.location as string | undefined;
          rg = answers.rg as string | undefined;
        }

        const stored = await storage.createProject(name!, parentPath);

        // Apply any option overrides to the saved config
        if (providers || location || rg) {
          const config = stored.metadata.projectConfig as Record<string, unknown>;
          if (providers) config['activeProviders'] = providers;
          if (location) config['location'] = location;
          if (rg) config['resourceGroupName'] = rg;
          await storage.saveProjectConfig(stored.path, config);
        }

        const resolvedPath = path.resolve(stored.path);
        const providerList = (providers ?? ['azurerm']).join(', ');

        if (interactive) {
          p.note(
            [
              `cd ${resolvedPath}`,
              `tstudio generate .`,
            ].join('\n'),
            'Next steps',
          );
          p.outro(`Project "${name}" created successfully!`);
        } else {
          console.log(`Created project "${name}" at: ${resolvedPath}`);
          console.log(`Providers: ${providerList}`);
        }
      },
    );

  cmd
    .command('info [path]')
    .description('Show project metadata')
    .action(async (projectPath: string | undefined) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));
      console.log(`Name:     ${project.name}`);
      console.log(`Version:  ${project.version}`);
      console.log(`Path:     ${project.path}`);
      const providers = project.projectConfig.activeProviders?.join(', ') ?? 'azurerm';
      console.log(`Providers: ${providers}`);
      console.log(`Nodes:    ${project.nodes.length}`);
      console.log(`Edges:    ${project.edges.length}`);
    });

  cmd
    .command('config [path]')
    .description('Print project config as JSON (sensitive values redacted)')
    .action(async (projectPath: string | undefined) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));
      const redacted = redactSensitive(project.projectConfig);
      console.log(JSON.stringify(redacted, null, 2));
    });

  cmd
    .command('config-set [path]')
    .description('Update project config fields')
    .option(
      '--naming-convention <value>',
      'Naming convention as a JSON string (e.g. \'{"enabled":true,"template":"{type}-{env}-{name}","env":"dev"}\')',
    )
    .option('--layout-algorithm <value>', 'Layout algorithm (dagre or hybrid)')
    .option('--providers <providers...>', 'Active providers (space-separated)')
    .option(
      '--variable <key=value>',
      'Set a variable value (e.g. --variable location=eastus). Repeat for multiple variables.',
      (val: string, acc: string[]) => [...acc, val],
      [] as string[],
    )
    .action(
      async (
        projectPath: string | undefined,
        options: {
          namingConvention?: string;
          layoutAlgorithm?: string;
          providers?: string[];
          variable: string[];
        },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        if (options.namingConvention !== undefined) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(options.namingConvention);
          } catch {
            console.error('--naming-convention must be a valid JSON string');
            process.exit(1);
          }
          project.projectConfig = {
            ...project.projectConfig,
            namingConvention: parsed as typeof project.projectConfig.namingConvention,
          };
        }

        if (options.layoutAlgorithm !== undefined) {
          const algo = options.layoutAlgorithm as 'dagre' | 'hybrid';
          project.projectConfig = {
            ...project.projectConfig,
            layoutAlgorithm: algo,
          };
        }

        if (options.providers !== undefined) {
          project.projectConfig = {
            ...project.projectConfig,
            activeProviders: options.providers as ProviderId[],
          };
        }

        if (options.variable.length > 0) {
          const variableValues: Record<string, unknown> = {
            ...(project.projectConfig.variableValues ?? {}),
          };
          for (const entry of options.variable) {
            const eq = entry.indexOf('=');
            if (eq === -1) {
              console.error(`Invalid --variable format (expected key=value): ${entry}`);
              process.exit(1);
            }
            const key = entry.slice(0, eq);
            const value = entry.slice(eq + 1);
            variableValues[key] = value;
          }
          project.projectConfig = {
            ...project.projectConfig,
            variableValues,
          };
        }

        await storage.saveProjectConfig(resolved, project.projectConfig);
        console.log('Project config updated.');
      },
    );

  return cmd;
}

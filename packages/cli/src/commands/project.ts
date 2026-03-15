import { Command } from 'commander';
import { storage, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import type { ProviderId } from '@terrastudio/types';

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
  const cmd = new Command('project').description('Project information and validation');

  cmd
    .command('info <path>')
    .description('Show project metadata')
    .action(async (projectPath: string) => {
      const stored = await storage.loadProject(projectPath);
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
    .command('config <path>')
    .description('Print project config as JSON (sensitive values redacted)')
    .action(async (projectPath: string) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));
      const redacted = redactSensitive(project.projectConfig);
      console.log(JSON.stringify(redacted, null, 2));
    });

  cmd
    .command('config-set <path>')
    .description('Update project config fields')
    .option(
      '--naming-convention <value>',
      'Naming convention as a JSON string (e.g. \'{"enabled":true,"template":"{type}-{env}-{name}","env":"dev"}\')',
    )
    .option('--layout-algorithm <value>', 'Layout algorithm (dagre or hybrid)')
    .option('--providers <providers...>', 'Active providers (space-separated)')
    .action(
      async (
        projectPath: string,
        options: {
          namingConvention?: string;
          layoutAlgorithm?: string;
          providers?: string[];
        },
      ) => {
        const stored = await storage.loadProject(projectPath);
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

        await storage.saveProjectConfig(projectPath, project.projectConfig);
        console.log('Project config updated.');
      },
    );

  return cmd;
}

import { Command } from 'commander';
import { storage, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import type { ModuleDefinition, ModuleInstance } from '@terrastudio/types';
import { resolveProjectPath } from '../platform/resolve-project.js';

function generateModuleId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `mod-${ts}-${rand}`;
}

function generateInstanceId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `modinst-${ts}-${rand}`;
}

export function makeModuleCommand(): Command {
  const cmd = new Command('module').description('Manage diagram modules');

  // ─── module list ─────────────────────────────────────────────────────────────

  cmd
    .command('list [path]')
    .description('List all modules in the project')
    .action(async (projectPath: string | undefined) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));

      if (project.modules.length === 0) {
        console.log('No modules found.');
        return;
      }

      const colId = 'ID'.padEnd(32);
      const colName = 'Name'.padEnd(30);
      const colTemplate = 'IsTemplate'.padEnd(12);
      const colMembers = 'MemberCount';
      console.log(`${colId}  ${colName}  ${colTemplate}  ${colMembers}`);
      console.log(
        `${'-'.repeat(32)}  ${'-'.repeat(30)}  ${'-'.repeat(12)}  ${'-'.repeat(11)}`,
      );

      for (const mod of project.modules) {
        const memberCount = project.nodes.filter(
          (n) => n.data.moduleId === mod.id,
        ).length;
        const id = mod.id.padEnd(32);
        const name = mod.name.padEnd(30);
        const isTemplate = String(mod.isTemplate ?? false).padEnd(12);
        console.log(`${id}  ${name}  ${isTemplate}  ${memberCount}`);
      }
    });

  // ─── module create ────────────────────────────────────────────────────────────

  cmd
    .command('create [path] <name>')
    .description('Create a new module grouping resources')
    .requiredOption('--members <nodeIds...>', 'Node IDs to include in the module')
    .option('--template', 'Make this module a reusable template')
    .action(
      async (
        projectPath: string | undefined,
        name: string,
        options: { members: string[]; template?: boolean },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        // Validate all member nodes exist
        for (const nodeId of options.members) {
          if (!project.getNode(nodeId)) {
            console.error(`Node not found: ${nodeId}`);
            process.exit(1);
          }
        }

        const moduleId = generateModuleId();
        const mod: ModuleDefinition = {
          id: moduleId,
          name,
          collapsed: false,
          position: { x: 0, y: 0 },
          ...(options.template ? { isTemplate: true } : {}),
        };

        project.modules = [...project.modules, mod];

        // Set moduleId on each member node
        for (const nodeId of options.members) {
          const node = project.getNode(nodeId)!;
          project.updateNode(nodeId, {
            data: { ...node.data, moduleId },
          });
        }

        await storage.saveDiagram(resolved, project.toDiagramSnapshot());
        console.log(
          `Created module "${name}" (${moduleId}) with ${options.members.length} member(s).`,
        );
      },
    );

  // ─── module delete ────────────────────────────────────────────────────────────

  cmd
    .command('delete [path] <moduleId>')
    .description('Delete a module (does not delete member resources)')
    .action(async (projectPath: string | undefined, moduleId: string) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const mod = project.modules.find((m) => m.id === moduleId);
      if (!mod) {
        console.error(`Module not found: ${moduleId}`);
        process.exit(1);
      }

      // Clear moduleId from member nodes
      const members = project.nodes.filter((n) => n.data.moduleId === moduleId);
      for (const node of members) {
        project.updateNode(node.id, {
          data: { ...node.data, moduleId: undefined },
        });
      }

      project.modules = project.modules.filter((m) => m.id !== moduleId);
      await storage.saveDiagram(resolved, project.toDiagramSnapshot());
      console.log(`Deleted module: ${mod.name} (${moduleId})`);
    });

  // ─── module rename ────────────────────────────────────────────────────────────

  cmd
    .command('rename [path] <moduleId> <newName>')
    .description('Rename a module')
    .action(async (projectPath: string | undefined, moduleId: string, newName: string) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const mod = project.modules.find((m) => m.id === moduleId);
      if (!mod) {
        console.error(`Module not found: ${moduleId}`);
        process.exit(1);
      }

      project.modules = project.modules.map((m) =>
        m.id === moduleId ? { ...m, name: newName } : m,
      );

      await storage.saveDiagram(resolved, project.toDiagramSnapshot());
      console.log(`Renamed module ${moduleId}: "${mod.name}" -> "${newName}"`);
    });

  // ─── module add-members ───────────────────────────────────────────────────────

  cmd
    .command('add-members [path] <moduleId>')
    .description('Add nodes to a module')
    .requiredOption('--members <nodeIds...>', 'Node IDs to add')
    .action(
      async (
        projectPath: string | undefined,
        moduleId: string,
        options: { members: string[] },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const mod = project.modules.find((m) => m.id === moduleId);
        if (!mod) {
          console.error(`Module not found: ${moduleId}`);
          process.exit(1);
        }

        for (const nodeId of options.members) {
          const node = project.getNode(nodeId);
          if (!node) {
            console.error(`Node not found: ${nodeId}`);
            process.exit(1);
          }
          project.updateNode(nodeId, {
            data: { ...node.data, moduleId },
          });
        }

        await storage.saveDiagram(resolved, project.toDiagramSnapshot());
        console.log(
          `Added ${options.members.length} member(s) to module ${moduleId}.`,
        );
      },
    );

  // ─── module remove-members ────────────────────────────────────────────────────

  cmd
    .command('remove-members [path] <moduleId>')
    .description('Remove nodes from a module')
    .requiredOption('--members <nodeIds...>', 'Node IDs to remove')
    .action(
      async (
        projectPath: string | undefined,
        moduleId: string,
        options: { members: string[] },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        if (!project.modules.find((m) => m.id === moduleId)) {
          console.error(`Module not found: ${moduleId}`);
          process.exit(1);
        }

        for (const nodeId of options.members) {
          const node = project.getNode(nodeId);
          if (!node) {
            console.error(`Node not found: ${nodeId}`);
            process.exit(1);
          }
          project.updateNode(nodeId, {
            data: { ...node.data, moduleId: undefined },
          });
        }

        await storage.saveDiagram(resolved, project.toDiagramSnapshot());
        console.log(
          `Removed ${options.members.length} member(s) from module ${moduleId}.`,
        );
      },
    );

  // ─── module instances ─────────────────────────────────────────────────────────

  const instancesCmd = new Command('instances').description(
    'Manage module template instances',
  );

  instancesCmd
    .command('list [path]')
    .description('List module instances')
    .option('--template <templateId>', 'Filter by template module ID')
    .action(async (projectPath: string | undefined, options: { template?: string }) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));

      let instances = project.moduleInstances;
      if (options.template) {
        instances = instances.filter((i) => i.templateId === options.template);
      }

      if (instances.length === 0) {
        console.log('No module instances found.');
        return;
      }

      const colId = 'ID'.padEnd(32);
      const colTemplate = 'TemplateID'.padEnd(32);
      const colName = 'Name';
      console.log(`${colId}  ${colTemplate}  ${colName}`);
      console.log(`${'-'.repeat(32)}  ${'-'.repeat(32)}  ${'-'.repeat(30)}`);

      for (const inst of instances) {
        const id = inst.id.padEnd(32);
        const templateId = inst.templateId.padEnd(32);
        console.log(`${id}  ${templateId}  ${inst.name}`);
      }
    });

  instancesCmd
    .command('create [path] <templateModuleId> <instanceName>')
    .description('Create a new module instance from a template')
    .action(
      async (projectPath: string | undefined, templateModuleId: string, instanceName: string) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const template = project.modules.find((m) => m.id === templateModuleId);
        if (!template) {
          console.error(`Template module not found: ${templateModuleId}`);
          process.exit(1);
        }
        if (!template.isTemplate) {
          console.error(
            `Module ${templateModuleId} is not a template. Set isTemplate via the desktop app.`,
          );
          process.exit(1);
        }

        const instanceId = generateInstanceId();
        const instance: ModuleInstance = {
          id: instanceId,
          templateId: templateModuleId,
          name: instanceName,
          position: { x: 0, y: 0 },
          variableValues: {},
        };

        project.moduleInstances = [...project.moduleInstances, instance];
        await storage.saveDiagram(resolved, project.toDiagramSnapshot());
        console.log(
          `Created instance "${instanceName}" (${instanceId}) from template ${templateModuleId}.`,
        );
      },
    );

  instancesCmd
    .command('delete [path] <instanceId>')
    .description('Delete a module instance')
    .action(async (projectPath: string | undefined, instanceId: string) => {
      const resolved = resolveProjectPath(projectPath);
      const stored = await storage.loadProject(resolved);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const instance = project.moduleInstances.find((i) => i.id === instanceId);
      if (!instance) {
        console.error(`Instance not found: ${instanceId}`);
        process.exit(1);
      }

      project.moduleInstances = project.moduleInstances.filter(
        (i) => i.id !== instanceId,
      );
      await storage.saveDiagram(resolved, project.toDiagramSnapshot());
      console.log(`Deleted instance: ${instance.name} (${instanceId})`);
    });

  instancesCmd
    .command('set-var [path] <instanceId>')
    .description('Set a variable value on a module instance')
    .requiredOption('--key <key>', 'Variable key')
    .requiredOption('--value <value>', 'Variable value')
    .action(
      async (
        projectPath: string | undefined,
        instanceId: string,
        options: { key: string; value: string },
      ) => {
        const resolved = resolveProjectPath(projectPath);
        const stored = await storage.loadProject(resolved);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const instance = project.moduleInstances.find((i) => i.id === instanceId);
        if (!instance) {
          console.error(`Instance not found: ${instanceId}`);
          process.exit(1);
        }

        project.moduleInstances = project.moduleInstances.map((i) => {
          if (i.id !== instanceId) return i;
          return {
            ...i,
            variableValues: {
              ...i.variableValues,
              [options.key]: options.value,
            },
          };
        });

        await storage.saveDiagram(resolved, project.toDiagramSnapshot());
        console.log(
          `Set ${options.key} = ${options.value} on instance ${instanceId}.`,
        );
      },
    );

  cmd.addCommand(instancesCmd);

  return cmd;
}

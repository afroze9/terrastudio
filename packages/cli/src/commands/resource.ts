import { Command } from 'commander';
import { storage, loadValidator, toLoadedProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';
import type { ProjectNode, ProjectEdge, ResourceTypeId } from '@terrastudio/types';

function printWarnings(warnings: string[]): void {
  for (const w of warnings) {
    console.warn(`  ⚠ ${w}`);
  }
}

/** Generate a node ID in the same format the desktop app uses. */
function generateNodeId(typeId: string): string {
  const part = typeId.replace(/\//g, '-');
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${part}-${ts}-${rand}`;
}

export function makeResourceCommand(): Command {
  const cmd = new Command('resource').description('Manage diagram resources');

  cmd
    .command('list <path>')
    .description('List all resources in the project diagram')
    .option('-t, --type <typeId>', 'Filter by resource type ID')
    .action(async (projectPath: string, options: { type?: string }) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      let nodes = project.nodes.filter(
        (n) => n.type && !n.type.startsWith('_') && n.data.typeId,
      );
      if (options.type) {
        nodes = nodes.filter((n) => n.data.typeId === options.type);
      }

      if (nodes.length === 0) {
        console.log('No resources found.');
        return;
      }

      const colId = 'ID'.padEnd(36);
      const colType = 'Type'.padEnd(40);
      const colName = 'Terraform Name';
      console.log(`${colId}  ${colType}  ${colName}`);
      console.log(`${'-'.repeat(36)}  ${'-'.repeat(40)}  ${'-'.repeat(30)}`);
      for (const node of nodes) {
        const id = node.id.padEnd(36);
        const type = (node.data.typeId ?? node.type ?? '').padEnd(40);
        const name = node.data.terraformName ?? node.data.label ?? '(unnamed)';
        console.log(`${id}  ${type}  ${name}`);
      }
    });

  cmd
    .command('add <path> <typeId> <terraformName>')
    .description('Add a new resource to the diagram')
    .option('-p, --parent <parentId>', 'Parent node ID (for contained resources)')
    .action(async (projectPath: string, typeId: string, terraformName: string, options: { parent?: string }) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      if (options.parent && !project.getNode(options.parent)) {
        console.error(`Parent node not found: ${options.parent}`);
        process.exit(1);
      }

      const providers = (project.projectConfig.activeProviders ?? ['azurerm']) as import('@terrastudio/types').ProviderId[];
      project.validator = await loadValidator(providers);

      const resolvedTypeId = typeId as ResourceTypeId;
      const id = generateNodeId(typeId);
      const node: ProjectNode = {
        id,
        type: typeId,
        position: { x: 100, y: 100 },
        data: {
          typeId: resolvedTypeId,
          label: terraformName,
          terraformName,
          properties: {},
          references: {},
          validationErrors: [],
          enabledOutputs: [],
        },
        ...(options.parent ? { parentId: options.parent } : {}),
      };

      const { warnings } = project.addNode(node);
      await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Added ${typeId} "${terraformName}" (${id})`);
      printWarnings(warnings);
    });

  cmd
    .command('update <path> <nodeId>')
    .description('Update a resource property')
    .requiredOption('-k, --key <key>', 'Property key to update')
    .requiredOption('-v, --value <value>', 'New property value')
    .action(async (projectPath: string, nodeId: string, options: { key: string; value: string }) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const node = project.getNode(nodeId);
      if (!node) {
        console.error(`Node not found: ${nodeId}`);
        process.exit(1);
      }

      project.updateNode(nodeId, {
        data: {
          ...node.data,
          properties: {
            ...node.data.properties,
            [options.key]: options.value,
          },
        },
      });

      await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Updated node ${nodeId}: ${options.key} = ${options.value}`);
    });

  cmd
    .command('remove <path> <nodeId>')
    .description('Remove a resource from the diagram')
    .action(async (projectPath: string, nodeId: string) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const node = project.getNode(nodeId);
      if (!node) {
        console.error(`Node not found: ${nodeId}`);
        process.exit(1);
      }

      const children = project.getChildren(nodeId);
      if (children.length > 0) {
        console.error(`Cannot remove: node has ${children.length} child resource(s). Remove them first.`);
        process.exit(1);
      }

      const name = node.data.terraformName ?? node.data.label ?? nodeId;
      project.removeNode(nodeId);
      await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Removed resource: ${name} (${nodeId})`);
    });

  cmd
    .command('connect <path> <sourceId> <targetId>')
    .description('Add an edge between two nodes')
    .option('--source-handle <handle>', 'Source handle ID')
    .option('--target-handle <handle>', 'Target handle ID')
    .option('--label <label>', 'Edge label')
    .action(
      async (
        projectPath: string,
        sourceId: string,
        targetId: string,
        options: { sourceHandle?: string; targetHandle?: string; label?: string },
      ) => {
        const stored = await storage.loadProject(projectPath);
        const project = Project.fromLoaded(toLoadedProject(stored));

        if (!project.getNode(sourceId)) {
          console.error(`Source node not found: ${sourceId}`);
          process.exit(1);
        }
        if (!project.getNode(targetId)) {
          console.error(`Target node not found: ${targetId}`);
          process.exit(1);
        }

        const providers = (project.projectConfig.activeProviders ?? ['azurerm']) as import('@terrastudio/types').ProviderId[];
        project.validator = await loadValidator(providers);

        const sourceHandle = options.sourceHandle ?? 'default';
        const targetHandle = options.targetHandle ?? 'default';
        const edgeId = `e-${sourceId}-${sourceHandle}-${targetId}-${targetHandle}`;

        const edge: ProjectEdge = {
          id: edgeId,
          source: sourceId,
          target: targetId,
          ...(options.sourceHandle ? { sourceHandle: options.sourceHandle } : {}),
          ...(options.targetHandle ? { targetHandle: options.targetHandle } : {}),
          data: {
            category: 'structural',
            ...(options.label ? { label: options.label } : {}),
          },
        };

        const { warnings } = project.addEdge(edge);
        await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
        console.log(`Connected ${sourceId} -> ${targetId} (${edgeId})`);
        printWarnings(warnings);
      },
    );

  cmd
    .command('disconnect <path> <edgeId>')
    .description('Remove an edge by ID')
    .action(async (projectPath: string, edgeId: string) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      const edge = project.edges.find((e) => e.id === edgeId);
      if (!edge) {
        console.error(`Edge not found: ${edgeId}`);
        process.exit(1);
      }

      project.removeEdge(edgeId);
      await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Removed edge: ${edgeId}`);
    });

  cmd
    .command('move <path> <nodeId>')
    .description('Move a node to a new position')
    .option('--x <x>', 'X coordinate')
    .option('--y <y>', 'Y coordinate')
    .option('--parent <parentId>', 'New parent node ID (use empty string to unparent)')
    .action(
      async (
        projectPath: string,
        nodeId: string,
        options: { x?: string; y?: string; parent?: string },
      ) => {
        const stored = await storage.loadProject(projectPath);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const node = project.getNode(nodeId);
        if (!node) {
          console.error(`Node not found: ${nodeId}`);
          process.exit(1);
        }

        const x = options.x !== undefined ? Number(options.x) : node.position.x;
        const y = options.y !== undefined ? Number(options.y) : node.position.y;

        // parent option: undefined = don't change, '' = unparent, otherwise set to value
        let parentArg: string | null | undefined = undefined;
        if (options.parent !== undefined) {
          parentArg = options.parent === '' ? null : options.parent;
        }

        if (parentArg !== undefined && parentArg !== null && !project.getNode(parentArg)) {
          console.error(`Parent node not found: ${parentArg}`);
          process.exit(1);
        }

        const providers = (project.projectConfig.activeProviders ?? ['azurerm']) as import('@terrastudio/types').ProviderId[];
        project.validator = await loadValidator(providers);

        const { warnings } = project.moveNode(nodeId, { x, y }, parentArg);
        await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
        console.log(`Moved node ${nodeId} to (${x}, ${y})`);
        printWarnings(warnings);
      },
    );

  cmd
    .command('resize <path> <nodeId>')
    .description('Resize a node')
    .requiredOption('--width <width>', 'New width')
    .requiredOption('--height <height>', 'New height')
    .action(
      async (
        projectPath: string,
        nodeId: string,
        options: { width: string; height: string },
      ) => {
        const stored = await storage.loadProject(projectPath);
        const project = Project.fromLoaded(toLoadedProject(stored));

        if (!project.getNode(nodeId)) {
          console.error(`Node not found: ${nodeId}`);
          process.exit(1);
        }

        const width = Number(options.width);
        const height = Number(options.height);

        project.resizeNode(nodeId, width, height);
        await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
        console.log(`Resized node ${nodeId} to ${width}x${height}`);
      },
    );

  cmd
    .command('outputs <path> <nodeId>')
    .description('Enable specific output keys on a node')
    .option('--enable <keys...>', 'Output keys to enable (space-separated)')
    .action(
      async (
        projectPath: string,
        nodeId: string,
        options: { enable?: string[] },
      ) => {
        const stored = await storage.loadProject(projectPath);
        const project = Project.fromLoaded(toLoadedProject(stored));

        const node = project.getNode(nodeId);
        if (!node) {
          console.error(`Node not found: ${nodeId}`);
          process.exit(1);
        }

        const enabledOutputs = options.enable ?? [];
        project.updateNode(nodeId, {
          data: {
            ...node.data,
            enabledOutputs,
          },
        });

        await storage.saveDiagram(projectPath, project.toDiagramSnapshot());
        console.log(
          `Set enabled outputs for ${nodeId}: [${enabledOutputs.join(', ')}]`,
        );
      },
    );

  cmd
    .command('edges <path>')
    .description('List edges in the diagram')
    .option('--node <nodeId>', 'Filter edges connected to a specific node')
    .action(async (projectPath: string, options: { node?: string }) => {
      const stored = await storage.loadProject(projectPath);
      const project = Project.fromLoaded(toLoadedProject(stored));

      let edges = project.edges;
      if (options.node) {
        edges = edges.filter(
          (e) => e.source === options.node || e.target === options.node,
        );
      }

      if (edges.length === 0) {
        console.log('No edges found.');
        return;
      }

      const colId = 'ID'.padEnd(50);
      const colSource = 'Source'.padEnd(36);
      const colTarget = 'Target'.padEnd(36);
      const colCat = 'Category'.padEnd(12);
      const colLabel = 'Label';
      console.log(`${colId}  ${colSource}  ${colTarget}  ${colCat}  ${colLabel}`);
      console.log(
        `${'-'.repeat(50)}  ${'-'.repeat(36)}  ${'-'.repeat(36)}  ${'-'.repeat(12)}  ${'-'.repeat(20)}`,
      );
      for (const edge of edges) {
        const id = edge.id.padEnd(50);
        const source = edge.source.padEnd(36);
        const target = edge.target.padEnd(36);
        const category = (edge.data?.category ?? '').padEnd(12);
        const label = edge.data?.label ?? '';
        console.log(`${id}  ${source}  ${target}  ${category}  ${label}`);
      }
    });

  return cmd;
}

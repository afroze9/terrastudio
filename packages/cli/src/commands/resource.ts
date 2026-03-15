import { Command } from 'commander';
import { loadProject, saveDiagram } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';

export function makeResourceCommand(): Command {
  const cmd = new Command('resource').description('Manage diagram resources');

  cmd
    .command('list <path>')
    .description('List all resources in the project diagram')
    .option('-t, --type <typeId>', 'Filter by resource type ID')
    .action((projectPath: string, options: { type?: string }) => {
      const loaded = loadProject(projectPath);
      const project = Project.fromLoaded(loaded);

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
    .command('update <path> <nodeId>')
    .description('Update a resource property')
    .requiredOption('-k, --key <key>', 'Property key to update')
    .requiredOption('-v, --value <value>', 'New property value')
    .action((projectPath: string, nodeId: string, options: { key: string; value: string }) => {
      const loaded = loadProject(projectPath);
      const project = Project.fromLoaded(loaded);

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

      saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Updated node ${nodeId}: ${options.key} = ${options.value}`);
    });

  cmd
    .command('remove <path> <nodeId>')
    .description('Remove a resource from the diagram')
    .action((projectPath: string, nodeId: string) => {
      const loaded = loadProject(projectPath);
      const project = Project.fromLoaded(loaded);

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
      saveDiagram(projectPath, project.toDiagramSnapshot());
      console.log(`Removed resource: ${name} (${nodeId})`);
    });

  return cmd;
}

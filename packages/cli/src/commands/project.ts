import { Command } from 'commander';
import { loadProject } from '../platform/node-io.js';
import { Project } from '@terrastudio/project';

export function makeProjectCommand(): Command {
  const cmd = new Command('project').description('Project information and validation');

  cmd
    .command('info <path>')
    .description('Show project metadata')
    .action((projectPath: string) => {
      const loaded = loadProject(projectPath);
      const project = Project.fromLoaded(loaded);
      console.log(`Name:     ${project.name}`);
      console.log(`Version:  ${project.version}`);
      console.log(`Path:     ${project.path}`);
      const providers = project.projectConfig.activeProviders?.join(', ') ?? 'azurerm';
      console.log(`Providers: ${providers}`);
      console.log(`Nodes:    ${project.nodes.length}`);
      console.log(`Edges:    ${project.edges.length}`);
    });

  return cmd;
}

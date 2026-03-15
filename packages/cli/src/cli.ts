#!/usr/bin/env node
import { Command } from 'commander';
import { makeProjectCommand } from './commands/project.js';
import { makeResourceCommand } from './commands/resource.js';
import { makeHclCommand } from './commands/hcl.js';
import { makeModuleCommand } from './commands/module.js';

const program = new Command();

program
  .name('tstudio')
  .description('TerraStudio CLI — headless project manipulation and HCL generation')
  .version('0.1.0');

program.addCommand(makeProjectCommand());
program.addCommand(makeResourceCommand());
program.addCommand(makeHclCommand());
program.addCommand(makeModuleCommand());

program.parse(process.argv);

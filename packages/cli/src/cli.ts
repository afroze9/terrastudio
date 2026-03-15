#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { makeProjectCommand } from './commands/project.js';
import { makeResourceCommand } from './commands/resource.js';
import { makeHclCommand } from './commands/hcl.js';
import { makeModuleCommand } from './commands/module.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('tstudio')
  .description('TerraStudio CLI — headless project manipulation and HCL generation')
  .version(version);

program.addCommand(makeProjectCommand());
program.addCommand(makeResourceCommand());
program.addCommand(makeHclCommand());
program.addCommand(makeModuleCommand());

program.parse(process.argv);

#!/usr/bin/env node
import { Command } from 'commander';
import { makeProjectCommand } from './commands/project.js';
import { makeResourceCommand } from './commands/resource.js';
import { makeHclCommand } from './commands/hcl.js';
import { makeModuleCommand } from './commands/module.js';
import { makeTerraformCommand } from './commands/terraform.js';

// TSTUDIO_VERSION is replaced at bundle time by esbuild --define.
// In dev mode (running unbundled via ts-node/tsx), it falls back to '0.0.0-dev'.
declare const TSTUDIO_VERSION: string;
const version = typeof TSTUDIO_VERSION !== 'undefined' ? TSTUDIO_VERSION : '0.0.0-dev';

const program = new Command();

program
  .name('tstudio')
  .description('TerraStudio CLI — headless project manipulation and HCL generation')
  .version(version);

program.addCommand(makeProjectCommand());
program.addCommand(makeResourceCommand());
program.addCommand(makeHclCommand());
program.addCommand(makeModuleCommand());
program.addCommand(makeTerraformCommand());

program.parse(process.argv);

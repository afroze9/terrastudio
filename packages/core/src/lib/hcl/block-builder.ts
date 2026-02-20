import type { HclBlock } from '@terrastudio/types';

export interface GeneratedFiles {
  'terraform.tf': string;
  'providers.tf': string;
  'main.tf': string;
  'variables.tf': string;
  'outputs.tf': string;
  'locals.tf': string;
  'terraform.tfvars'?: string;
}

/**
 * Assembles sorted HCL blocks into their respective output files.
 */
export class HclBlockBuilder {
  /**
   * Groups blocks by their target file and assembles content.
   */
  assemble(
    sortedBlocks: HclBlock[],
    terraformBlock: string,
    providerBlock: string,
    variablesHcl: string,
    outputsHcl: string,
    localsHcl: string,
  ): GeneratedFiles {
    // Separate resource/data blocks for main.tf
    const mainBlocks = sortedBlocks.filter(
      (b) => b.blockType === 'resource' || b.blockType === 'data',
    );

    // Any additional variable/output blocks from generators
    const extraVarBlocks = sortedBlocks.filter(
      (b) => b.blockType === 'variable',
    );
    const extraOutputBlocks = sortedBlocks.filter(
      (b) => b.blockType === 'output',
    );
    const localBlocks = sortedBlocks.filter(
      (b) => b.blockType === 'locals',
    );

    const mainContent = mainBlocks.map((b) => b.content).join('\n\n');

    const allVariables = [
      variablesHcl,
      ...extraVarBlocks.map((b) => b.content),
    ]
      .filter(Boolean)
      .join('\n\n');

    const allOutputs = [
      outputsHcl,
      ...extraOutputBlocks.map((b) => b.content),
    ]
      .filter(Boolean)
      .join('\n\n');

    const allLocals = [localsHcl, ...localBlocks.map((b) => b.content)]
      .filter(Boolean)
      .join('\n\n');

    return {
      'terraform.tf': terraformBlock,
      'providers.tf': providerBlock,
      'main.tf': mainContent,
      'variables.tf': allVariables,
      'outputs.tf': allOutputs,
      'locals.tf': allLocals,
    };
  }
}

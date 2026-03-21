import type { HclGenerator, HclBlock, ResourceInstance, HclGenerationContext, ResourceTypeId } from '@terrastudio/types';

/** Creates a no-op HCL generator for annotation resources (no Terraform output). */
export function createNoopGenerator(typeId: ResourceTypeId): HclGenerator {
  return {
    typeId,
    generate(_resource: ResourceInstance, _context: HclGenerationContext): HclBlock[] {
      return [];
    },
  };
}

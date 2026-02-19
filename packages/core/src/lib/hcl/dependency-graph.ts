import type { HclBlock } from '@terrastudio/types';

/**
 * Topological sort of HCL blocks based on their dependsOn declarations.
 * Ensures blocks are emitted in valid dependency order in main.tf.
 */
export class DependencyGraph {
  private blocks: HclBlock[];

  constructor(blocks: HclBlock[]) {
    this.blocks = blocks;
  }

  /**
   * Returns blocks in topological order (dependencies first).
   * Blocks without dependencies come first.
   * Throws if a cycle is detected.
   */
  topologicalSort(): HclBlock[] {
    const addressMap = new Map<string, HclBlock>();
    for (const block of this.blocks) {
      const addr = this.blockAddress(block);
      if (addr) {
        addressMap.set(addr, block);
      }
    }

    // Build adjacency: block -> set of blocks it depends on
    const deps = new Map<HclBlock, Set<HclBlock>>();
    const noDeps: HclBlock[] = [];

    for (const block of this.blocks) {
      const blockDeps = new Set<HclBlock>();
      if (block.dependsOn) {
        for (const depAddr of block.dependsOn) {
          const depBlock = addressMap.get(depAddr);
          if (depBlock) {
            blockDeps.add(depBlock);
          }
        }
      }
      if (blockDeps.size === 0) {
        noDeps.push(block);
      }
      deps.set(block, blockDeps);
    }

    // Kahn's algorithm
    const sorted: HclBlock[] = [];
    const queue = [...noDeps];
    const inDegree = new Map<HclBlock, number>();

    for (const [block, blockDeps] of deps) {
      inDegree.set(block, blockDeps.size);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const [block, blockDeps] of deps) {
        if (blockDeps.has(current)) {
          blockDeps.delete(current);
          const remaining = (inDegree.get(block) ?? 1) - 1;
          inDegree.set(block, remaining);
          if (remaining === 0) {
            queue.push(block);
          }
        }
      }
    }

    if (sorted.length !== this.blocks.length) {
      throw new Error(
        'Circular dependency detected in HCL blocks. Check resource references.',
      );
    }

    return sorted;
  }

  private blockAddress(block: HclBlock): string | null {
    if (block.terraformType && block.name) {
      return `${block.terraformType}.${block.name}`;
    }
    return null;
  }
}

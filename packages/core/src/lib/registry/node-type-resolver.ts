import type { ResourceTypeId, ResourceNodeComponent } from '@terrastudio/types';

/**
 * Resolves a ResourceTypeId to its Svelte Flow node component.
 * Used by the canvas to dynamically render the correct component for each node.
 */
export class NodeTypeResolver {
  private nodeTypesMap: Record<string, ResourceNodeComponent> = {};

  update(map: Record<string, ResourceNodeComponent>): void {
    this.nodeTypesMap = map;
  }

  resolve(typeId: ResourceTypeId): ResourceNodeComponent | undefined {
    return this.nodeTypesMap[typeId];
  }

  getAll(): Record<string, ResourceNodeComponent> {
    return { ...this.nodeTypesMap };
  }
}

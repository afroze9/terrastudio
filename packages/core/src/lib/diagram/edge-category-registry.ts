import type { EdgeCategoryDefinition, EdgeCategoryId } from '@terrastudio/types';

/**
 * Built-in edge category definitions.
 */
const builtInCategories: EdgeCategoryDefinition[] = [
  {
    id: 'structural',
    label: 'Dependency',
    defaultStyle: {
      strokeColor: 'var(--edge-structural)',
      strokeWidth: 2,
      markerEnd: 'arrowClosed',
    },
    affectsHcl: true,
    userCreatable: true,
    persisted: true,
    selectable: true,
  },
  {
    id: 'binding',
    label: 'Data Binding',
    defaultStyle: {
      strokeColor: 'var(--edge-binding)',
      strokeWidth: 2,
      animated: true,
      markerEnd: 'arrow',
    },
    affectsHcl: true,
    userCreatable: true,
    persisted: true,
    selectable: true,
  },
  {
    id: 'reference',
    label: 'Reference',
    defaultStyle: {
      strokeColor: 'var(--edge-reference)',
      strokeWidth: 1.5,
      dashArray: '5 4',
    },
    affectsHcl: false,
    userCreatable: false,
    persisted: false,
    selectable: false,
  },
  {
    id: 'annotation',
    label: 'Annotation',
    defaultStyle: {
      strokeColor: 'var(--edge-annotation)',
      strokeWidth: 1.5,
      dashArray: '3 3',
      markerEnd: 'arrow',
    },
    affectsHcl: false,
    userCreatable: true,
    persisted: true,
    selectable: true,
  },
];

/**
 * Registry for edge categories. Provides lookup and iteration over
 * built-in and (future) plugin-defined edge categories.
 */
export class EdgeCategoryRegistry {
  private categories = new Map<EdgeCategoryId, EdgeCategoryDefinition>();

  constructor() {
    for (const cat of builtInCategories) {
      this.categories.set(cat.id, cat);
    }
  }

  /**
   * Get a category definition by ID.
   */
  get(id: EdgeCategoryId): EdgeCategoryDefinition | undefined {
    return this.categories.get(id);
  }

  /**
   * Get all registered category definitions.
   */
  getAll(): EdgeCategoryDefinition[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get all user-creatable categories (for UI menus).
   */
  getUserCreatable(): EdgeCategoryDefinition[] {
    return this.getAll().filter((cat) => cat.userCreatable);
  }

  /**
   * Register a custom edge category.
   * Intended for future plugin extensibility.
   */
  register(category: EdgeCategoryDefinition): void {
    if (this.categories.has(category.id)) {
      throw new Error(`Edge category '${category.id}' already registered`);
    }
    this.categories.set(category.id, category);
  }
}

/**
 * Singleton instance of the edge category registry.
 */
export const edgeCategoryRegistry = new EdgeCategoryRegistry();

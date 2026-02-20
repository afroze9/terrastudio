import type {
  InfraPlugin,
  ResourceTypeId,
  ResourceTypeRegistration,
  ResourceSchema,
  ResourceNodeComponent,
  PropertyEditorComponent,
  HclGenerator,
  BindingHclGenerator,
  IconDefinition,
  ConnectionRule,
  PaletteCategory,
  ProviderId,
  ProviderConfig,
  PluginRegistryReader,
} from '@terrastudio/types';

export class PluginRegistry implements PluginRegistryReader {
  private plugins: InfraPlugin[] = [];
  private resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>();
  private providers = new Map<ProviderId, ProviderConfig>();
  private connectionRulesList: ConnectionRule[] = [];
  private bindingGeneratorsList: BindingHclGenerator[] = [];
  private paletteCategoriesMap = new Map<string, PaletteCategory>();
  private finalized = false;

  registerPlugin(plugin: InfraPlugin): void {
    if (this.finalized) {
      throw new Error(
        `Cannot register plugin "${plugin.id}" after registry is finalized.`,
      );
    }

    // Register provider config (first one wins)
    if (plugin.providerConfig && !this.providers.has(plugin.providerId)) {
      this.providers.set(plugin.providerId, plugin.providerConfig);
    }

    // Register resource types with collision detection
    for (const [typeId, registration] of plugin.resourceTypes) {
      if (this.resourceTypes.has(typeId)) {
        throw new Error(
          `Resource type "${typeId}" is already registered. Collision between plugins.`,
        );
      }
      this.resourceTypes.set(typeId, registration);
    }

    // Merge connection rules
    this.connectionRulesList.push(...plugin.connectionRules);

    // Merge binding generators
    if (plugin.bindingGenerators) {
      this.bindingGeneratorsList.push(...plugin.bindingGenerators);
    }

    // Merge palette categories (dedupe by id)
    for (const category of plugin.paletteCategories) {
      if (!this.paletteCategoriesMap.has(category.id)) {
        this.paletteCategoriesMap.set(category.id, category);
      }
    }

    this.plugins.push(plugin);
  }

  finalize(): void {
    if (this.finalized) {
      throw new Error('Registry is already finalized.');
    }

    // Sort palette categories by order
    const sorted = [...this.paletteCategoriesMap.values()].sort(
      (a, b) => a.order - b.order,
    );
    this.paletteCategoriesMap.clear();
    for (const cat of sorted) {
      this.paletteCategoriesMap.set(cat.id, cat);
    }

    this.finalized = true;

    // Call lifecycle hook on all plugins
    const reader: PluginRegistryReader = this;
    for (const plugin of this.plugins) {
      plugin.onAllPluginsRegistered?.(reader);
    }
  }

  // --- Query methods ---

  getNodeComponent(typeId: ResourceTypeId): ResourceNodeComponent {
    const reg = this.getRegistration(typeId);
    return reg.nodeComponent;
  }

  getPropertyEditor(
    typeId: ResourceTypeId,
  ): PropertyEditorComponent | undefined {
    const reg = this.getRegistration(typeId);
    return reg.propertyEditor;
  }

  getHclGenerator(typeId: ResourceTypeId): HclGenerator {
    const reg = this.getRegistration(typeId);
    return reg.hclGenerator;
  }

  getResourceSchema(typeId: ResourceTypeId): ResourceSchema | undefined {
    return this.resourceTypes.get(typeId)?.schema;
  }

  getIcon(typeId: ResourceTypeId): IconDefinition | undefined {
    const reg = this.getRegistration(typeId);
    return reg.icon;
  }

  getProviderConfig(providerId: ProviderId): ProviderConfig | undefined {
    return this.providers.get(providerId);
  }

  getConnectionRules(): ConnectionRule[] {
    return [...this.connectionRulesList];
  }

  getBindingGenerator(
    sourceType: ResourceTypeId,
    targetType: ResourceTypeId,
  ): BindingHclGenerator | undefined {
    // Prefer exact match
    const exact = this.bindingGeneratorsList.find(
      (g) => g.sourceType === sourceType && g.targetType === targetType,
    );
    if (exact) return exact;

    // Fall back to wildcard (sourceType undefined = any source)
    return this.bindingGeneratorsList.find(
      (g) => g.sourceType === undefined && g.targetType === targetType,
    );
  }

  getPaletteCategories(): PaletteCategory[] {
    return [...this.paletteCategoriesMap.values()];
  }

  getResourceTypesForCategory(
    category: string,
  ): ResourceTypeRegistration[] {
    const results: ResourceTypeRegistration[] = [];
    for (const reg of this.resourceTypes.values()) {
      if (reg.schema.category === category) {
        results.push(reg);
      }
    }
    return results;
  }

  /**
   * Builds the nodeTypes map for Svelte Flow.
   * Keys are ResourceTypeId strings, values are Svelte components.
   */
  buildNodeTypesMap(): Record<string, ResourceNodeComponent> {
    const map: Record<string, ResourceNodeComponent> = {};
    for (const [typeId, reg] of this.resourceTypes) {
      map[typeId] = reg.nodeComponent;
    }
    return map;
  }

  // --- PluginRegistryReader implementation ---

  getResourceTypeIds(): ReadonlyArray<ResourceTypeId> {
    return [...this.resourceTypes.keys()];
  }

  getProviderIds(): ReadonlyArray<ProviderId> {
    return [...this.providers.keys()];
  }

  hasResourceType(typeId: ResourceTypeId): boolean {
    return this.resourceTypes.has(typeId);
  }

  // --- Internal helpers ---

  private getRegistration(typeId: ResourceTypeId): ResourceTypeRegistration {
    const reg = this.resourceTypes.get(typeId);
    if (!reg) {
      throw new Error(`Unknown resource type: "${typeId}"`);
    }
    return reg;
  }
}

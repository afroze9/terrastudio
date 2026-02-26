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
import { EdgeRuleValidator, type OutputAcceptingHandle } from '../diagram/edge-rules.js';

/** A function that dynamically imports a plugin module. */
export type PluginLoader = () => Promise<{ default: InfraPlugin }>;

interface LazyPluginEntry {
  loader: PluginLoader;
  state: 'pending' | 'loading' | 'loaded' | 'error';
}

export class PluginRegistry implements PluginRegistryReader {
  private plugins: InfraPlugin[] = [];
  private resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>();
  private providers = new Map<ProviderId, ProviderConfig>();
  private connectionRulesList: ConnectionRule[] = [];
  private bindingGeneratorsList: BindingHclGenerator[] = [];
  private paletteCategoriesMap = new Map<string, PaletteCategory>();

  // Lazy loading state
  private lazyEntries = new Map<ProviderId, LazyPluginEntry[]>();
  private loadedProviders = new Set<ProviderId>();
  private inProgressLoads = new Map<ProviderId, Promise<void>>();

  // Track which plugins have already had onAllPluginsRegistered fired
  private notifiedPlugins = new Set<InfraPlugin>();

  registerPlugin(plugin: InfraPlugin): void {
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

  /**
   * Register a lazy plugin factory for a given provider.
   * The loader function is NOT called until loadPluginsForProviders() is invoked.
   */
  registerLazyPlugin(providerId: ProviderId, loader: PluginLoader): void {
    if (!this.lazyEntries.has(providerId)) {
      this.lazyEntries.set(providerId, []);
    }
    this.lazyEntries.get(providerId)!.push({ loader, state: 'pending' });
  }

  /**
   * Load all registered lazy plugins for the given provider IDs.
   * Already-loaded providers are skipped (idempotent).
   * Concurrent calls for the same provider share the same Promise.
   */
  async loadPluginsForProviders(providerIds: ProviderId[]): Promise<void> {
    const toLoad = providerIds.filter((id) => !this.loadedProviders.has(id));
    if (toLoad.length === 0) return;

    // Start loads for each new provider (deduplicating concurrent calls)
    const promises = toLoad.map((providerId) => {
      const existing = this.inProgressLoads.get(providerId);
      if (existing) return existing;

      const promise = this._loadProvider(providerId);
      this.inProgressLoads.set(providerId, promise);
      promise.finally(() => this.inProgressLoads.delete(providerId));
      return promise;
    });

    await Promise.all(promises);

    // Re-finalize after all providers in this batch are loaded
    this._finalizeIncremental();
  }

  isProviderLoaded(providerId: ProviderId): boolean {
    return this.loadedProviders.has(providerId);
  }

  /**
   * Re-entrant finalize: sorts palette categories and fires onAllPluginsRegistered
   * on plugins that haven't been notified yet.
   */
  finalize(): void {
    this._finalizeIncremental();
  }

  /**
   * Build an EdgeRuleValidator from the currently registered connection rules
   * and output-accepting handles.
   */
  buildEdgeValidator(): EdgeRuleValidator {
    const handles: OutputAcceptingHandle[] = [];
    for (const typeId of this.getResourceTypeIds()) {
      const schema = this.getResourceSchema(typeId);
      for (const handle of schema?.handles ?? []) {
        if (handle.acceptsOutputs) {
          handles.push({ targetType: typeId, targetHandle: handle.id });
        }
      }
    }
    return new EdgeRuleValidator(this.connectionRulesList, handles);
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

  private async _loadProvider(providerId: ProviderId): Promise<void> {
    const entries = this.lazyEntries.get(providerId) ?? [];
    const pending = entries.filter((e) => e.state === 'pending');

    if (pending.length === 0) {
      this.loadedProviders.add(providerId);
      return;
    }

    // Mark all as loading
    for (const entry of pending) {
      entry.state = 'loading';
    }

    // Load all plugins for this provider in parallel
    await Promise.all(
      pending.map(async (entry) => {
        try {
          const module = await entry.loader();
          this.registerPlugin(module.default);
          entry.state = 'loaded';
        } catch (err) {
          entry.state = 'error';
          throw err;
        }
      }),
    );

    this.loadedProviders.add(providerId);
  }

  private _finalizeIncremental(): void {
    // Re-sort palette categories (idempotent)
    const sorted = [...this.paletteCategoriesMap.values()].sort(
      (a, b) => a.order - b.order,
    );
    this.paletteCategoriesMap.clear();
    for (const cat of sorted) {
      this.paletteCategoriesMap.set(cat.id, cat);
    }

    // Fire onAllPluginsRegistered only on newly-added plugins
    const reader: PluginRegistryReader = this;
    for (const plugin of this.plugins) {
      if (!this.notifiedPlugins.has(plugin)) {
        this.notifiedPlugins.add(plugin);
        plugin.onAllPluginsRegistered?.(reader);
      }
    }
  }

  private getRegistration(typeId: ResourceTypeId): ResourceTypeRegistration {
    const reg = this.resourceTypes.get(typeId);
    if (!reg) {
      throw new Error(`Unknown resource type: "${typeId}"`);
    }
    return reg;
  }
}

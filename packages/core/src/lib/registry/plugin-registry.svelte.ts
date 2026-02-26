/**
 * Svelte 5 reactive wrapper around PluginRegistry.
 *
 * This file uses Svelte 5 runes ($state, $derived) and must be compiled
 * by the Svelte compiler (Vite + svelte plugin), not by plain tsc.
 * It is excluded from tsconfig.json and resolved from source via
 * the "svelte" export condition in package.json.
 */
import type {
  InfraPlugin,
  ResourceTypeId,
  ResourceNodeComponent,
  PaletteCategory,
  ConnectionRule,
  ProviderId,
} from '@terrastudio/types';
import { PluginRegistry, type PluginLoader } from './plugin-registry.js';
import { EdgeRuleValidator } from '../diagram/edge-rules.js';

class ReactivePluginRegistry {
  private registry = new PluginRegistry();
  private _isFinalized = $state(false);
  private _nodeTypesMap = $state<Record<string, ResourceNodeComponent>>({});
  private _paletteCategories = $state<PaletteCategory[]>([]);
  private _connectionRules = $state<ConnectionRule[]>([]);
  private _edgeValidator = $state<EdgeRuleValidator>(new EdgeRuleValidator([], []));
  private _loadingProviders = $state(new Set<ProviderId>());
  private _loadErrors = $state(new Map<ProviderId, Error>());

  get isFinalized() {
    return this._isFinalized;
  }

  get nodeTypesMap() {
    return this._nodeTypesMap;
  }

  get paletteCategories() {
    return this._paletteCategories;
  }

  get connectionRules() {
    return this._connectionRules;
  }

  get edgeValidator() {
    return this._edgeValidator;
  }

  get isLoading() {
    return this._loadingProviders.size > 0;
  }

  get loadErrors() {
    return this._loadErrors;
  }

  get inner() {
    return this.registry;
  }

  /**
   * Register a lazy plugin factory. Called once at app startup via declarePlugins().
   * Does NOT import or evaluate the plugin module.
   */
  registerLazyPlugin(providerId: ProviderId, loader: PluginLoader): void {
    this.registry.registerLazyPlugin(providerId, loader);
  }

  registerPlugin(plugin: InfraPlugin): void {
    this.registry.registerPlugin(plugin);
  }

  /**
   * Load plugins for the given provider IDs and refresh all reactive state.
   * Idempotent — already-loaded providers are skipped.
   */
  async loadPluginsForProviders(providerIds: ProviderId[]): Promise<void> {
    const newProviders = providerIds.filter(
      (id) => !this.registry.isProviderLoaded(id),
    );
    if (newProviders.length === 0) return;

    // Mark as loading (reassign to trigger Svelte reactivity)
    for (const id of newProviders) this._loadingProviders.add(id);
    this._loadingProviders = new Set(this._loadingProviders);

    try {
      await this.registry.loadPluginsForProviders(providerIds);

      // Refresh all reactive state after successful load
      this._nodeTypesMap = this.registry.buildNodeTypesMap();
      this._paletteCategories = this.registry.getPaletteCategories();
      this._connectionRules = this.registry.getConnectionRules();
      this._edgeValidator = this.registry.buildEdgeValidator();
      this._isFinalized = true;
    } catch (e) {
      for (const id of newProviders) {
        this._loadErrors.set(id, e as Error);
      }
      this._loadErrors = new Map(this._loadErrors);
      throw e;
    } finally {
      for (const id of newProviders) this._loadingProviders.delete(id);
      this._loadingProviders = new Set(this._loadingProviders);
    }
  }

  /** @deprecated Use loadPluginsForProviders() instead. Kept for compatibility. */
  finalize(): void {
    this.registry.finalize();
    this._isFinalized = true;
    this._nodeTypesMap = this.registry.buildNodeTypesMap();
    this._paletteCategories = this.registry.getPaletteCategories();
    this._connectionRules = this.registry.getConnectionRules();
    this._edgeValidator = this.registry.buildEdgeValidator();
  }

  getResourceSchema(typeId: ResourceTypeId) {
    return this.registry.getResourceSchema(typeId);
  }

  getHclGenerator(typeId: ResourceTypeId) {
    return this.registry.getHclGenerator(typeId);
  }

  getIcon(typeId: ResourceTypeId) {
    return this.registry.getIcon(typeId);
  }

  getResourceTypesForCategory(category: string) {
    return this.registry.getResourceTypesForCategory(category);
  }
}

export const pluginRegistry = new ReactivePluginRegistry();

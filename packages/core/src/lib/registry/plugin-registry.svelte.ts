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
} from '@terrastudio/types';
import { PluginRegistry } from './plugin-registry.js';

class ReactivePluginRegistry {
  private registry = new PluginRegistry();
  private _isFinalized = $state(false);
  private _nodeTypesMap = $state<Record<string, ResourceNodeComponent>>({});
  private _paletteCategories = $state<PaletteCategory[]>([]);
  private _connectionRules = $state<ConnectionRule[]>([]);

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

  get inner() {
    return this.registry;
  }

  registerPlugin(plugin: InfraPlugin): void {
    this.registry.registerPlugin(plugin);
  }

  finalize(): void {
    this.registry.finalize();
    this._isFinalized = true;
    this._nodeTypesMap = this.registry.buildNodeTypesMap();
    this._paletteCategories = this.registry.getPaletteCategories();
    this._connectionRules = this.registry.getConnectionRules();
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

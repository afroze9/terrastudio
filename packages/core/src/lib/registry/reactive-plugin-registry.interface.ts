/**
 * Interface describing the public shape of ReactivePluginRegistry.
 * This file is compiled by plain tsc (no Svelte runes) so it can be
 * re-exported from index.ts and consumed by svelte-check.
 * The actual implementation lives in plugin-registry.svelte.ts.
 */
import type {
  InfraPlugin,
  ResourceTypeId,
  ResourceNodeComponent,
  PaletteCategory,
  ConnectionRule,
  ProviderId,
  ResourceSchema,
  ResourceTypeRegistration,
  HclGenerator,
  IconDefinition,
} from '@terrastudio/types';
import type { PluginRegistry, PluginLoader } from './plugin-registry.js';
import type { EdgeRuleValidator } from '../diagram/edge-rules.js';

export interface IReactivePluginRegistry {
  readonly isFinalized: boolean;
  readonly nodeTypesMap: Record<string, ResourceNodeComponent>;
  readonly paletteCategories: PaletteCategory[];
  readonly connectionRules: ConnectionRule[];
  readonly edgeValidator: EdgeRuleValidator;
  readonly isLoading: boolean;
  readonly loadErrors: Map<ProviderId, Error>;
  readonly inner: PluginRegistry;

  registerLazyPlugin(providerId: ProviderId, loader: PluginLoader): void;
  registerPlugin(plugin: InfraPlugin): void;
  loadPluginsForProviders(providerIds: ProviderId[]): Promise<void>;
  /** @deprecated */
  finalize(): void;
  getResourceSchema(typeId: ResourceTypeId): ResourceSchema | undefined;
  getHclGenerator(typeId: ResourceTypeId): HclGenerator | undefined;
  getIcon(typeId: ResourceTypeId): IconDefinition | undefined;
  hasResourceType(typeId: ResourceTypeId): boolean;
  getResourceTypesForCategory(category: string): ResourceTypeRegistration[];
}

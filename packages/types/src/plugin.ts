import type { ProviderId, ProviderConfig } from './provider.js';
import type { ResourceTypeId, ResourceSchema } from './resource-schema.js';
import type { ResourceNodeComponent, PropertyEditorComponent } from './node.js';
import type { HclGenerator, BindingHclGenerator } from './hcl.js';
import type { ConnectionRule } from './connection.js';
import type { LocaleCode, TranslationDict } from './i18n.js';

export interface IconDefinition {
  readonly type: 'svg' | 'component';
  readonly svg?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly component?: any;
}

export interface PaletteCategory {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconDefinition;
  readonly order: number;
}

export interface ResourceTypeRegistration {
  readonly schema: ResourceSchema;
  readonly nodeComponent: ResourceNodeComponent;
  readonly propertyEditor?: PropertyEditorComponent;
  readonly hclGenerator: HclGenerator;
  readonly icon?: IconDefinition;
}

export interface PluginRegistryReader {
  getResourceTypeIds(): ReadonlyArray<ResourceTypeId>;
  getResourceSchema(typeId: ResourceTypeId): ResourceSchema | undefined;
  getProviderIds(): ReadonlyArray<ProviderId>;
  hasResourceType(typeId: ResourceTypeId): boolean;
}

export interface InfraPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly providerId: ProviderId;

  readonly providerConfig?: ProviderConfig;
  readonly resourceTypes: ReadonlyMap<ResourceTypeId, ResourceTypeRegistration>;
  readonly connectionRules: ReadonlyArray<ConnectionRule>;
  readonly paletteCategories: ReadonlyArray<PaletteCategory>;

  readonly bindingGenerators?: ReadonlyArray<BindingHclGenerator>;

  /**
   * Optional locale bundles contributed by this plugin.
   * Keys live under the plugin-specific namespace "plugin.{plugin.id}".
   */
  readonly locales?: Partial<Record<LocaleCode, TranslationDict>>;

  onAllPluginsRegistered?(registry: PluginRegistryReader): void;
}

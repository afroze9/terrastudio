export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  categories: string[];
  icon: string;
  /** Cloud providers this template requires (e.g. ['azurerm'], ['aws'], ['azurerm', 'aws']). */
  providers?: string[];
  /** Base64 PNG data URL generated at save time. Optional — built-in templates don't have one. */
  thumbnail?: string;
}

export interface Template {
  templateVersion: number;
  metadata: TemplateMetadata;
  diagram: { nodes: unknown[]; edges: unknown[] };
}

export interface TemplateCategory {
  name: string;
  templates: Template[];
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

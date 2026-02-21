export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  categories: string[];
  icon: string;
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

import { invoke } from '@tauri-apps/api/core';
import type { PluginRegistry } from '@terrastudio/core';
import { generateNodeId } from '@terrastudio/core';
import type { ResourceTypeId } from '@terrastudio/types';
import type { DiagramNode, DiagramEdge } from '$lib/stores/diagram.svelte';
import { builtinTemplates } from './builtin';
import { validateTemplate } from './validator';
import type { Template, TemplateCategory } from './types';

interface UserTemplateEntry {
  category: string;
  filename: string;
  path: string;
}

export async function getTemplateCategories(
  registry: PluginRegistry,
): Promise<TemplateCategory[]> {
  const allTemplates: Template[] = [...builtinTemplates];

  // Load user templates from filesystem
  try {
    const entries = await invoke<UserTemplateEntry[]>('list_user_templates');
    for (const entry of entries) {
      try {
        const raw = await invoke<unknown>('load_user_template', { path: entry.path });
        const result = validateTemplate(raw, registry);
        if (result.valid) {
          allTemplates.push(raw as Template);
        } else {
          console.warn(
            `Invalid user template ${entry.filename}: ${result.errors.join(', ')}`,
          );
        }
      } catch (err) {
        console.warn(`Failed to load user template ${entry.filename}:`, err);
      }
    }
  } catch {
    // No user templates or command not available — that's fine
  }

  // Group by category (templates can appear in multiple categories)
  const categoryMap = new Map<string, Template[]>();
  for (const t of allTemplates) {
    for (const cat of t.metadata.categories) {
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(t);
    }
  }

  // Sort: "Getting Started" first, then alphabetical
  const categories: TemplateCategory[] = [];
  for (const [name, templates] of categoryMap) {
    categories.push({ name, templates });
  }
  categories.sort((a, b) => {
    if (a.name === 'Getting Started') return -1;
    if (b.name === 'Getting Started') return 1;
    return a.name.localeCompare(b.name);
  });

  return categories;
}

export function applyTemplate(template: Template): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  // JSON round-trip to strip Svelte 5 reactive proxies (structuredClone cannot handle them)
  const rawNodes = JSON.parse(JSON.stringify(template.diagram.nodes)) as DiagramNode[];
  const rawEdges = JSON.parse(JSON.stringify(template.diagram.edges)) as DiagramEdge[];

  // Build old ID → new ID map
  const idMap = new Map<string, string>();
  for (const node of rawNodes) {
    const newId = generateNodeId(node.type as ResourceTypeId);
    idMap.set(node.id, newId);
    node.id = newId;
  }

  // Remap parentId and references
  for (const node of rawNodes) {
    if (node.parentId && idMap.has(node.parentId as string)) {
      (node as any).parentId = idMap.get(node.parentId as string);
    }
    if (node.data?.references) {
      const refs = node.data.references as Record<string, string>;
      for (const key of Object.keys(refs)) {
        if (idMap.has(refs[key])) {
          refs[key] = idMap.get(refs[key])!;
        }
      }
    }
  }

  // Remap edges
  for (const edge of rawEdges) {
    const oldId = edge.id;
    if (idMap.has(edge.source)) edge.source = idMap.get(edge.source)!;
    if (idMap.has(edge.target)) edge.target = idMap.get(edge.target)!;
    // Generate new edge ID
    edge.id = `e-${edge.source}-${edge.target}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return { nodes: rawNodes, edges: rawEdges };
}

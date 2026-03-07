import type { DiagramNode } from '$lib/stores/diagram.svelte';
import type { ResourceSchema } from '@terrastudio/types';

export type SearchMode = 'all' | 'name' | 'type' | 'terraform-name' | 'property';

export interface SearchFilters {
  provider?: string;
  deploymentStatus?: string;
}

export interface SearchResult {
  nodeId: string;
  label: string;
  typeId: string;
  typeName: string;
  provider: string;
  terraformName: string;
  matchedField: 'label' | 'terraform-name' | 'type' | 'property';
  matchedPropertyKey?: string;
  matchedPropertyLabel?: string;
  matchedSnippet: string;
  score: number;
}

export interface SearchOptions {
  query: string;
  mode: SearchMode;
  filters: SearchFilters;
  nodes: DiagramNode[];
  getSchema: (typeId: string) => ResourceSchema | undefined;
}

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 200;
const MAX_VALUE_LENGTH = 500;

const SYNTHETIC_PREFIXES = ['_mod_', '_modinst_', '_instmem_'];

function matchScore(query: string, value: string): number {
  const q = query.toLowerCase();
  const v = value.toLowerCase();
  if (v === q) return 100;
  if (v.startsWith(q)) return 80;
  if (v.includes(q)) return 60;
  return 0;
}

function isSynthetic(nodeId: string): boolean {
  return SYNTHETIC_PREFIXES.some((p) => nodeId.startsWith(p));
}

export function searchNodes(options: SearchOptions): SearchResult[] {
  const { query, mode, filters, nodes, getSchema } = options;

  if (!query || query.length < MIN_QUERY_LENGTH) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of nodes) {
    if (isSynthetic(node.id)) continue;

    const typeId = node.type ?? '';
    const provider = typeId.split('/')[0] ?? '';

    // Apply filters
    if (filters.provider && provider !== filters.provider) continue;
    if (filters.deploymentStatus && node.data?.deploymentStatus !== filters.deploymentStatus) continue;

    const schema = getSchema(typeId);
    const label = node.data?.label ?? '';
    const terraformName = node.data?.terraformName ?? '';
    const typeName = schema?.displayName ?? typeId;

    // Build set of sensitive property keys
    const sensitiveKeys = new Set<string>();
    const referenceKeys = new Set<string>();
    const propertyLabels = new Map<string, string>();
    if (schema) {
      for (const prop of schema.properties) {
        if (prop.sensitive) sensitiveKeys.add(prop.key);
        if (prop.type === 'reference') referenceKeys.add(prop.key);
        propertyLabels.set(prop.key, prop.label);
      }
    }

    let bestScore = 0;
    let bestResult: SearchResult | null = null;

    function tryMatch(candidate: SearchResult) {
      if (candidate.score > bestScore) {
        bestScore = candidate.score;
        bestResult = candidate;
      }
    }

    const base = { nodeId: node.id, label, typeId, typeName, provider, terraformName };

    // Match label
    if (mode === 'all' || mode === 'name') {
      const s = matchScore(q, label);
      if (s > 0) tryMatch({ ...base, matchedField: 'label', matchedSnippet: label, score: s });
    }

    // Match terraform name
    if (mode === 'all' || mode === 'terraform-name') {
      const s = matchScore(q, terraformName);
      if (s > 0) tryMatch({ ...base, matchedField: 'terraform-name', matchedSnippet: terraformName, score: s });
    }

    // Match type (typeId and displayName)
    if (mode === 'all' || mode === 'type') {
      const s = Math.max(matchScore(q, typeId), matchScore(q, typeName));
      if (s > 0) tryMatch({ ...base, matchedField: 'type', matchedSnippet: typeName, score: s });
    }

    // Match properties
    if (mode === 'all' || mode === 'property') {
      const props = node.data?.properties;
      if (props && typeof props === 'object') {
        for (const [key, value] of Object.entries(props)) {
          if (sensitiveKeys.has(key)) continue;
          if (referenceKeys.has(key)) continue;
          if (value == null) continue;
          if (typeof value === 'object') continue;

          const strValue = String(value).slice(0, MAX_VALUE_LENGTH);
          const s = matchScore(q, strValue);
          const penalty = mode === 'all' ? -10 : 0;
          const adjusted = s + penalty;
          if (adjusted > 0) {
            tryMatch({
              ...base,
              matchedField: 'property',
              matchedPropertyKey: key,
              matchedPropertyLabel: propertyLabels.get(key) ?? key,
              matchedSnippet: strValue,
              score: adjusted,
            });
          }
        }
      }
    }

    if (bestResult) {
      results.push(bestResult);
    }
  }

  // Sort: score descending, then label ascending as tiebreaker
  results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return results.slice(0, MAX_RESULTS);
}

/**
 * Desktop adapter for @terrastudio/project's diagram converter.
 *
 * DiagramNode/DiagramEdge (xyflow types) are structurally compatible with
 * ProjectNode/ProjectEdge, so we can cast and delegate to the package.
 */
import type { ConnectionRule, ResourceSchema, ResourceTypeId, OutputBinding, ProjectNode, ProjectEdge } from '@terrastudio/types';
import type { EdgeRuleValidator, ProjectConfig } from '@terrastudio/core';
import {
  convertToResourceInstances as _convertToResourceInstances,
  extractOutputBindings as _extractOutputBindings,
} from '@terrastudio/project';
import type { ResourceInstance } from '@terrastudio/types';
import type { DiagramNode, DiagramEdge } from '$lib/stores/diagram.svelte';

export function convertToResourceInstances(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  connectionRules: ConnectionRule[],
  getSchema: (typeId: ResourceTypeId) => ResourceSchema | undefined,
  projectConfig?: ProjectConfig,
): ResourceInstance[] {
  return _convertToResourceInstances(
    nodes as unknown as ProjectNode[],
    edges as unknown as ProjectEdge[],
    connectionRules,
    getSchema,
    projectConfig,
  );
}

export function extractOutputBindings(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  edgeValidator: EdgeRuleValidator,
): OutputBinding[] {
  return _extractOutputBindings(
    edges as unknown as ProjectEdge[],
    nodes as unknown as ProjectNode[],
    edgeValidator,
  );
}

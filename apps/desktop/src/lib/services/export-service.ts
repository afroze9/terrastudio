import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { toPng, toSvg } from 'html-to-image';
import {
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/svelte';
import { diagram } from '$lib/stores/diagram.svelte';
import { project } from '$lib/stores/project.svelte';
import { cost } from '$lib/stores/cost.svelte';
import { registry } from '$lib/bootstrap';
import { getCSSVariable } from '$lib/themes/theme-engine';
import type { ResourceTypeId, PropertySchema } from '@terrastudio/types';

/**
 * Get the .svelte-flow__viewport element — the inner layer that holds
 * only nodes and edges (no controls, minimap, or background).
 */
function getViewportElement(): HTMLElement | null {
  return document.querySelector('.svelte-flow__viewport') as HTMLElement | null;
}

/**
 * Export the diagram as a PNG file.
 * Shows a save dialog for the user to pick the destination.
 */
export async function exportPNG(): Promise<void> {
  const dataUrl = await generatePngDataUrl();
  if (!dataUrl) return;

  const path = await saveDialog({
    title: 'Export Diagram as PNG',
    defaultPath: `${project.name || 'diagram'}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (!path) return;

  // Convert data URL to bytes
  const base64 = dataUrl.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  await invoke('write_export_file', {
    path,
    data: Array.from(bytes),
  });
}

/**
 * Copy the diagram as a PNG to the clipboard.
 */
export async function copyDiagramToClipboard(): Promise<void> {
  const dataUrl = await generatePngDataUrl();
  if (!dataUrl) return;

  // Convert data URL to blob and write to clipboard
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

/**
 * Export the diagram as an SVG file.
 * Shows a save dialog for the user to pick the destination.
 */
export async function exportSVG(): Promise<void> {
  const svgDataUrl = await generateSvgDataUrl();
  if (!svgDataUrl) return;

  const path = await saveDialog({
    title: 'Export Diagram as SVG',
    defaultPath: `${project.name || 'diagram'}.svg`,
    filters: [{ name: 'SVG Image', extensions: ['svg'] }],
  });

  if (!path) return;

  // Extract SVG content from the data URL
  const svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(svgContent);

  await invoke('write_export_file', {
    path,
    data: Array.from(bytes),
  });
}

/**
 * Generate an SVG data URL from the current diagram.
 */
async function generateSvgDataUrl(): Promise<string | null> {
  const viewportEl = getViewportElement();
  if (!viewportEl || diagram.nodes.length === 0) return null;

  const nodesBounds = getNodesBounds(diagram.nodes);
  const imageWidth = 1024;
  const imageHeight = 768;

  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    0.2,
  );

  if (!viewport) return null;

  const bgColor = getCSSVariable('color-bg') || '#0f111a';

  return toSvg(viewportEl, {
    backgroundColor: bgColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}

/**
 * Generate a PNG data URL from the current diagram.
 */
async function generatePngDataUrl(): Promise<string | null> {
  const viewportEl = getViewportElement();
  if (!viewportEl || diagram.nodes.length === 0) return null;

  const nodesBounds = getNodesBounds(diagram.nodes);

  // Use fixed output size and let getViewportForBounds fit the content
  // (matches the approach from the official Svelte Flow docs)
  const imageWidth = 1024;
  const imageHeight = 768;

  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    0.2,
  );

  if (!viewport) return null;

  const bgColor = getCSSVariable('color-bg') || '#0f111a';

  return toPng(viewportEl, {
    backgroundColor: bgColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}

/**
 * Generate a small PNG thumbnail data URL suitable for embedding in template metadata.
 * Returns a 480×360 png data URL, or null if the diagram is empty.
 */
export async function generateThumbnailPng(): Promise<string | null> {
  const viewportEl = getViewportElement();
  if (!viewportEl || diagram.nodes.length === 0) return null;

  const nodesBounds = getNodesBounds(diagram.nodes);
  const thumbWidth = 480;
  const thumbHeight = 360;

  const viewport = getViewportForBounds(nodesBounds, thumbWidth, thumbHeight, 0.5, 2, 0.15);
  if (!viewport) return null;

  const bgColor = getCSSVariable('color-bg') || '#0f111a';

  return toPng(viewportEl, {
    backgroundColor: bgColor,
    width: thumbWidth,
    height: thumbHeight,
    style: {
      width: `${thumbWidth}px`,
      height: `${thumbHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    pixelRatio: 1,
  });
}

/**
 * Export architecture documentation as Markdown.
 */
export async function exportDocumentation(): Promise<void> {
  const markdown = generateDocumentation();

  const path = await saveDialog({
    title: 'Export Architecture Documentation',
    defaultPath: `${project.name || 'architecture'}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  if (!path) return;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(markdown);

  await invoke('write_export_file', {
    path,
    data: Array.from(bytes),
  });
}

/**
 * Generate Markdown architecture documentation from the current diagram.
 */
function generateDocumentation(): string {
  const lines: string[] = [];
  const projectName = project.name || 'TerraStudio Project';

  // Title
  lines.push(`# ${projectName} — Architecture Documentation`);
  lines.push('');
  lines.push(`> Auto-generated by TerraStudio on ${new Date().toLocaleDateString()}`);
  lines.push('');

  // Resource Inventory
  lines.push('## Resource Inventory');
  lines.push('');

  if (diagram.nodes.length === 0) {
    lines.push('*No resources in diagram.*');
    lines.push('');
  } else {
    lines.push('| Resource | Type | Terraform Name | Provider Type | Status |');
    lines.push('|----------|------|----------------|---------------|--------|');

    for (const node of diagram.nodes) {
      const typeId = node.data.typeId as ResourceTypeId;
      const schema = registry.getResourceSchema(typeId);
      const displayType = schema?.displayName ?? typeId;
      const tfName = node.data.terraformName;
      const tfType = schema?.terraformType ?? '—';
      const status = node.data.deploymentStatus ?? 'pending';
      const statusIcon = status === 'created' ? 'deployed' : 'pending';

      lines.push(`| ${node.data.label} | ${displayType} | \`${tfName}\` | \`${tfType}\` | ${statusIcon} |`);
    }
    lines.push('');
  }

  // Cost Estimates
  if (cost.hasPrices) {
    lines.push('## Cost Estimates');
    lines.push('');
    lines.push(`> Prices are pay-as-you-go estimates for the **${cost.region}** region.`);
    lines.push('> Actual costs may vary based on usage, reservations, and discounts.');
    lines.push('');

    // Summary line
    if (cost.totalMonthly !== null) {
      lines.push(`**Estimated Total: ~$${cost.totalMonthly.toFixed(2)}/month**`);
      lines.push('');
    }

    // Per-resource table
    lines.push('| Resource | Type | Est. Monthly Cost | Notes |');
    lines.push('|----------|------|-------------------|-------|');

    for (const node of diagram.nodes) {
      const est = cost.estimates.get(node.id);
      if (!est) continue;

      const typeId = node.data.typeId as ResourceTypeId;
      const schema = registry.getResourceSchema(typeId);
      const displayType = schema?.displayName ?? typeId;

      let costCell: string;
      let notesCell = '';

      if (est.monthlyCost === 0) {
        costCell = '$0.00';
        notesCell = 'Free / included in parent';
      } else if (est.monthlyCost === null) {
        costCell = '—';
        notesCell = 'Usage-based or unknown';
      } else {
        costCell = `~$${est.monthlyCost.toFixed(2)}`;
        if (est.breakdown.length > 1) {
          notesCell = est.breakdown.map((b) => b.label).join('; ');
        }
      }

      lines.push(`| ${node.data.label} | ${displayType} | ${costCell} | ${notesCell} |`);
    }

    lines.push('');

    // Disclaimer
    lines.push('> Excludes egress, support plans, reservations, and usage-based resources.');
    lines.push('');
  }

  // Hierarchy
  const containers = diagram.nodes.filter((n) => {
    const schema = registry.getResourceSchema(n.data.typeId as ResourceTypeId);
    return schema?.isContainer;
  });

  if (containers.length > 0) {
    lines.push('## Resource Hierarchy');
    lines.push('');

    // Build parent->children map
    const childrenMap = new Map<string | undefined, typeof diagram.nodes>();
    for (const node of diagram.nodes) {
      const parentId = node.parentId as string | undefined;
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(node);
    }

    function renderTree(parentId: string | undefined, indent: string) {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        const schema = registry.getResourceSchema(child.data.typeId as ResourceTypeId);
        const icon = schema?.isContainer ? '📁' : '📄';
        lines.push(`${indent}- ${icon} **${child.data.label}** (${schema?.displayName ?? child.data.typeId})`);
        renderTree(child.id, indent + '  ');
      }
    }

    renderTree(undefined, '');
    lines.push('');
  }

  // Dependency Graph (Mermaid)
  if (diagram.edges.length > 0) {
    lines.push('## Dependency Graph');
    lines.push('');
    lines.push('```mermaid');
    lines.push('graph TD');

    // Node definitions
    for (const node of diagram.nodes) {
      const label = node.data.label.replace(/"/g, "'");
      lines.push(`    ${node.id}["${label}"]`);
    }

    // Edges
    for (const edge of diagram.edges) {
      lines.push(`    ${edge.source} --> ${edge.target}`);
    }

    lines.push('```');
    lines.push('');
  }

  // Key Properties
  lines.push('## Resource Details');
  lines.push('');

  for (const node of diagram.nodes) {
    const typeId = node.data.typeId as ResourceTypeId;
    const schema = registry.getResourceSchema(typeId);
    lines.push(`### ${node.data.label}`);
    lines.push('');
    lines.push(`- **Type**: ${schema?.displayName ?? typeId}`);
    lines.push(`- **Terraform**: \`${schema?.terraformType}.${node.data.terraformName}\``);

    // Show non-default properties
    if (schema?.properties) {
      const props = node.data.properties;
      const nonDefaultProps = schema.properties.filter((p: PropertySchema) => {
        const val = props[p.key];
        return val !== undefined && val !== '' && val !== p.defaultValue;
      });

      if (nonDefaultProps.length > 0) {
        lines.push('- **Properties**:');
        for (const prop of nonDefaultProps) {
          const val = props[prop.key];
          const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
          lines.push(`  - ${prop.label}: \`${display}\``);
        }
      }
    }

    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by [TerraStudio](https://github.com/afroze9/terrastudio)*');

  return lines.join('\n');
}

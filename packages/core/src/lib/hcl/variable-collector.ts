import type { TerraformVariable } from '@terrastudio/types';

/**
 * Collects Terraform variables registered by HCL generators.
 * Deduplicates by variable name (first registration wins).
 */
export class VariableCollector {
  private variables = new Map<string, TerraformVariable>();

  add(variable: TerraformVariable): void {
    if (!this.variables.has(variable.name)) {
      this.variables.set(variable.name, variable);
    }
  }

  getAll(): TerraformVariable[] {
    return [...this.variables.values()];
  }

  generateVariablesHcl(): string {
    const vars = this.getAll();
    if (vars.length === 0) return '';

    return vars
      .map((v) => {
        const lines: string[] = [`variable "${v.name}" {`];
        lines.push(`  type        = ${v.type}`);
        lines.push(`  description = "${escapeHcl(v.description)}"`);

        if (v.defaultValue !== undefined) {
          lines.push(`  default     = ${formatHclValue(v.defaultValue)}`);
        }

        if (v.sensitive) {
          lines.push(`  sensitive   = true`);
        }

        if (v.validation) {
          lines.push(`  validation {`);
          lines.push(`    condition     = ${v.validation.condition}`);
          lines.push(
            `    error_message = "${escapeHcl(v.validation.errorMessage)}"`,
          );
          lines.push(`  }`);
        }

        lines.push(`}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
}

/**
 * Collects Terraform outputs registered by HCL generators.
 */
export class OutputCollector {
  private outputs = new Map<string, { name: string; value: string; description: string; sensitive?: boolean }>();

  add(output: {
    name: string;
    value: string;
    description: string;
    sensitive?: boolean;
  }): void {
    if (!this.outputs.has(output.name)) {
      this.outputs.set(output.name, output);
    }
  }

  getAll() {
    return [...this.outputs.values()];
  }

  generateOutputsHcl(): string {
    const outputs = this.getAll();
    if (outputs.length === 0) return '';

    return outputs
      .map((o) => {
        const lines: string[] = [`output "${o.name}" {`];
        lines.push(`  value       = ${o.value}`);
        lines.push(`  description = "${escapeHcl(o.description)}"`);
        if (o.sensitive) {
          lines.push(`  sensitive   = true`);
        }
        lines.push(`}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
}

function escapeHcl(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatHclValue(value: unknown): string {
  if (typeof value === 'string') return `"${escapeHcl(value)}"`;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value))
    return `[${value.map(formatHclValue).join(', ')}]`;
  if (value === null || value === undefined) return 'null';
  // Object - render as HCL map
  const entries = Object.entries(value as Record<string, unknown>);
  const inner = entries
    .map(([k, v]) => `    ${k} = ${formatHclValue(v)}`)
    .join('\n');
  return `{\n${inner}\n  }`;
}

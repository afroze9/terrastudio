/**
 * Escape a string value for safe embedding in an HCL double-quoted string.
 *
 * Handles:
 *  - backslashes  →  \\
 *  - double quotes →  \"
 *  - newlines      →  \n
 *  - carriage returns → \r
 *  - tabs          →  \t
 *  - dollar-brace  →  $${   (prevents Terraform interpolation injection)
 */
export function escapeHclString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\$\{/g, '$${');
}

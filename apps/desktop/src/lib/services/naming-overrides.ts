/**
 * Re-exports getNamingOverridesFromAncestors from @terrastudio/project.
 *
 * The desktop app's DiagramNode is structurally compatible with ProjectNode,
 * so callers can pass DiagramNode[] directly.
 */
export { getNamingOverridesFromAncestors } from '@terrastudio/project';

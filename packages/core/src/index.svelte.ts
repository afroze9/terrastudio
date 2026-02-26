/**
 * Svelte entry point for @terrastudio/core.
 * Re-exports everything from the main index sources plus Svelte-reactive additions.
 * Resolved via the "svelte" export condition in package.json so that the
 * Svelte compiler (Vite + @sveltejs/vite-plugin-svelte) processes .svelte.ts files.
 */

// Re-export everything from the standard (non-Svelte) index
export * from './index.js';

// Svelte-reactive pluginRegistry — overrides the declared stub from index.js
export { pluginRegistry } from './lib/registry/plugin-registry.svelte.js';
export type { PluginLoader } from './lib/registry/plugin-registry.js';

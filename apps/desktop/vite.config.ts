import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		{
			name: 'suppress-known-warnings',
			apply: 'build',
			configResolved(config) {
				// Filter out "dynamically imported by X but also statically imported by Y"
				// from vite:reporter — intentional in bootstrap.ts / bridge-listener.ts
				const origWarn = config.logger.warn;
				config.logger.warn = (msg, options) => {
					if (typeof msg === 'string' && msg.includes('is dynamically imported by')) return;
					if (typeof msg === 'string' && msg.includes('is imported from external module')) return;
					origWarn(msg, options);
				};
			},
		},
	],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	build: {
		// Tauri SPA bundles everything into one page — large chunks are expected
		chunkSizeWarningLimit: 1000,
	},
	// Prevent Vite from obscuring Rust errors
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true
	}
});

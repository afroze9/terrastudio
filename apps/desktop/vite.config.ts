import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Prevent Vite from obscuring Rust errors
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true
	}
});

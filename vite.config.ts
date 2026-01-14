import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts']
	},
	server: {
		host: '0.0.0.0', // Listen on all network interfaces for mobile testing
		port: 5173,
		strictPort: false,
		// Warmup Paraglide files during server startup to improve Firefox dev performance
		// Paraglide generates ~3700 individual JS files which causes slow initial loads
		warmup: {
			clientFiles: ['./src/lib/paraglide/messages.js', './src/lib/paraglide/runtime.js']
		}
	}
});

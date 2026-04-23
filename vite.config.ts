import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Under Vitest only, add the `svelte` resolve condition so bits-ui (which
// ships only `types` + `svelte` export conditions) resolves from its main
// entry. Outside Vitest we leave `resolve.conditions` undefined so Vite's
// defaults (`module`, `browser`, `default`, …) remain in force — overriding
// them here breaks client module resolution during SSR/hydration.
const viteResolve = process.env.VITEST ? { conditions: ['browser', 'svelte'] } : undefined;

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts']
	},
	resolve: viteResolve,
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

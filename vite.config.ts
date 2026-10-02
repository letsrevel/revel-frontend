import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { splitBarrels } from './scripts/vite-plugin-split-barrels.ts';

// Vite module IDs always use `/`, even on Windows — normalize before comparing.
const PARAGLIDE_DEV_DIR = normalizePath(resolve('src/lib/paraglide'));
const PARAGLIDE_BUILD_DIR = normalizePath(resolve('.paraglide-build'));

/**
 * Production builds read Paraglide from `.paraglide-build` (`message-modules`,
 * tree-shakeable per route) instead of `src/lib/paraglide` (`locale-modules`,
 * fast in dev). Without this every page shipped every message in every locale
 * as one ~1 MB-gzipped chunk and stayed un-hydrated until it loaded. See
 * scripts/compile-i18n.js.
 */
function paraglideBuildOutput(): Plugin {
	let redirected = 0;
	return {
		name: 'revel:paraglide-build-output',
		apply: 'build',
		enforce: 'pre',
		buildStart() {
			redirected = 0;
			if (!existsSync(PARAGLIDE_BUILD_DIR)) {
				this.error('.paraglide-build is missing — run `node scripts/compile-i18n.js --build`');
			}
		},
		async resolveId(source, importer, options) {
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			if (!resolved?.id.startsWith(PARAGLIDE_DEV_DIR + '/')) return null;
			redirected++;
			return { ...resolved, id: PARAGLIDE_BUILD_DIR + resolved.id.slice(PARAGLIDE_DEV_DIR.length) };
		},
		buildEnd(error) {
			// A redirect that silently stops matching still builds green — just
			// with the untree-shaken bundle again. Fail loudly instead.
			if (!error && redirected === 0) {
				this.error('no $lib/paraglide imports were redirected to .paraglide-build');
			}
		}
	};
}

// Under Vitest only, add the `svelte` resolve condition so bits-ui (which
// ships only `types` + `svelte` export conditions) resolves from its main
// entry. Outside Vitest we leave `resolve.conditions` undefined so Vite's
// defaults (`module`, `browser`, `default`, …) remain in force — overriding
// them here breaks client module resolution during SSR/hydration.
const viteResolve = process.env.VITEST ? { conditions: ['browser', 'svelte'] } : undefined;

export default defineConfig({
	plugins: [
		paraglideBuildOutput(),
		// Vitest only — see the plugin for why the barrels are split.
		...(process.env.VITEST ? [splitBarrels()] : []),
		sveltekit()
	],
	build: {
		// Skip gzip-size reporting: it adds build time and hundreds of log lines in CI
		reportCompressedSize: false
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		// Load the compiled Paraglide output with Node's own loader, once per
		// worker, instead of re-evaluating its ~25 MB of locale modules in every
		// test file's isolated graph (that alone was ~3s per component test).
		// Consequence: `vi.mock('$lib/paraglide/runtime.js')` still reaches code
		// that imports the runtime directly (date.ts), but NOT the compiled
		// messages, which import it natively. To drive message locale in a
		// test, use the runtime's `overwriteGetLocale` and restore it after
		// (see utils/subscriptions.locale.test.ts) — the runtime instance is
		// shared by every test file in the worker.
		server: { deps: { external: [/\/src\/lib\/paraglide\//] } }
	},
	resolve: viteResolve,
	// Playwright's webServer starts `vite preview` and waits on port 5173; the
	// vite default (4173) left it timing out (see playwright.config.ts).
	preview: {
		port: 5173,
		strictPort: true
	},
	server: {
		host: '0.0.0.0', // Listen on all network interfaces for mobile testing
		port: 5173,
		strictPort: false,
		// Warmup Paraglide files during server startup to improve Firefox dev performance
		warmup: {
			clientFiles: ['./src/lib/paraglide/messages.js', './src/lib/paraglide/runtime.js']
		}
	}
});

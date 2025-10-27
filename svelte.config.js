import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using adapter-node for Docker/production deployment
		// Builds a standalone Node.js server
		adapter: adapter({
			out: 'build',
			precompress: false,
			envPrefix: 'PUBLIC_'
		}),

		alias: {
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$utils: 'src/lib/utils',
			$stores: 'src/lib/stores',
			$api: 'src/lib/api'
		}
	}
};

export default config;
